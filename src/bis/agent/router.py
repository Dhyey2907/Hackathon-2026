"""Intent classification and entity extraction.

One cheap model call decides which retrieval strategy a question needs. The
eight required capabilities do not share one: "which standard applies to my
LED bulbs" ranks over catalogue titles, "what does clause 4.2 require" searches
document passages, and "labs near Gujarat" is a filtered table query. Running a
single vector search for all of them answers each of them badly.

The extracted entities matter as much as the intent - an IS number pulled out
here becomes an exact lookup instead of a fuzzy search.
"""

from __future__ import annotations

import logging
import re

from bis.agent.prompts import ROUTER_PROMPT
from bis.config import get_settings
from bis.llm import chat_json

log = logging.getLogger(__name__)

INTENTS = {
    "recommend_standards",
    "standard_lookup",
    "certification",
    "hallmarking",
    "labs",
    "consumer",
    "smalltalk",
}

DEFAULT_INTENT = "recommend_standards"

# Matches "IS 302", "IS 9873 (Part 1)", "IS/IEC 62368", "IS 269:2015".
IS_NUMBER_RE = re.compile(
    r"\b(IS(?:/(?:ISO|IEC))?)\s*[:\-]?\s*(\d{1,5})"
    r"(\s*\(\s*Part\s*\d+[^)]*\))?"
    r"(\s*:\s*\d{4})?",
    re.IGNORECASE,
)


def extract_is_numbers(text: str) -> list[str]:
    """Pull IS numbers out of text with a regex.

    Used to cross-check the model: a number it missed still reaches the lookup
    tool, and the regex never invents one that is not in the text.
    """
    found: list[str] = []
    for match in IS_NUMBER_RE.finditer(text or ""):
        prefix = match.group(1).upper()
        number = match.group(2)
        part = (match.group(3) or "").strip()
        candidate = f"{prefix} {number}"
        if part:
            # Normalised outside the f-string: a backslash inside an
            # f-string expression is a syntax error before Python 3.12.
            part_text = re.sub(r"\s+" , " ", part)
            candidate = f"{candidate} {part_text}"
        if candidate not in found:
            found.append(candidate)
    return found


def route(question: str) -> dict:
    """Classify a question. Never raises - falls back to a safe default."""
    settings = get_settings()

    result = chat_json(
        [
            {"role": "system", "content": ROUTER_PROMPT},
            {"role": "user", "content": question},
        ],
        model=settings.groq_router_model,
        default={},
    )

    intent = str(result.get("intent") or "").strip().lower().replace("-", "_")
    if intent not in INTENTS:
        if intent:
            log.warning("router returned unknown intent %r; using default", intent)
        intent = DEFAULT_INTENT

    model_numbers = result.get("is_numbers")
    numbers = [str(n).strip() for n in model_numbers if str(n).strip()] if isinstance(model_numbers, list) else []

    # Union with the regex pass so a number the model dropped is not lost.
    for candidate in extract_is_numbers(question):
        if not any(candidate.lower() in n.lower() for n in numbers):
            numbers.append(candidate)

    # A question naming a specific standard is a lookup even if the model
    # called it something else - the number is the stronger signal.
    if numbers and intent in {"recommend_standards", "smalltalk"}:
        intent = "standard_lookup"

    product = result.get("product")
    state = result.get("state")

    return {
        "intent": intent,
        "is_numbers": numbers,
        "product": str(product).strip() if isinstance(product, str) and product.strip() else None,
        "state": str(state).strip() if isinstance(state, str) and state.strip() else None,
    }
