"""Supabase (Postgres + pgvector) store and hybrid search.

Access goes through the REST API rather than a direct Postgres connection: the
project's database host resolves to IPv6 only, which many networks - including
this one - cannot reach. The REST endpoint is plain IPv4 HTTPS and works
everywhere, which also makes deployment simpler.

Hybrid search itself lives in Postgres as the match_chunks / match_standards
functions (see supabase/migrations/0001_init.sql). Fusing dense and lexical
results server-side means one round trip instead of two plus client-side
merging, and Postgres already has both indexes in front of it.

Reads use the publishable key; writes use the service key, which only the
ingestion scripts need.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from bis.config import get_settings

log = logging.getLogger(__name__)


class StoreError(RuntimeError):
    pass


@dataclass
class Hit:
    """One retrieved passage, before reranking."""

    chunk_uid: str
    text: str
    payload: dict[str, Any] = field(default_factory=dict)
    score: float = 0.0
    rerank_score: float | None = None

    @property
    def doc_type(self) -> str | None:
        return self.payload.get("doc_type")

    @property
    def source_url(self) -> str | None:
        return self.payload.get("source_url")


def _client(write: bool = False):
    from supabase import create_client

    settings = get_settings()
    if not settings.supabase_url:
        raise StoreError("SUPABASE_URL is not set")

    key = settings.supabase_service_key if write else settings.supabase_key
    if not key:
        which = "SUPABASE_SERVICE_KEY" if write else "SUPABASE_KEY"
        raise StoreError(f"{which} is not set")
    return create_client(settings.supabase_url, key)


@lru_cache(maxsize=1)
def get_client():
    """Read client (publishable key)."""
    return _client(write=False)


@lru_cache(maxsize=1)
def get_write_client():
    """Write client (service key) - ingestion only."""
    return _client(write=True)


# --------------------------------------------------------------- writing


def upsert_standards(rows: list[dict[str, Any]], batch_size: int = 200) -> int:
    """Upsert catalogue rows keyed by is_number."""
    client = get_write_client()
    written = 0
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        client.table("standards").upsert(batch, on_conflict="is_number").execute()
        written += len(batch)
        log.info("standards upserted %d/%d", written, len(rows))
    return written


def upsert_chunks(rows: list[dict[str, Any]], batch_size: int = 200) -> int:
    """Upsert chunk rows keyed by chunk_uid."""
    client = get_write_client()
    written = 0
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        client.table("chunks").upsert(batch, on_conflict="chunk_uid").execute()
        written += len(batch)
        log.info("chunks upserted %d/%d", written, len(rows))
    return written


def standards_missing_embeddings(limit: int = 500) -> list[dict[str, Any]]:
    """Catalogue rows not yet embedded, so a backfill can resume after a crash."""
    client = get_write_client()
    response = (
        client.table("standards")
        .select("is_number,title,committee")
        .is_("embedding", "null")
        .limit(limit)
        .execute()
    )
    return response.data or []


# --------------------------------------------------------------- searching


def search_chunks(
    query_embedding: list[float],
    query_text: str,
    limit: int | None = None,
    doc_type: str | None = None,
) -> list[Hit]:
    """Hybrid dense + lexical search over document passages."""
    settings = get_settings()
    client = get_client()
    response = client.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "query_text": query_text,
            "match_limit": limit or settings.retrieve_top_k,
            "rrf_k": settings.rrf_k,
            "filter_doc_type": doc_type,
        },
    ).execute()

    hits: list[Hit] = []
    for row in response.data or []:
        hits.append(
            Hit(
                chunk_uid=row["chunk_uid"],
                text=row.get("text", ""),
                score=float(row.get("score") or 0.0),
                payload={
                    "doc_title": row.get("doc_title"),
                    "doc_type": row.get("doc_type"),
                    "source_url": row.get("source_url"),
                    "clause": row.get("clause"),
                    "page": row.get("page"),
                    "is_number": row.get("is_number"),
                },
            )
        )
    return hits


def search_standards(
    query_embedding: list[float],
    query_text: str,
    limit: int = 20,
    group_key: str | None = None,
) -> list[Hit]:
    """Hybrid search over the catalogue, for "which standard applies?" queries.

    Returned as Hits so the answer layer treats catalogue matches and document
    passages uniformly; doc_type is set to "catalogue" so prompts and the UI can
    tell the user this is a standard's identity and scope, not its clause text.
    """
    settings = get_settings()
    client = get_client()
    response = client.rpc(
        "match_standards",
        {
            "query_embedding": query_embedding,
            "query_text": query_text,
            "match_limit": limit,
            "rrf_k": settings.rrf_k,
            "filter_group": group_key,
        },
    ).execute()

    hits: list[Hit] = []
    for row in response.data or []:
        title = row.get("title") or ""
        hits.append(
            Hit(
                chunk_uid=row["is_number"],
                text=f"{row['is_number']} - {title}",
                score=float(row.get("score") or 0.0),
                payload={
                    "doc_title": title,
                    "doc_type": "catalogue",
                    "source_url": row.get("source_url"),
                    "is_number": row["is_number"],
                    "committee": row.get("committee"),
                    "year": row.get("year"),
                    "clause": None,
                    "page": None,
                },
            )
        )
    return hits


def get_standard(is_number: str) -> dict[str, Any] | None:
    client = get_client()
    response = (
        client.table("standards").select("*").eq("is_number", is_number).limit(1).execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def lookup_standards(pattern: str, limit: int = 10) -> list[dict[str, Any]]:
    """Prefix match on standard number, e.g. "IS 302" finds all its parts."""
    client = get_client()
    response = (
        client.table("standards")
        .select("is_number,title,committee,year,source_url")
        .ilike("is_number", f"{pattern}%")
        .limit(limit)
        .execute()
    )
    return response.data or []


def standards_by_committee(
    committee: str, exclude: str | None = None, limit: int = 8
) -> list[dict[str, Any]]:
    """Other standards owned by the same sectional committee.

    Committee is a better relatedness signal than title similarity here: BIS
    committees are the working groups that actually maintain a family of
    standards, so siblings are genuinely relevant rather than merely worded
    alike.
    """
    client = get_client()
    query = (
        client.table("standards")
        .select("is_number,title,committee,year,source_url")
        .eq("committee", committee)
    )
    if exclude:
        query = query.neq("is_number", exclude)
    return query.limit(limit).execute().data or []


def find_labs(
    state: str | None = None, scope: str | None = None, limit: int = 20
) -> list[dict[str, Any]]:
    client = get_client()
    query = client.table("labs").select("*")
    if state:
        query = query.ilike("state", f"%{state}%")
    if scope:
        query = query.ilike("scope", f"%{scope}%")
    return query.limit(limit).execute().data or []


def counts() -> dict[str, int]:
    """Row counts, used by GET /health."""
    client = get_client()
    result: dict[str, int] = {}
    for table in ("standards", "chunks", "labs"):
        try:
            response = (
                client.table(table).select("*", count="exact", head=True).execute()
            )
            result[table] = response.count or 0
        except Exception:
            result[table] = -1
    return result


def health() -> dict:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        return {"ok": False, "detail": "SUPABASE_URL / SUPABASE_KEY not set"}
    try:
        return {"ok": True, "url": settings.supabase_url, "rows": counts()}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)[:200]}
