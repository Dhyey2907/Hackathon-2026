"""Retrieval tools, one per intent.

Each tool returns (hits, structured). `hits` becomes the cited evidence;
`structured` carries data the API can render directly - a lab table, a list of
standards - without the model having to reformat it into prose.
"""

from __future__ import annotations

import logging
from typing import Any

from bis.retrieval import embed as embed_mod
from bis.retrieval.fusion import fuse_hits
from bis.store import supabase_store
from bis.store.supabase_store import Hit

log = logging.getLogger(__name__)

# Document types each intent should search. Retrieval is filtered rather than
# global because a hallmarking question that surfaces cement scheme text wastes
# the reranker's budget and risks an off-target citation.
INTENT_DOC_TYPES: dict[str, str | None] = {
    "certification": None,
    "hallmarking": None,
    "consumer": None,
}


def _embed(text: str) -> list[float]:
    return embed_mod.embed_query(text)


def recommend_standards(
    question: str, product: str | None = None, limit: int = 12
) -> tuple[list[Hit], dict[str, Any]]:
    """Which standards apply to a described product.

    Searches the catalogue on the product description where the router found
    one, falling back to the whole question. The product phrase alone is the
    better query - "I manufacture LED bulbs, what licence do I need" carries a
    lot of words that describe the user's situation rather than the standard.
    """
    query = product or question
    vector = _embed(query)
    hits = supabase_store.search_standards(vector, query, limit=limit)

    standards = [
        {
            "is_number": h.payload.get("is_number"),
            "title": h.payload.get("doc_title"),
            "committee": h.payload.get("committee"),
            "year": h.payload.get("year"),
            "url": h.payload.get("source_url"),
        }
        for h in hits
    ]
    return hits, {"standards": standards, "query": query}


def standard_lookup(
    question: str, is_numbers: list[str], limit: int = 10
) -> tuple[list[Hit], dict[str, Any]]:
    """Look up specific standards by number, plus any passages that mention them.

    Exact prefix lookup comes first so that "IS 302" reliably returns IS 302 and
    all its parts rather than whatever the vector search considers similar.
    """
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for number in is_numbers:
        for row in supabase_store.lookup_standards(number, limit=limit):
            if row["is_number"] not in seen:
                seen.add(row["is_number"])
                records.append(row)

    hits = [
        Hit(
            chunk_uid=row["is_number"],
            text=f"{row['is_number']} - {row.get('title') or ''}",
            score=1.0,
            payload={
                "doc_title": row.get("title"),
                "doc_type": "catalogue",
                "source_url": row.get("source_url"),
                "is_number": row["is_number"],
                "committee": row.get("committee"),
                "year": row.get("year"),
            },
        )
        for row in records
    ]

    # Passages that discuss the standard - scheme text, QCOs - add the detail
    # the catalogue row cannot provide.
    if question:
        vector = _embed(question)
        hits = fuse_hits([hits, supabase_store.search_chunks(vector, question)])

    return hits, {"standards": records}


def passage_search(
    question: str, doc_type: str | None = None, limit: int | None = None
) -> tuple[list[Hit], dict[str, Any]]:
    """Search document passages - schemes, QCOs, hallmarking, consumer material."""
    vector = _embed(question)
    hits = supabase_store.search_chunks(vector, question, limit=limit, doc_type=doc_type)
    return hits, {}


def find_labs(
    question: str, state: str | None = None, product: str | None = None
) -> tuple[list[Hit], dict[str, Any]]:
    """Recognised testing laboratories, filtered by state and scope."""
    rows = supabase_store.find_labs(state=state, scope=product)

    # Filtering on both is often too narrow; a state with no scope match should
    # still return that state's labs rather than nothing.
    if not rows and product:
        rows = supabase_store.find_labs(state=state)
    if not rows and state:
        rows = supabase_store.find_labs(scope=product)

    hits = [
        Hit(
            chunk_uid=f"lab:{row['id']}",
            text=f"{row['name']} ({row.get('city') or ''}, {row.get('state') or ''}): "
            f"{row.get('scope') or ''}",
            score=1.0,
            payload={
                "doc_title": row["name"],
                "doc_type": "lab",
                "source_url": row.get("source_url"),
            },
        )
        for row in rows
    ]
    return hits, {"labs": rows}


def run_tool(intent: str, question: str, entities: dict) -> tuple[list[Hit], dict[str, Any]]:
    """Dispatch to the tool for an intent.

    Intents compose where it helps: a product question wants both the applicable
    standards and the scheme text describing how to certify them, so the two
    result sets are fused rather than one being chosen.
    """
    product = entities.get("product")
    state = entities.get("state")
    is_numbers = entities.get("is_numbers") or []

    if intent == "standard_lookup" and is_numbers:
        return standard_lookup(question, is_numbers)

    if intent == "recommend_standards":
        std_hits, structured = recommend_standards(question, product)
        doc_hits, _ = passage_search(question)
        return fuse_hits([std_hits, doc_hits]), structured

    if intent == "labs":
        lab_hits, structured = find_labs(question, state=state, product=product)
        if lab_hits:
            return lab_hits, structured
        # No lab directory rows yet - fall through to documents so the answer
        # can at least explain how lab recognition works.
        return passage_search(question)[0], structured

    if intent in {"certification", "hallmarking", "consumer"}:
        return passage_search(question, doc_type=INTENT_DOC_TYPES.get(intent))

    if intent == "smalltalk":
        return [], {}

    return passage_search(question)
