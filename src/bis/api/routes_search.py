"""Catalogue and lab lookup endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from bis.retrieval import embed as embed_mod
from bis.store import supabase_store

router = APIRouter(tags=["catalogue"])


@router.get("/standards/search")
def search_standards(
    q: str = Query(min_length=2, max_length=300),
    limit: int = Query(20, ge=1, le=50),
) -> dict:
    """Hybrid search over the catalogue."""
    vector = embed_mod.embed_query(q)
    hits = supabase_store.search_standards(vector, q, limit=limit)
    results = [
        {
            "is_number": h.payload.get("is_number"),
            "title": h.payload.get("doc_title"),
            "committee": h.payload.get("committee"),
            "division": h.payload.get("division"),
            "year": h.payload.get("year"),
            "source_url": h.payload.get("source_url"),
            "score": h.score,
        }
        for h in hits
    ]
    return {"results": results, "total": len(results)}


@router.get("/standards/{is_number:path}")
def get_standard(is_number: str) -> dict:
    """One standard, plus others sharing its committee."""
    record = supabase_store.get_standard(is_number)
    if record is None:
        matches = supabase_store.lookup_standards(is_number, limit=10)
        if not matches:
            raise HTTPException(status_code=404, detail=f"{is_number} not found")
        # A bare number like "IS 302" names a family rather than one document.
        return {"standard": None, "matches": matches}

    record.pop("embedding", None)
    related = []
    if record.get("committee"):
        related = supabase_store.standards_by_committee(
            record["committee"], exclude=record["is_number"]
        )
    return {"standard": record, "related": related}


@router.get("/labs")
def list_labs(
    state: str | None = None,
    scope: str | None = None,
    q: str | None = None,
    recognised_only: bool = False,
    limit: int = Query(50, ge=1, le=1000),
) -> dict:
    """The BIS laboratory directory, from the published Group 1 and 2 lists.

    The limit runs to 1000 because the interface offers the whole directory
    with client-side filters; 790 rows is a small enough payload to send once
    rather than round-trip on every keystroke.
    """
    results = supabase_store.find_labs(
        state=state, scope=scope, q=q, recognised_only=recognised_only, limit=limit
    )
    return {"results": results, "total": len(results)}
