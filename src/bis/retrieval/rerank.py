"""Reranking via a small Groq model.

The original design used a bge cross-encoder, but nothing is downloaded locally
any more and Gemini publishes no reranker, so relevance scoring is done by
`openai/gpt-oss-20b` instead.

This is a real trade-off and worth stating plainly: a trained cross-encoder is
better and cheaper per candidate than an LLM asked to score. What this buys is
a hosted stack with no local weights. To keep the cost sane the model scores the
whole candidate list in **one** call rather than one call per passage, and sees
truncated passages - enough to judge relevance, not enough to blow the context.

Reranking matters more than its size suggests: hybrid search optimises for
recall and happily returns 30 loosely-related passages, and it is this step that
decides which 6 the model actually gets to cite.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from bis.config import get_settings
from bis.llm import chat_json

log = logging.getLogger(__name__)

# Enough of a passage to judge relevance without paying for the whole thing.
SNIPPET_CHARS = 700

# Candidates scoring below this are dropped even if that returns fewer than
# top_k. Hybrid search optimises for recall, so the tail of the list is often
# plainly off-topic - a cement passage under a hallmarking question - and
# handing that to the answer model is an invitation to cite it. Fewer, better
# passages beat a padded context.
MIN_RELEVANCE = 0.3

SYSTEM_PROMPT = """You rank passages by how well they answer a user's question \
about Indian Standards and BIS services.

Score each passage from 0 to 10:
  0-2  unrelated
  3-5  same topic, does not answer the question
  6-8  partially answers it
  9-10 directly answers it

Judge only relevance to the question. Do not reward length, authority or \
confident tone. A short passage that answers the question outranks a long one \
that circles it.

Return strict JSON: {"scores": [{"id": <passage id>, "score": <0-10>}, ...]} \
with one entry for every passage id you were given."""


def _build_prompt(query: str, hits: list[Any]) -> str:
    blocks = []
    for i, hit in enumerate(hits):
        text = (getattr(hit, "text", "") or "")[:SNIPPET_CHARS]
        payload = getattr(hit, "payload", {}) or {}
        title = payload.get("doc_title") or payload.get("is_number") or ""
        blocks.append(f"[{i}] {title}\n{text}")
    passages = "\n\n---\n\n".join(blocks)
    return f"QUESTION:\n{query}\n\nPASSAGES:\n{passages}"


def rerank(query: str, hits: list[Any], top_k: int | None = None) -> list[Any]:
    """Score candidates against the query and return the best `top_k`.

    Falls back to the fusion order if scoring fails. A degraded ranking is far
    better than no answer, and the retrieval scores are already a reasonable
    ordering on their own.
    """
    settings = get_settings()
    top_k = top_k or settings.rerank_top_k

    if not hits:
        return []
    if len(hits) <= top_k:
        for hit in hits:
            hit.rerank_score = getattr(hit, "score", 0.0)
        return hits

    try:
        result = chat_json(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_prompt(query, hits)},
            ],
            model=settings.rerank_model,
            default={},
        )
        scores = {
            int(entry["id"]): float(entry["score"])
            for entry in result.get("scores", [])
            if isinstance(entry, dict) and "id" in entry and "score" in entry
        }
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        log.warning("rerank failed, falling back to fusion order: %s", exc)
        for hit in hits:
            hit.rerank_score = getattr(hit, "score", 0.0)
        return hits[:top_k]

    if not scores:
        log.warning("reranker returned no usable scores; keeping fusion order")
        for hit in hits:
            hit.rerank_score = getattr(hit, "score", 0.0)
        return hits[:top_k]

    for i, hit in enumerate(hits):
        # A passage the model skipped keeps a neutral score rather than being
        # dropped, so an incomplete response cannot silently discard evidence.
        hit.rerank_score = scores.get(i, 5.0) / 10.0

    ranked = sorted(hits, key=lambda h: h.rerank_score or 0.0, reverse=True)
    kept = [h for h in ranked[:top_k] if (h.rerank_score or 0.0) >= MIN_RELEVANCE]

    # Keep the single best candidate even when it is below the floor, so the
    # weak-evidence check downstream has something to measure and can abstain
    # explicitly rather than silently receiving an empty list.
    return kept or ranked[:1]


def evidence_is_weak(hits: list[Any]) -> bool:
    """Whether the top evidence is too weak to answer from.

    Drives abstention. Uses the mean of the top three rather than the single
    best score, so one lucky match cannot carry an otherwise empty result set.
    """
    settings = get_settings()
    if not hits:
        return True
    top = hits[: min(3, len(hits))]
    scores = [h.rerank_score if h.rerank_score is not None else h.score for h in top]
    return (sum(scores) / len(scores)) < settings.min_evidence_score
