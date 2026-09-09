"""Embeddings via a hosted API. Nothing is downloaded locally.

Two providers, selected by EMBED_PROVIDER:

  jina    - jina-embeddings-v3 (default). Free tier is ~1M tokens with no card,
            which covers this corpus several times over.
  gemini  - gemini-embedding-001. Works, but the free tier allows only
            1,000 embedded items *per day*, so a 6.2k-row corpus takes a week.
            Fine on a paid tier.

Three details that are easy to get wrong, and that quietly degrade retrieval
rather than failing loudly:

1. **Never mix providers in one column.** Vectors from different models are not
   comparable, so a half-Gemini half-Jina table returns confident nonsense.
   Changing provider means re-embedding everything and resizing the column.

2. **Task types are asymmetric.** Passages and queries must be embedded
   differently - Jina calls this retrieval.passage / retrieval.query, Gemini
   RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY. Using one for both still returns
   plausible vectors and measurably worse retrieval.

3. **Truncated vectors need re-normalising.** Both providers support Matryoshka
   truncation and neither guarantees unit length afterwards, which is what
   cosine distance assumes.
"""

from __future__ import annotations

import logging
import math
import re
import time
from functools import lru_cache

import httpx

from bis.config import get_settings

log = logging.getLogger(__name__)

JINA_URL = "https://api.jina.ai/v1/embeddings"

# Jina accepts large batches; 128 keeps request bodies modest and retries cheap.
JINA_BATCH = 128
GEMINI_BATCH = 100

# Gemini's free tier counts each item in a batch as one request against a
# 100/minute limit, so calls must be spaced. Jina's free tier is token-based
# and needs no pacing.
GEMINI_MIN_INTERVAL = 62.0

_last_gemini_call = 0.0


class EmbeddingError(RuntimeError):
    pass


def _normalise(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    return vector if norm == 0 else [v / norm for v in vector]


def _retry_delay(error: str, attempt: int) -> float:
    """Honour a server-supplied retry hint when there is one."""
    match = re.search(r"retry in ([0-9.]+)s", error)
    if match:
        return min(float(match.group(1)) + 2, 120)
    return min(2**attempt * 3, 60)


# ------------------------------------------------------------------ jina


def _jina_batch(texts: list[str], task: str, retries: int = 5) -> list[list[float]]:
    settings = get_settings()
    if not settings.jina_api_key:
        raise EmbeddingError(
            "JINA_API_KEY is not set - get a free key at https://jina.ai/embeddings"
        )

    payload = {
        "model": settings.embed_model,
        "task": task,
        "dimensions": settings.embed_dimensions,
        "input": texts,
    }
    headers = {
        "Authorization": f"Bearer {settings.jina_api_key}",
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = httpx.post(JINA_URL, json=payload, headers=headers, timeout=120)
            response.raise_for_status()
            rows = response.json()["data"]
            # Sort by the index the API returns rather than assuming the
            # response preserves input order.
            rows = sorted(rows, key=lambda d: d["index"])
            if len(rows) != len(texts):
                raise EmbeddingError(f"expected {len(texts)} embeddings, got {len(rows)}")
            return [_normalise(r["embedding"]) for r in rows]
        except Exception as exc:
            last_error = exc
            wait = _retry_delay(str(exc), attempt)
            log.warning(
                "jina batch failed (attempt %d/%d): %s - retrying in %.0fs",
                attempt + 1,
                retries,
                str(exc)[:160],
                wait,
            )
            time.sleep(wait)

    raise EmbeddingError(f"jina embedding failed after {retries} attempts: {last_error}")


# ---------------------------------------------------------------- gemini


@lru_cache(maxsize=1)
def _gemini_client():
    from google import genai

    settings = get_settings()
    if not settings.gemini_api_key:
        raise EmbeddingError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=settings.gemini_api_key)


def _gemini_batch(texts: list[str], task: str, retries: int = 6) -> list[list[float]]:
    global _last_gemini_call
    from google.genai import types

    settings = get_settings()
    client = _gemini_client()

    last_error: Exception | None = None
    for attempt in range(retries):
        gap = time.monotonic() - _last_gemini_call
        if gap < GEMINI_MIN_INTERVAL:
            time.sleep(GEMINI_MIN_INTERVAL - gap)
        _last_gemini_call = time.monotonic()
        try:
            response = client.models.embed_content(
                model=settings.embed_model,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type=task, output_dimensionality=settings.embed_dimensions
                ),
            )
            return [_normalise(list(e.values)) for e in response.embeddings]
        except Exception as exc:
            last_error = exc
            wait = _retry_delay(str(exc), attempt)
            log.warning(
                "gemini batch failed (attempt %d/%d): %s - retrying in %.0fs",
                attempt + 1,
                retries,
                str(exc)[:160],
                wait,
            )
            time.sleep(wait)

    raise EmbeddingError(f"gemini embedding failed after {retries} attempts: {last_error}")


# ---------------------------------------------------------------- public

_TASKS = {
    "jina": {"document": "retrieval.passage", "query": "retrieval.query"},
    "gemini": {"document": "RETRIEVAL_DOCUMENT", "query": "RETRIEVAL_QUERY"},
}


def _provider() -> str:
    provider = get_settings().embed_provider.strip().lower()
    if provider not in _TASKS:
        raise EmbeddingError(f"unknown EMBED_PROVIDER {provider!r}")
    return provider


def _batch_size() -> int:
    return JINA_BATCH if _provider() == "jina" else GEMINI_BATCH


def _embed(texts: list[str], kind: str) -> list[list[float]]:
    provider = _provider()
    task = _TASKS[provider][kind]
    if provider == "jina":
        return _jina_batch(texts, task)
    return _gemini_batch(texts, task)


def embed_documents(
    texts: list[str], batch_size: int | None = None, progress: bool = False
) -> list[list[float]]:
    """Embed passages for indexing."""
    size = batch_size or _batch_size()
    vectors: list[list[float]] = []
    for start in range(0, len(texts), size):
        vectors.extend(_embed(texts[start : start + size], "document"))
        if progress:
            log.info("embedded %d/%d", min(start + size, len(texts)), len(texts))
    return vectors


def embed_query(text: str) -> list[float]:
    """Embed a single query."""
    return _embed([text], "query")[0]


def health() -> dict:
    settings = get_settings()
    info: dict = {
        "provider": settings.embed_provider,
        "model": settings.embed_model,
        "dimensions": settings.embed_dimensions,
    }
    try:
        vector = embed_query("ping")
        info["ok"] = len(vector) == settings.embed_dimensions
        info["returned_dimensions"] = len(vector)
        if not info["ok"]:
            info["detail"] = "unexpected dimension count"
    except Exception as exc:
        info["ok"] = False
        info["detail"] = str(exc)[:200]
    return info
