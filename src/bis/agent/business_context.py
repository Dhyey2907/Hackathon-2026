"""What the user works with - inferred from their own conversation history.

This is the assistant's memory of *the person*, and it is kept strictly apart
from the assistant's knowledge of *BIS*. The distinction runs through the whole
module and is the reason it exists as its own file:

    business context   what the user told us they make or sell
    BIS evidence       what a retrieved BIS document actually says

Context decides which question to ask and how to read "my product". It is never
allowed to support a factual claim. "The user manufactures pressure cookers"
tells us nothing about which standard applies to pressure cookers - only
retrieval can answer that.

**Where the history comes from.** The frontend reads it from Supabase, where
row-level security restricts every account to its own messages, and posts it
here. The backend stays stateless and never queries another user's rows,
because it never queries the table at all.

**Not inventing a profile.** The model must quote the user's own words as
evidence for anything it claims. A claim with no quotable evidence is demoted
to low confidence, and low confidence is never shown as fact. Someone who says
"I sell jewellery" is a seller until they say otherwise - not a manufacturer.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from bis.config import get_settings
from bis.llm import chat_json

log = logging.getLogger(__name__)

Confidence = Literal["high", "medium", "low", "none"]
Role = Literal["manufacturer", "seller", "service_provider", "unknown"]

# Only the user's own turns are inspected. Assistant replies discuss whatever
# was asked and would otherwise convince the extractor that the user works in
# every industry they ever enquired about.
MAX_USER_TURNS = 20

# Anything below this many characters is unlikely to describe a business.
MIN_USEFUL_LENGTH = 3

_cache: dict[str, BusinessContext] = {}


@dataclass
class BusinessContext:
    products: list[str] = field(default_factory=list)
    role: Role = "unknown"
    industry: str | None = None
    business_type: str | None = None
    confidence: Confidence = "none"
    # The user's own words that support the above. Empty means we inferred
    # rather than observed, which caps confidence at low.
    evidence: str | None = None
    topics: list[str] = field(default_factory=list)

    @property
    def is_usable(self) -> bool:
        """Whether this may shape the interface.

        Low confidence is deliberately excluded. A single ambiguous question is
        not a business, and greeting someone with a guess about their livelihood
        is worse than asking.
        """
        return self.confidence in ("high", "medium") and bool(self.products or self.business_type)

    def headline(self) -> str | None:
        """How to say it back to the user, hedged to match the confidence.

        High confidence means they told us outright, so it can be stated. Medium
        means we pieced it together from what they asked about, so it is phrased
        as an observation about their questions rather than a claim about them.
        """
        subject = ", ".join(self.products) or self.business_type
        if not subject or not self.is_usable:
            return None
        if self.confidence == "high":
            return f"you're working with {subject}"
        return f"you've been asking about {subject}"

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["is_usable"] = self.is_usable
        data["headline"] = self.headline()
        return data

    def prompt_block(self) -> str | None:
        """How the context is handed to the answering model."""
        if not self.is_usable:
            return None
        bits = []
        if self.products:
            bits.append(f"works with: {', '.join(self.products)}")
        if self.role != "unknown":
            bits.append(f"role: {self.role}")
        if self.industry:
            bits.append(f"industry: {self.industry}")
        return "; ".join(bits) or None


EXTRACT_PROMPT = """You read a user's own messages to an Indian Standards \
assistant and report what business they appear to work with.

Report only what the messages support. Quote the user's words as evidence for \
any claim. If you cannot quote something, you are guessing - say so by using \
low confidence.

Decide in two steps.

STEP 1 - is a specific product or material named anywhere?
A specific product is a thing that gets made or sold: pressure cookers, LED \
bulbs, cement, jewellery, helmets. "Certification", "licensing", "standards" \
and "BIS" are topics, not products.

  No specific product named  -> products [], confidence none. Stop here.
  A specific product named   -> go to step 2.

STEP 2 - how strongly is it theirs?
- They said so: "I manufacture X", "we make X", "my company sells X"
  -> that role, confidence HIGH.
- "I sell X" means seller. Do NOT upgrade a seller to a manufacturer.
- They never said what they do, but two or more separate messages ask about \
the same specific product - "what certification do pressure cookers need?", \
"which lab tests pressure cookers?"
  -> products [that product], role unknown, confidence MEDIUM. This matters: \
someone asking repeatedly about one product is almost certainly working with \
it, even though they have not said so.
- One passing mention of a product and nothing more -> confidence LOW.

Examples:
  ["I manufacture helmets"]                      -> helmets, manufacturer, high
  ["I sell gold jewellery"]                      -> jewellery, seller, high
  ["what standard covers pressure cookers?",
   "which lab can test a pressure cooker?"]      -> pressure cookers, unknown, medium
  ["is IS 456 about concrete?"]                  -> concrete, unknown, low
  ["what is BIS certification?"]                 -> [], unknown, none

Confidence:
  high    the user stated their business or product outright
  medium  several messages consistently point at a product, but they never said it
  low     one ambiguous mention
  none    nothing about a business

Also list up to 6 BIS topics they have asked about, using short lowercase \
labels such as "certification", "hallmarking", "testing", "labs", \
"licensing", "marking", "standards", "complaints".

Return strict JSON:
{"products": [...], "role": "manufacturer|seller|service_provider|unknown",
 "industry": <string|null>, "business_type": <string|null>,
 "confidence": "high|medium|low|none", "evidence": <string|null>,
 "topics": [...]}"""


def _user_turns(messages: list[dict[str, Any]]) -> list[str]:
    turns = [
        " ".join(str(m.get("content") or "").split())
        for m in messages
        if str(m.get("role") or "").lower() == "user"
    ]
    return [t for t in turns if len(t) >= MIN_USEFUL_LENGTH][-MAX_USER_TURNS:]


def _cache_key(turns: list[str]) -> str:
    return hashlib.blake2b("\n".join(turns).encode(), digest_size=12).hexdigest()


def _clean_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: list[str] = []
    for item in value:
        text = " ".join(str(item).split()).strip(" .,-")
        if text and text.lower() not in {s.lower() for s in seen}:
            seen.append(text[:60])
    return seen[:limit]


def _evidence_supports(evidence: str | None, turns: list[str]) -> bool:
    """Whether the quoted evidence really appears in the user's messages.

    The model is asked to quote; this checks it did not paraphrase or invent.
    Matching is loose - a quote may be trimmed or re-cased - so a reasonable
    overlap of the quoted words is enough.
    """
    if not evidence:
        return False
    haystack = " ".join(turns).lower()
    words = [w for w in re.findall(r"[a-z]+", evidence.lower()) if len(w) > 3]
    if not words:
        return False
    present = sum(1 for w in words if w in haystack)
    return present / len(words) >= 0.6


def extract(messages: list[dict[str, Any]]) -> BusinessContext:
    """Infer business context from a conversation. Never raises."""
    turns = _user_turns(messages)
    if not turns:
        return BusinessContext()

    key = _cache_key(turns)
    if key in _cache:
        return _cache[key]

    settings = get_settings()
    transcript = "\n".join(f"- {t}" for t in turns)

    try:
        raw = chat_json(
            [
                {"role": "system", "content": EXTRACT_PROMPT},
                {"role": "user", "content": f"User messages:\n{transcript}"},
            ],
            model=settings.groq_router_model,
            default={},
        )
    except Exception as exc:
        # Context is an enhancement. If it cannot be produced, the assistant
        # still answers - it just asks rather than assumes.
        log.warning("business context extraction failed: %s", str(exc)[:160])
        return BusinessContext()

    confidence = str(raw.get("confidence") or "none").lower()
    if confidence not in ("high", "medium", "low", "none"):
        confidence = "none"

    role = str(raw.get("role") or "unknown").lower()
    if role not in ("manufacturer", "seller", "service_provider", "unknown"):
        role = "unknown"

    evidence = raw.get("evidence")
    evidence = " ".join(str(evidence).split())[:300] if evidence else None

    # A high-confidence claim has to be traceable to something the user wrote.
    # Without that it is the model's impression, not the user's statement.
    if confidence == "high" and not _evidence_supports(evidence, turns):
        log.info("demoting high-confidence context: evidence not found in the user's words")
        confidence = "medium"

    context = BusinessContext(
        products=_clean_list(raw.get("products"), 5),
        role=role,  # type: ignore[arg-type]
        industry=(str(raw["industry"])[:80] if raw.get("industry") else None),
        business_type=(str(raw["business_type"])[:120] if raw.get("business_type") else None),
        confidence=confidence,  # type: ignore[arg-type]
        evidence=evidence,
        topics=_clean_list(raw.get("topics"), 6),
    )

    _cache[key] = context
    return context


# --------------------------------------------------------------- suggestions

SUGGEST_PROMPT = """You propose what a user of an Indian Standards assistant \
might usefully ask next.

Write 3 or 4 suggestions. Each is a short action label of 2-5 words that reads \
as something to do, not a sentence: "Check applicable standards", "Find a \
testing lab", "Required documents".

The last question leads. Suggest where *that* subject goes next: after a \
certification question, the natural steps are documents, testing and labs - not \
"learn about BIS".

The user's business colours the suggestions only when the question is about it. \
If a helmet manufacturer asks what HUID is, they have changed the subject to \
hallmarking, and the follow-ups belong to hallmarking - offering them helmet \
standards ignores what they actually asked. When there is no last question, the \
business is all you have, so lead with it.

Never suggest something vague like "Ask me anything", "Explore standards" or \
"Learn more" unless you genuinely have nothing to work with.

Never invent an IS number, a fee, a timeline or a rule. A suggestion is a \
question the user might ask, not an answer.

Return strict JSON: {"suggestions": ["...", "..."]}"""

GENERIC_SUGGESTIONS = [
    "What is BIS certification?",
    "Which standard applies to my product?",
    "Find a testing laboratory",
]

# A suggestion naming a specific standard is unverifiable. It carries no
# sources, so the citation validator never sees it, and a wrong IS number shown
# as a next step is exactly the fabrication this project exists to prevent.
# Observed in testing: a packaged-water business was offered "Check IS 14228
# compliance" - the real standard is IS 14543.
#
# Covers the designation forms BIS actually uses: "IS 456", "IS/IEC 62368",
# "IS/ISO 603". Matching only IS-then-digits missed the joint designations.
_IS_NUMBER_RE = re.compile(
    r"\b(?:IS|IEC|ISO)(?:\s*/\s*(?:IEC|ISO))?[\s:-]*\d{2,5}\b", re.IGNORECASE
)


def _drops_a_standard_number(suggestion: str) -> bool:
    return bool(_IS_NUMBER_RE.search(suggestion))


def suggest(
    context: BusinessContext,
    last_question: str | None = None,
    last_answer_topic: str | None = None,
) -> list[str]:
    """Next actions for this user. Falls back to generic prompts, never to nothing."""
    if not context.is_usable and not last_question:
        return list(GENERIC_SUGGESTIONS)

    lines = []
    if context.is_usable:
        if context.products:
            lines.append(f"Works with: {', '.join(context.products)}")
        if context.role != "unknown":
            lines.append(f"Role: {context.role}")
        if context.topics:
            lines.append(f"Has asked about: {', '.join(context.topics)}")
    if last_question:
        lines.append(f"Just asked: {last_question[:200]}")
    if last_answer_topic:
        lines.append(f"The answer covered: {last_answer_topic[:200]}")

    try:
        raw = chat_json(
            [
                {"role": "system", "content": SUGGEST_PROMPT},
                {"role": "user", "content": "\n".join(lines)},
            ],
            model=get_settings().groq_router_model,
            default={},
        )
        suggestions = _clean_list(raw.get("suggestions"), 6)
    except Exception as exc:
        log.warning("suggestion generation failed: %s", str(exc)[:160])
        return list(GENERIC_SUGGESTIONS)

    kept = []
    for suggestion in suggestions:
        if _drops_a_standard_number(suggestion):
            log.info("dropped suggestion naming a standard: %s", suggestion)
            continue
        kept.append(suggestion)

    # Top up rather than show a lone suggestion, but never pad past four.
    for fallback in GENERIC_SUGGESTIONS:
        if len(kept) >= 3:
            break
        if fallback not in kept:
            kept.append(fallback)

    return kept[:4] or list(GENERIC_SUGGESTIONS)


def clear_cache() -> None:
    _cache.clear()
