"""Cache of answers the pipeline has already produced.

The FAQ fast path in faq_cache.py guesses whether two questions mean the same
thing, and measurement showed that guess is only safe for strong matches. This
cache makes no guess at all: it returns a previous answer only when the question
normalises to exactly the same string, so what comes back is byte-for-byte what
the full pipeline produced, citations and all.

That makes it accurate by construction, and it covers the case that actually
matters in a demo or a classroom: the same handful of questions asked over and
over. A repeat costs no model calls and returns in single-digit milliseconds
instead of about seven seconds.

Two deliberate limits:

  * Abstentions are cached too. An abstention is a real, correct outcome, and
    re-running the pipeline to abstain again is pure cost.
  * Nothing is cached across restarts. The corpus changes as documents are
    ingested, and a stale answer citing a passage that no longer exists is
    exactly the failure the citation validator is there to prevent.
"""

from __future__ import annotations

import logging
import re
import threading
from collections import OrderedDict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from bis.agent.answer import Answer

log = logging.getLogger(__name__)

# Small on purpose. The working set is the questions a person actually repeats;
# beyond that, retrieval is cheap enough not to need a large cache.
MAX_ENTRIES = 256

_cache: OrderedDict[str, Answer] = OrderedDict()
_lock = threading.Lock()
_hits = 0
_misses = 0


def normalise(question: str) -> str:
    """Key for a question.

    Case, surrounding whitespace and trailing punctuation are noise - "What is
    FMCS?", "what is fmcs" and "What is FMCS ?" are the same question. Anything
    beyond that is left alone: two questions that differ by a real word are
    different questions, and deciding otherwise is the guess this cache exists
    to avoid.
    """
    text = " ".join((question or "").split()).casefold()
    return re.sub(r"[?!.\s]+$", "", text)


def get(question: str) -> Answer | None:
    global _hits, _misses
    key = normalise(question)
    with _lock:
        answer = _cache.get(key)
        if answer is None:
            _misses += 1
            return None
        # Refresh recency so the questions being asked stay resident.
        _cache.move_to_end(key)
        _hits += 1
        return answer


def put(question: str, answer: Answer) -> None:
    key = normalise(question)
    if not key:
        return
    with _lock:
        _cache[key] = answer
        _cache.move_to_end(key)
        while len(_cache) > MAX_ENTRIES:
            _cache.popitem(last=False)


def clear() -> None:
    """Drop every entry. Call after re-ingesting, so answers cannot go stale."""
    global _hits, _misses
    with _lock:
        _cache.clear()
        _hits = 0
        _misses = 0


def stats() -> dict[str, int | float]:
    with _lock:
        total = _hits + _misses
        return {
            "entries": len(_cache),
            "hits": _hits,
            "misses": _misses,
            "hit_rate": round(_hits / total, 3) if total else 0.0,
        }
