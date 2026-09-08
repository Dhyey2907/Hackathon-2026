"""Client for the public BIS standards portal API.

standards.bis.gov.in is an Angular app backed by unauthenticated JSON services
on standardsadmin.bis.gov.in. These are the same endpoints the public catalogue
pages call; robots.txt permits those paths. Requests are throttled and cached on
disk so a re-run is free and a crash mid-ingest costs nothing.

Endpoint map (discovered from the portal bundle):

  project-service/getWebsiteTechnicalDepartments
      17 technical departments, each with an encryptedDepartmentId token.
  review-service/getWebsitePSTechDepartmentWise
      Published standards for a department (optionally one committee),
      paginated by offset/limit. This is the full catalogue, ~15k standards.
  technical-committee/getwebsiteAllSectionalCommittees
      415 sectional committees (CED 2, ETD 9, TXD 20, ...).
  review-service/searchKnowStandards
      Free-text search over standard number and title.
  review-service/getStandardLaboratoryDetails
      Recognised labs for a standard - feeds the lab-finder tool.
  review-service/getStandardLicenseDetails
      Licences granted against a standard.

A caution learned the hard way: proposal-service/getStandardsBySectorId looks
like a catalogue listing but is a *recently published* view, and it silently
returns only 10 records unless mode/page/pageSize are all supplied. It is not
used here.

Ids are Laravel-encrypted blobs rather than integers, so they are treated as
opaque tokens: fetched fresh and passed straight back.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any

import httpx

from bis.config import RAW_DIR, get_settings

log = logging.getLogger(__name__)

PORTAL_ORIGIN = "https://standards.bis.gov.in"
ADMIN_ROOT = "https://standardsadmin.bis.gov.in"

PROJECT_SERVICE = f"{ADMIN_ROOT}/project-service"
REVIEW_SERVICE = f"{ADMIN_ROOT}/review-service"
COMMITTEE_SERVICE = f"{ADMIN_ROOT}/technical-committee"
PROPOSAL_SERVICE = f"{ADMIN_ROOT}/proposal-service"

# typeSelected picks which view the department-wise endpoint returns. Only 7
# gives the committee's full published-standards list; 1 returns a much shorter
# recent-activity subset (96 vs 174 for CED 2, missing staples like IS 269), and
# 2 ignores the committee filter and returns all ~23.9k standards. Verified by
# checking that IS 269:2015 appears for CED 2 under 7 and under nothing else.
TYPE_PUBLISHED = 7

# The endpoint silently caps a page at 100 rows regardless of the limit sent.
MAX_PAGE_SIZE = 100

_last_request_at = 0.0


class BISAPIError(RuntimeError):
    pass


def _cache_path(service: str, endpoint: str, key: str) -> Path:
    digest = hashlib.blake2b(key.encode(), digest_size=8).hexdigest()
    host = service.rsplit("/", 1)[-1]
    path = RAW_DIR / "api" / host / endpoint
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{digest}.json"


def _throttle() -> None:
    """Keep at least scrape_delay_seconds between calls to a government host."""
    global _last_request_at
    delay = get_settings().scrape_delay_seconds
    elapsed = time.monotonic() - _last_request_at
    if elapsed < delay:
        time.sleep(delay - elapsed)
    _last_request_at = time.monotonic()


def post(
    service: str,
    endpoint: str,
    payload: dict[str, Any] | None = None,
    *,
    use_cache: bool = True,
    timeout: float = 90.0,
    retries: int = 3,
) -> dict[str, Any]:
    """POST to an endpoint, with on-disk caching and exponential-backoff retry."""
    payload = payload or {}
    cache_key = json.dumps(payload, sort_keys=True)
    cache_file = _cache_path(service, endpoint, cache_key)

    if use_cache and cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    settings = get_settings()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": PORTAL_ORIGIN,
        "Referer": f"{PORTAL_ORIGIN}/",
        "User-Agent": settings.scrape_user_agent,
    }

    last_error: Exception | None = None
    for attempt in range(retries):
        _throttle()
        try:
            response = httpx.post(
                f"{service}/{endpoint}", json=payload, headers=headers, timeout=timeout
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            last_error = exc
            wait = 2**attempt
            log.warning(
                "%s failed (attempt %d/%d): %s - retrying in %ds",
                endpoint,
                attempt + 1,
                retries,
                exc,
                wait,
            )
            time.sleep(wait)
            continue

        if int(data.get("statusCode", 0)) != 200:
            raise BISAPIError(
                f"{endpoint} returned {data.get('statusCode')}: {data.get('msg')}"
            )

        cache_file.write_text(json.dumps(data), encoding="utf-8")
        return data

    raise BISAPIError(
        f"{endpoint} failed after {retries} attempts: {last_error}"
    ) from last_error


def fetch_departments(use_cache: bool = True) -> list[dict[str, Any]]:
    """The 17 technical departments, each with an encryptedDepartmentId."""
    data = post(
        PROJECT_SERVICE, "getWebsiteTechnicalDepartments", {}, use_cache=use_cache
    )
    return data.get("data") or []


def fetch_committees(use_cache: bool = True) -> list[dict[str, Any]]:
    """All sectional committees: committeeId, aliasName, committeeNumber, name."""
    data = post(
        COMMITTEE_SERVICE, "getwebsiteAllSectionalCommittees", {}, use_cache=use_cache
    )
    records = data.get("data") or []
    # This endpoint returns a list of JSON strings, not objects.
    parsed: list[dict[str, Any]] = []
    for record in records:
        if isinstance(record, str):
            try:
                parsed.append(json.loads(record))
            except json.JSONDecodeError:
                continue
        elif isinstance(record, dict):
            parsed.append(record)
    return parsed


def fetch_published_standards(
    enc_department_id: str,
    committee_id: int = 0,
    *,
    use_cache: bool = True,
    page_size: int = MAX_PAGE_SIZE,
    max_pages: int = 500,
) -> list[dict[str, Any]]:
    """Published standards for a department, or one committee within it.

    committee_id=0 returns the whole department. Pages by offset/limit and stops
    when totalRecord is reached; a mismatch is logged rather than silently
    accepted, because a short read here looks exactly like a small department.
    """
    page_size = min(page_size, MAX_PAGE_SIZE)
    records: list[dict[str, Any]] = []
    total: int | None = None

    for page in range(max_pages):
        data = post(
            REVIEW_SERVICE,
            "getWebsitePSTechDepartmentWise",
            {
                "typeSelected": TYPE_PUBLISHED,
                "ministryIds": [],
                "sdgIds": [],
                "offset": page * page_size,
                "limit": page_size,
                "techCommitteeId": committee_id,
                "encDepartmentId": enc_department_id,
            },
            use_cache=use_cache,
        )
        batch = [r for r in (data.get("data") or []) if isinstance(r, dict)]
        records.extend(batch)

        if total is None:
            total = data.get("totalRecord")

        if not batch or (total is not None and len(records) >= total):
            break
    else:
        log.warning("hit max_pages=%d; results may be truncated", max_pages)

    if total is not None and len(records) != total:
        log.warning(
            "department returned %d records but reported totalRecord=%s",
            len(records),
            total,
        )
    return records


def search_standards(text: str, use_cache: bool = True) -> list[dict[str, Any]]:
    """Free-text search over standard number and title.

    Also returns standardNameInHindi where BIS has it, which is a genuine
    multilingual asset rather than a machine translation.
    """
    data = post(
        REVIEW_SERVICE, "searchKnowStandards", {"searchText": text}, use_cache=use_cache
    )
    return [r for r in (data.get("data") or []) if isinstance(r, dict)]


def fetch_standard_labs(
    standard_id: str | int, use_cache: bool = True
) -> list[dict[str, Any]]:
    """Recognised testing laboratories for a standard."""
    data = post(
        REVIEW_SERVICE,
        "getStandardLaboratoryDetails",
        {"standardId": standard_id},
        use_cache=use_cache,
    )
    payload = data.get("data")
    return [r for r in payload if isinstance(r, dict)] if isinstance(payload, list) else []


def fetch_standard_licences(
    standard_id: str | int, use_cache: bool = True
) -> list[dict[str, Any]]:
    """Licences granted against a standard (ISI mark holders)."""
    data = post(
        REVIEW_SERVICE,
        "getStandardLicenseDetails",
        {"standardId": standard_id},
        use_cache=use_cache,
    )
    payload = data.get("data")
    return [r for r in payload if isinstance(r, dict)] if isinstance(payload, list) else []
