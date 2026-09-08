"""Qdrant access: collection setup, hybrid upsert, and dense+sparse search.

The collection carries two named vectors produced by a single bge-m3 pass:
  dense  - 1024-dim cosine
  sparse - lexical weights, which is what keeps exact tokens like "IS 15111"
           or "HUID" retrievable when dense similarity alone would drift.

Fusion is Reciprocal Rank Fusion over the two result lists. RRF is used rather
than score blending because dense cosine and sparse dot scores are not on a
comparable scale, so any weighted sum would be tuning noise.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from qdrant_client import QdrantClient, models

from bis.config import get_settings

DENSE_VECTOR = "dense"
SPARSE_VECTOR = "sparse"
DENSE_DIM = 1024


@dataclass
class Hit:
    """One retrieved passage, before reranking."""

    chunk_uid: str
    text: str
    payload: dict[str, Any] = field(default_factory=dict)
    score: float = 0.0
    dense_rank: int | None = None
    sparse_rank: int | None = None
    rerank_score: float | None = None

    @property
    def doc_type(self) -> str | None:
        return self.payload.get("doc_type")

    @property
    def source_url(self) -> str | None:
        return self.payload.get("source_url")


def is_embedded() -> bool:
    return get_settings().qdrant_url.strip().lower() in {":local:", "local", "embedded"}


@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    """Qdrant client, server-backed or embedded.

    Setting QDRANT_URL to ":local:" runs Qdrant embedded against a directory
    under data/, which removes the Docker dependency for development and for
    demo machines. Embedded mode holds an exclusive lock on that directory, so
    indexing and serving cannot run at the same time - index first, then serve.
    A real server is the better choice once both need to run concurrently.
    """
    url = get_settings().qdrant_url
    if is_embedded():
        from bis.config import DATA_DIR

        path = DATA_DIR / "qdrant"
        path.mkdir(parents=True, exist_ok=True)
        return QdrantClient(path=str(path))
    return QdrantClient(url=url, timeout=30)


def ensure_collection(recreate: bool = False) -> None:
    """Create the collection and the payload indexes used for filtering."""
    settings = get_settings()
    client = get_client()
    name = settings.qdrant_collection

    exists = client.collection_exists(name)
    if exists and recreate:
        client.delete_collection(name)
        exists = False

    if not exists:
        client.create_collection(
            collection_name=name,
            vectors_config={
                DENSE_VECTOR: models.VectorParams(
                    size=DENSE_DIM, distance=models.Distance.COSINE
                )
            },
            sparse_vectors_config={
                SPARSE_VECTOR: models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=False)
                )
            },
        )

    if is_embedded():
        # Embedded Qdrant filters by scanning payloads; indexes are a no-op there.
        return

    for field_name, schema in (
        ("doc_type", models.PayloadSchemaType.KEYWORD),
        ("is_number", models.PayloadSchemaType.KEYWORD),
        ("ics_code", models.PayloadSchemaType.KEYWORD),
        ("language", models.PayloadSchemaType.KEYWORD),
    ):
        try:
            client.create_payload_index(
                collection_name=name, field_name=field_name, field_schema=schema
            )
        except Exception:
            # Index already present - Qdrant has no idempotent create.
            pass


def upsert_chunks(points: list[models.PointStruct], batch_size: int = 64) -> int:
    """Upsert pre-built points in batches. Returns the number written."""
    client = get_client()
    name = get_settings().qdrant_collection
    written = 0
    for start in range(0, len(points), batch_size):
        batch = points[start : start + batch_size]
        client.upsert(collection_name=name, points=batch, wait=True)
        written += len(batch)
    return written


def build_point(
    point_id: str | int,
    dense: list[float],
    sparse: dict[int, float],
    payload: dict[str, Any],
) -> models.PointStruct:
    return models.PointStruct(
        id=point_id,
        vector={
            DENSE_VECTOR: dense,
            SPARSE_VECTOR: models.SparseVector(
                indices=list(sparse.keys()), values=list(sparse.values())
            ),
        },
        payload=payload,
    )


def _to_filter(filters: dict[str, Any] | None) -> models.Filter | None:
    if not filters:
        return None
    conditions = []
    for key, value in filters.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple, set)):
            conditions.append(
                models.FieldCondition(key=key, match=models.MatchAny(any=list(value)))
            )
        else:
            conditions.append(
                models.FieldCondition(key=key, match=models.MatchValue(value=value))
            )
    return models.Filter(must=conditions) if conditions else None


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]], k: int = 60, weights: list[float] | None = None
) -> dict[str, float]:
    """Fuse ranked id lists into {id: score}. Higher is better.

    Standard RRF: an item at rank r (0-based) in a list contributes 1/(k+r+1).
    k damps the influence of the very top positions so one confident-but-wrong
    list cannot dominate the fusion.
    """
    if weights is None:
        weights = [1.0] * len(ranked_lists)
    if len(weights) != len(ranked_lists):
        raise ValueError("weights must match ranked_lists in length")

    scores: dict[str, float] = {}
    for ranked, weight in zip(ranked_lists, weights, strict=True):
        for rank, item_id in enumerate(ranked):
            scores[item_id] = scores.get(item_id, 0.0) + weight / (k + rank + 1)
    return scores


def hybrid_search(
    dense: list[float],
    sparse: dict[int, float],
    limit: int | None = None,
    filters: dict[str, Any] | None = None,
) -> list[Hit]:
    """Query both vectors, fuse with RRF, return `limit` hits best-first."""
    settings = get_settings()
    limit = limit or settings.retrieve_top_k
    client = get_client()
    name = settings.qdrant_collection
    qfilter = _to_filter(filters)
    # Over-fetch each arm so fusion has room to reorder.
    arm_limit = max(limit * 2, limit + 10)

    dense_res = client.query_points(
        collection_name=name,
        query=dense,
        using=DENSE_VECTOR,
        limit=arm_limit,
        query_filter=qfilter,
        with_payload=True,
    ).points

    sparse_res = []
    if sparse:
        sparse_res = client.query_points(
            collection_name=name,
            query=models.SparseVector(
                indices=list(sparse.keys()), values=list(sparse.values())
            ),
            using=SPARSE_VECTOR,
            limit=arm_limit,
            query_filter=qfilter,
            with_payload=True,
        ).points

    by_uid: dict[str, Hit] = {}
    dense_ids: list[str] = []
    sparse_ids: list[str] = []

    for rank, point in enumerate(dense_res):
        uid = str(point.payload.get("chunk_uid", point.id))
        dense_ids.append(uid)
        by_uid.setdefault(
            uid,
            Hit(
                chunk_uid=uid,
                text=point.payload.get("text", ""),
                payload=dict(point.payload),
            ),
        ).dense_rank = rank

    for rank, point in enumerate(sparse_res):
        uid = str(point.payload.get("chunk_uid", point.id))
        sparse_ids.append(uid)
        by_uid.setdefault(
            uid,
            Hit(
                chunk_uid=uid,
                text=point.payload.get("text", ""),
                payload=dict(point.payload),
            ),
        ).sparse_rank = rank

    fused = reciprocal_rank_fusion([dense_ids, sparse_ids], k=settings.rrf_k)
    for uid, score in fused.items():
        by_uid[uid].score = score

    return sorted(by_uid.values(), key=lambda h: h.score, reverse=True)[:limit]


def count() -> int:
    client = get_client()
    name = get_settings().qdrant_collection
    if not client.collection_exists(name):
        return 0
    return client.count(collection_name=name, exact=True).count
