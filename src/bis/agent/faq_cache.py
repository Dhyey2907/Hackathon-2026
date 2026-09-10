"""In-memory fast path for questions BIS has already answered verbatim.

105 corpus chunks are literal Q&A pairs lifted from BIS's own FAQ documents.
When a user asks something close enough to one of them, the full pipeline is
wasted work: routing, hybrid search, reranking and generation cost roughly
seven seconds and three model calls to reproduce an answer that already exists,
word for word, in a published BIS document.

This path costs one embedding call and a local dot product - well under a
second - and returns BIS's own wording rather than a paraphrase of it. Nothing
is regenerated, so nothing can drift.

**How well it actually works, measured rather than assumed.** BIS FAQ questions
are long and situational ("My company is sourcing products covered under the
QCOs from ..."), not clean canonical questions, so cosine scores compress
badly. A genuine rephrasing lands around 0.71-0.75; an unrelated question sits
between 0.06 and 0.32; and in testing a verbatim-looking question matched the
*wrong* entry by a margin of 0.002. The separation is real but narrow.

So this path is deliberately conservative and fires on a minority of questions:

  * The threshold sits where only a strong match clears it.
  * The best match must also beat the runner-up by a margin, because a match
    that barely wins is a coin flip between two FAQs.

Everything else falls through to the full pipeline, which is slower and right.
Answering slowly is a cost; answering from the wrong FAQ is a defect.

The cache loads once and lives in memory, removing a database round trip from
the hot path.
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass
from typing import Any

from bis.retrieval import embed as embed_mod
from bis.store import supabase_store

log = logging.getLogger(__name__)

# Measured against the real corpus rather than guessed. The BIS FAQ questions
# are long and situational ("My company is sourcing products covered under the
# QCOs from ..."), so similarity scores compress: a genuine rephrasing lands
# around 0.71-0.75 while an unrelated question sits near 0.06-0.32. The band
# between is narrow, so the bar is set where only a strong match clears it and
# everything else falls through to the full pipeline. Answering slowly is a
# cost; answering from the wrong FAQ is a defect.
MATCH_THRESHOLD = 0.75

# Verbatim-looking questions were observed matching the wrong entry by 0.002 -
# well inside noise. A match that barely beats the runner-up is a coin flip.
MARGIN = 0.05

_entries: list[FaqEntry] | None = None
_lock = threading.Lock()


@dataclass
class FaqEntry:
    chunk_uid: str
    question: str
    text: str
    doc_title: str
    source_url: str | None
    clause: str | None
    page: int | None
    embedding: list[float]


@dataclass
class FaqMatch:
    entry: FaqEntry
    score: float

    def to_source(self) -> dict[str, Any]:
        locator = []
        if self.entry.clause:
            locator.append(f"clause {self.entry.clause}")
        if self.entry.page is not None:
            locator.append(f"p. {self.entry.page}")
        return {
            "marker": "S1",
            "chunk_uid": self.entry.chunk_uid,
            "title": self.entry.doc_title,
            "doc_type": "faq",
            "url": self.entry.source_url,
            "locator": ", ".join(locator) or None,
            "is_number": None,
        }


def _question_of(text: str) -> str:
    """The question line of a Q&A chunk, used as the thing we match against.

    Chunks are stored as "Q6 <question> A6 : <answer>", so the question runs
    from the start to the answer marker. Matching on the question alone keeps
    a long answer's vocabulary from diluting the similarity score.
    """
    body = re.sub(r"^\s*Q\.?\s*\d+\s*[:.)-]?\s*", "", text.strip(), flags=re.IGNORECASE)

    # Most BIS FAQs mark the answer ("A3 :"), and splitting there is exact.
    split = re.split(r"\bA\.?\s*\d*\s*[:.]\s*", body, maxsplit=1)
    if len(split) > 1 and split[0].strip():
        return " ".join(split[0].split())[:400]

    # Some carry no answer marker - the answer simply follows the question.
    # Stopping at the question mark keeps the answer's vocabulary out of the
    # vector, which otherwise drags a short query's similarity down sharply.
    mark = body.find("?")
    if 0 < mark < 400:
        return " ".join(body[: mark + 1].split())

    # Last resort: treat the first line as the question.
    return " ".join(body.splitlines()[0].split())[:400]


def load(force: bool = False) -> list[FaqEntry]:
    """Load Q&A chunks and their vectors. Idempotent and thread-safe."""
    global _entries
    with _lock:
        if _entries is not None and not force:
            return _entries

        try:
            client = supabase_store.get_client()
            response = (
                client.table("chunks")
                .select("chunk_uid,text,doc_title,source_url,clause,page,embedding")
                .eq("doc_type", "faq")
                .not_.is_("clause", "null")
                .not_.is_("embedding", "null")
                .limit(1000)
                .execute()
            )
            rows = response.data or []
        except Exception as exc:
            # A cache that cannot load must not break answering - the full
            # pipeline still works, just without the shortcut.
            log.warning("FAQ cache unavailable, falling back to full pipeline: %s", str(exc)[:160])
            _entries = []
            return _entries

        entries: list[FaqEntry] = []
        for row in rows:
            vector = row.get("embedding")
            if isinstance(vector, str):
                # PostgREST returns pgvector as its text form, "[0.1,0.2,...]".
                try:
                    vector = [float(v) for v in vector.strip("[]").split(",")]
                except ValueError:
                    continue
            if not vector:
                continue
            entries.append(
                FaqEntry(
                    chunk_uid=row["chunk_uid"],
                    question=_question_of(row.get("text") or ""),
                    text=row.get("text") or "",
                    doc_title=row.get("doc_title") or "",
                    source_url=row.get("source_url"),
                    clause=row.get("clause"),
                    page=row.get("page"),
                    embedding=vector,
                )
            )

        # Re-embed the extracted questions rather than reusing the stored chunk
        # vectors. Those cover question *and* answer, so a short user question
        # scores poorly against them - a verbatim match only reached 0.76, close
        # enough to unrelated entries to be unsafe to threshold on. Embedding the
        # question alone helps, though not as much as hoped - see the module
        # docstring on why this path stays conservative.
        # One batched call at startup, then the cache is warm for the process.
        if entries:
            try:
                vectors = embed_mod.embed_documents([e.question for e in entries])
                for entry, vector in zip(entries, vectors, strict=True):
                    entry.embedding = vector
            except Exception as exc:
                log.warning(
                    "could not embed FAQ questions, fast path disabled: %s", str(exc)[:160]
                )
                entries = []

        _entries = entries
        log.info("FAQ fast path loaded %d question/answer pairs", len(entries))
        return _entries


def _cosine(a: list[float], b: list[float]) -> float:
    """Dot product. Both sides are already unit-normalised at embedding time."""
    return sum(x * y for x, y in zip(a, b, strict=False))


def match(question: str, threshold: float = MATCH_THRESHOLD) -> FaqMatch | None:
    """Best FAQ for a question, or None when the pipeline should handle it."""
    entries = load()
    if not entries:
        return None

    try:
        vector = embed_mod.embed_query(question)
    except Exception as exc:
        log.warning("FAQ match skipped, embedding failed: %s", str(exc)[:120])
        return None

    scored = sorted(
        ((_cosine(vector, e.embedding), e) for e in entries),
        key=lambda pair: pair[0],
        reverse=True,
    )
    best_score, best = scored[0]
    runner_up = scored[1][0] if len(scored) > 1 else 0.0

    if best_score < threshold:
        return None
    if best_score - runner_up < MARGIN:
        log.info(
            "FAQ match ambiguous (%.3f vs %.3f); using the full pipeline",
            best_score,
            runner_up,
        )
        return None

    return FaqMatch(entry=best, score=best_score)


def stats() -> dict[str, Any]:
    entries = load()
    return {
        "loaded": len(entries),
        "threshold": MATCH_THRESHOLD,
        "margin": MARGIN,
    }
