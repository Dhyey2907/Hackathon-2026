"""BIS announcements: what the Bureau has published, and when.

Serves the What's New feed the ingest collects, with the week boundaries the
interface groups by worked out here rather than in the browser - so "this week"
means the same thing to every client regardless of its clock or timezone.

What this endpoint deliberately does not offer is a count of standards
published in a given week. BIS publishes a department-wise total, but its date
parameters are ignored on the public page - a seven-day and a thirty-day window
return the same figure - so any weekly number derived from it would be invented.
See `bis.ingest.updates` for the detail.
"""

from __future__ import annotations

import datetime
import logging

from fastapi import APIRouter, Query

from bis.store import supabase_store

log = logging.getLogger(__name__)
router = APIRouter(tags=["updates"])

MAX_ITEMS = 500


@router.get("/updates")
def list_updates(
    category: str | None = None,
    since: str | None = Query(None, description="ISO date; only items published on or after"),
    weeks: int | None = Query(None, ge=1, le=520, description="Only the last N weeks"),
    limit: int = Query(100, ge=1, le=MAX_ITEMS),
) -> dict:
    """BIS announcements, newest first.

    `weeks` is a convenience over `since`: `weeks=1` is the last seven days.
    When both are given, `since` wins, because it is the more specific of the
    two and silently overriding an explicit date would be surprising.
    """
    cutoff = since
    if cutoff is None and weeks is not None:
        cutoff = (datetime.date.today() - datetime.timedelta(weeks=weeks)).isoformat()

    results = supabase_store.find_updates(category=category, since=cutoff, limit=limit)

    # Counts over the returned window, so the chips add up to what is on screen.
    by_category: dict[str, int] = {}
    for item in results:
        name = item.get("category") or "news"
        by_category[name] = by_category.get(name, 0) + 1

    return {
        "results": results,
        "total": len(results),
        "since": cutoff,
        "by_category": by_category,
        "source": "https://www.bis.gov.in/whats-new/?lang=en",
    }
