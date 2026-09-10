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

from bis.agent import answer_cache, faq_cache, tools
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
    """Whether this came from the FAQ fast path rather than the full pipeline."""
    from_faq: bool = False


def _faq_answer(question: str) -> Answer | None:
    """Serve a question BIS has already answered, verbatim.

    Returns None when no FAQ matches closely enough, in which case the caller
    runs the full pipeline. The answer text is BIS's own wording - it is not
    regenerated, so there is nothing for a model to get subtly wrong.
    """
    hit = faq_cache.match(question)
    if hit is None:
        return None

    log.info("FAQ fast path matched %.3f: %s", hit.score, hit.entry.question[:70])
    return Answer(
        text=hit.entry.text.strip() + " [S1]",
        sources=[hit.to_source()],
        intent="faq",
        from_faq=True,
    )


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

    # An identical question already answered this session: no guessing, no model
    # calls, and the citations are the ones the pipeline actually produced.
    cached = answer_cache.get(question)
    if cached is not None:
        log.info("answer cache hit")
        return cached

    # Then the verbatim FAQ: one embedding call instead of three model calls,
    # returning BIS's own wording rather than a paraphrase of it.
    fast = _faq_answer(question)
    if fast is not None:
        fast.latency_ms = (time.time() - started) * 1000
        answer_cache.put(question, fast)
        return fast

    state = prepare(question)

    if state["smalltalk"]:
        chat_reply = Answer(
            text=_smalltalk(question),
            intent="smalltalk",
            latency_ms=(time.time() - started) * 1000,
        )
        # Cached like any other answer. Small talk is generated at a higher
        # temperature, so without this the same greeting produces a different
        # reply every time - which reads as flaky rather than conversational.
        answer_cache.put(question, chat_reply)
        return chat_reply

    if state["abstain"]:
        abstention = Answer(
            text=_abstain(question),
            intent=state["intent"],
            abstained=True,
            structured=state["structured"],
            latency_ms=(time.time() - started) * 1000,
        )
        # An abstention is a correct outcome, not a failure to cache.
        answer_cache.put(question, abstention)
        return abstention

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
    if result.uncited:
        # The model was given evidence and answered without citing any of it.
        # That is not necessarily wrong, but it is unverifiable - which for a
        # regulatory assistant is the thing we are trying to avoid. Surfaced so
        # the caller can flag it rather than presenting it as source-backed.
        warnings.append("answer cites no sources despite evidence being retrieved")
        log.warning("uncited answer for a question that retrieved %d passages", len(evidence))
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

    final = Answer(
        text=result.text,
        sources=result.sources,
        intent=state["intent"],
        structured=state["structured"],
        latency_ms=(time.time() - started) * 1000,
        warnings=warnings,
    )
    # Only cache a clean answer. One that dropped a fabricated citation or
    # claimed an unsupported clause should be re-attempted, not replayed.
    if not warnings:
        answer_cache.put(question, final)
    return final


def answer_stream(question: str) -> Iterator[dict]:
    """Answer as a stream of events, matching the SSE contract in docs/.

    Sources are emitted after the text rather than before: only markers the
    model actually used are returned, and that is not known until the answer is
    complete. Validation therefore runs on the accumulated text at the end - the
    tokens themselves stream unvalidated, which is the one compromise streaming
    forces. A dropped marker is corrected in the final `sources` event.
    """
    started = time.time()

    fast = _faq_answer(question)
    if fast is not None:
        yield {"event": "intent", "intent": "faq", "product": None, "is_numbers": []}
        yield {"event": "token", "text": fast.text}
        yield {"event": "sources", "sources": fast.sources}
        yield {
            "event": "done",
            "abstained": False,
            "latency_ms": (time.time() - started) * 1000,
            "from_faq": True,
        }
        return

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
        "uncited": result.uncited,
    }
