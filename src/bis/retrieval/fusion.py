"""Reciprocal Rank Fusion for merging ranked result lists.

Postgres fuses the dense and lexical arms inside match_chunks / match_standards,
so this module is not for that. It is for the client side, where a single
question often needs both RPCs - "which standard applies, and what does the
scheme require" searches the catalogue and the document passages - and the two
result sets have to be merged before reranking.

RRF is used rather than blending scores because the two lists are not on a
comparable scale, and after the SQL fusion step they are not even the same kind
of quantity. Only the rank ordering is meaningful across lists.
"""

from __future__ import annotations

from typing import Any


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]], k: int = 60, weights: list[float] | None = None
) -> dict[str, float]:
    """Fuse ranked id lists into {id: score}. Higher is better.

    An item at rank r (0-based) in a list contributes 1/(k+r+1). k damps the
    influence of the very top positions, so one confident-but-wrong list cannot
    dominate the fusion.
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


def fuse_hits(
    hit_lists: list[list[Any]], k: int = 60, weights: list[float] | None = None
) -> list[Any]:
    """Merge several Hit lists into one, ordered best-first.

    Hits are de-duplicated by chunk_uid; the first occurrence wins, so whichever
    list ranked an item higher supplies the object that survives.
    """
    by_uid: dict[str, Any] = {}
    ranked_ids: list[list[str]] = []

    for hits in hit_lists:
        ids = []
        for hit in hits:
            uid = hit.chunk_uid
            ids.append(uid)
            by_uid.setdefault(uid, hit)
        ranked_ids.append(ids)

    fused = reciprocal_rank_fusion(ranked_ids, k=k, weights=weights)
    for uid, score in fused.items():
        by_uid[uid].score = score

    return sorted(by_uid.values(), key=lambda h: h.score, reverse=True)
