"""Embeddings via the Google Gemini API.

Everything runs on hosted APIs - no model weights are downloaded locally.
Groq has no embedding endpoint, so embeddings come from Gemini instead.

Two details that are easy to get wrong:

1. **Dimensions.** gemini-embedding-001 returns 3072 dimensions by default, but
   pgvector's HNSW index caps at 2000, so the index simply cannot be built on a
   3072-dim column. The model supports Matryoshka truncation, so we request
   1536 and normalise afterwards. Google normalises the 3072-dim output but not
   truncated outputs, so skipping that step quietly degrades cosine similarity.

2. **Task types.** Gemini embeddings are asymmetric: passages must be embedded
   with RETRIEVAL_DOCUMENT and queries with RETRIEVAL_QUERY. Using one type for
   both still returns plausible vectors and measurably worse retrieval, which
   is a hard bug to notice without an evaluation set.
"""

from __future__ import annotations

import logging
import math
import time
from functools import lru_cache

from bis.config import get_settings

log = logging.getLogger(__name__)

# The API rejects oversized batches; 100 inputs per call is comfortably inside
# the limit and keeps a 6k-row backfill to ~60 calls.
BATCH_SIZE = 100

TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"
TASK_QUERY = "RETRIEVAL_QUERY"


class EmbeddingError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def get_client():
    from google import genai

    settings = get_settings()
    if not settings.gemini_api_key:
        raise EmbeddingError(
            "GEMINI_API_KEY is not set - get one at https://aistudio.google.com/apikey"
        )
    return genai.Client(api_key=settings.gemini_api_key)


def _normalise(vector: list[float]) -> list[float]:
    """Scale to unit length so cosine distance behaves.

    Required because Gemini only normalises its full 3072-dim output; a
    truncated 1536-dim vector comes back unnormalised.
    """
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


def _embed_batch(texts: list[str], task_type: str, retries: int = 4) -> list[list[float]]:
    from google.genai import types

    settings = get_settings()
    client = get_client()

    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = client.models.embed_content(
                model=settings.embed_model,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=settings.embed_dimensions,
                ),
            )
            return [_normalise(list(e.values)) for e in response.embeddings]
        except Exception as exc:
            last_error = exc
            # Free-tier quota is per-minute, so backing off well past a second
            # is usually what clears a 429 rather than an immediate retry.
            wait = min(2**attempt * 5, 60)
            log.warning(
                "embed batch failed (attempt %d/%d): %s - retrying in %ds",
                attempt + 1,
                retries,
                str(exc)[:160],
                wait,
            )
            time.sleep(wait)

    raise EmbeddingError(f"embedding failed after {retries} attempts: {last_error}")


def embed_documents(
    texts: list[str], batch_size: int = BATCH_SIZE, progress: bool = False
) -> list[list[float]]:
    """Embed passages for indexing."""
    vectors: list[list[float]] = []
    total = len(texts)
    for start in range(0, total, batch_size):
        batch = texts[start : start + batch_size]
        vectors.extend(_embed_batch(batch, TASK_DOCUMENT))
        if progress:
            log.info("embedded %d/%d", min(start + batch_size, total), total)
    return vectors


def embed_query(text: str) -> list[float]:
    """Embed a single query."""
    return _embed_batch([text], TASK_QUERY)[0]


def health() -> dict:
    """Cheap reachability probe used by GET /health."""
    settings = get_settings()
    info: dict = {
        "model": settings.embed_model,
        "dimensions": settings.embed_dimensions,
        "provider": "google-gemini",
    }
    if not settings.gemini_api_key:
        info["ok"] = False
        info["detail"] = "GEMINI_API_KEY not set"
        return info
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
