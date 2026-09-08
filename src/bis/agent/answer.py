"""Answer orchestration: route, retrieve, rerank, compose, validate.

The order matters. Validation runs after composition, on the finished text, so
a marker the model invented is removed before anyone sees it. Abstention is
decided before composition, from the evidence scores, so a weak-evidence
question never reaches a model that would be tempted to fill the gap.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from bis.agent import tools
from bis.agent.prompts import (
    ABSTAIN_PROMPT,
    ANSWER_PROMPT,
    evidence_prompt,
)
from bis.agent.router import route
from bis.config import get_settings
from bis.guardrails.citations import (
    build_evidence,
    find_unsupported_clause_claims,
    format_evidence_block,
    validate,
)
from bis.llm import chat, chat_stream
from bis.retrieval.rerank import evidence_is_weak, rerank

log = logging.getLogger(__name__)


@dataclass
class Answer:
    text: str
    sources: list[dict[str, Any]] = field(default_factory=list)
    intent: str = ""
    abstained: bool = False
    structured: dict[str, Any] = field(default_factory=dict)
    latency_ms: float = 0.0
    warnings: list[str] = field(default_factory=list)


def _abstain(question: str) -> str:
    return chat(
        [
            {"role": "system", "content": ABSTAIN_PROMPT},
            {"role": "user", "content": question},
        ],
        temperature=0.3,
        max_tokens=300,
    )


def _smalltalk(question: str) -> str:
    return chat(
        [
            {
                "role": "system",
                "content": (
                    "You are a BIS standards assistant. Reply in one or two "
                    "sentences and steer the user toward what you can help "
                    "with: finding applicable Indian Standards, BIS "
                    "certification and licensing, hallmarking, testing "
                    "laboratories, and consumer complaints. Do not use "
                    "citation markers."
                ),
            },
            {"role": "user", "content": question},
        ],
        temperature=0.4,
        max_tokens=200,
    )


def prepare(question: str) -> dict:
    """Everything up to generation: route, retrieve, rerank, judge evidence.

    Split out from answering so the streaming and non-streaming paths share one
    implementation and cannot drift apart in their retrieval or abstention
    behaviour.
    """
    routed = route(question)
    intent = routed["intent"]

    if intent == "smalltalk":
        return {"routed": routed, "intent": intent, "hits": [], "evidence": [],
                "structured": {}, "abstain": False, "smalltalk": True}

    hits, structured = tools.run_tool(intent, question, routed)
    ranked = rerank(question, hits)
    weak = evidence_is_weak(ranked)
    evidence = build_evidence(ranked)

    return {
        "routed": routed,
        "intent": intent,
        "hits": ranked,
        "evidence": evidence,
        "structured": structured,
        "abstain": weak or not evidence,
        "smalltalk": False,
    }


def answer(question: str) -> Answer:
    """Answer a question in one shot."""
    started = time.time()
    state = prepare(question)

    if state["smalltalk"]:
        return Answer(
            text=_smalltalk(question),
            intent="smalltalk",
            latency_ms=(time.time() - started) * 1000,
        )

    if state["abstain"]:
        return Answer(
            text=_abstain(question),
            intent=state["intent"],
            abstained=True,
            structured=state["structured"],
            latency_ms=(time.time() - started) * 1000,
        )

    evidence = state["evidence"]
    raw = chat(
        [
            {"role": "system", "content": ANSWER_PROMPT},
            {
                "role": "user",
                "content": evidence_prompt(question, format_evidence_block(evidence)),
            },
        ],
        temperature=0.2,
    )

    result = validate(raw, evidence)
    warnings: list[str] = []
    if result.dropped_markers:
        warnings.append(f"removed unresolvable citations: {result.dropped_markers}")
        log.warning("model cited %s which was not in evidence", result.dropped_markers)

    unsupported = find_unsupported_clause_claims(result.text, evidence)
    if unsupported:
        # A clause number that appears in no source is almost certainly
        # invented. The answer still goes out - stripping mid-sentence would
        # mangle it - but the caller and the logs both learn about it.
        warnings.append(f"unsupported clause claims: {unsupported}")
        log.warning("answer claims clauses not present in evidence: %s", unsupported)

    return Answer(
        text=result.text,
        sources=result.sources,
        intent=state["intent"],
        structured=state["structured"],
        latency_ms=(time.time() - started) * 1000,
        warnings=warnings,
    )


def answer_stream(question: str) -> Iterator[dict]:
    """Answer as a stream of events, matching the SSE contract in docs/.

    Sources are emitted after the text rather than before: only markers the
    model actually used are returned, and that is not known until the answer is
    complete. Validation therefore runs on the accumulated text at the end - the
    tokens themselves stream unvalidated, which is the one compromise streaming
    forces. A dropped marker is corrected in the final `sources` event.
    """
    started = time.time()
    state = prepare(question)
    routed = state["routed"]

    yield {
        "event": "intent",
        "intent": state["intent"],
        "product": routed.get("product"),
        "is_numbers": routed.get("is_numbers"),
    }

    if state["smalltalk"]:
        text = _smalltalk(question)
        yield {"event": "token", "text": text}
        yield {"event": "sources", "sources": []}
        yield {
            "event": "done",
            "abstained": False,
            "latency_ms": (time.time() - started) * 1000,
        }
        return

    if state["structured"]:
        yield {"event": "structured", "data": state["structured"]}

    if state["abstain"]:
        text = _abstain(question)
        yield {"event": "token", "text": text}
        yield {"event": "sources", "sources": []}
        yield {
            "event": "done",
            "abstained": True,
            "latency_ms": (time.time() - started) * 1000,
        }
        return

    evidence = state["evidence"]
    settings = get_settings()
    chunks: list[str] = []

    try:
        for delta in chat_stream(
            [
                {"role": "system", "content": ANSWER_PROMPT},
                {
                    "role": "user",
                    "content": evidence_prompt(question, format_evidence_block(evidence)),
                },
            ],
            model=settings.groq_answer_model,
            temperature=0.2,
        ):
            chunks.append(delta)
            yield {"event": "token", "text": delta}
    except Exception as exc:
        log.exception("streaming failed")
        yield {"event": "error", "message": str(exc)[:200]}
        return

    result = validate("".join(chunks), evidence)
    yield {"event": "sources", "sources": result.sources}
    yield {
        "event": "done",
        "abstained": False,
        "latency_ms": (time.time() - started) * 1000,
        "dropped_markers": result.dropped_markers,
    }
