"""BIS announcements, from the Bureau's own What's New feed.

Every item here is something BIS published, with the date BIS put on it and a
link back to the notice itself. That matters because the page this replaces was
four hand-written amendments with invented IS numbers.

Sources: the What's New page and its archive. Both render the same markup - a
run of `.staffcat` blocks, each with a title linking to a PDF or video, a type,
a size and a "Published On" date - so one parser reads both.

Two limits worth stating plainly, because they shape what the interface may
claim:

  Weekly grouping is real, departmental counts are not. Each item carries a
  genuine publication date, so grouping by week is sound. BIS also publishes a
  department-wise count of new and revised standards, but its `dt_from` and
  `dt_to` parameters are ignored on the public page - a seven-day window and a
  thirty-day window both return the same 716 - so that figure is a rolling
  twelve-month total and is not ingested here. Presenting it as "this week"
  would be a fabrication of exactly the kind this module exists to end.

  The per-standard lists behind those counts need a login. The drill-down
  endpoint answers 303 to an anonymous request, so "which standards were
  published this week" is not publicly available and the interface should not
  imply that it is.

Run:
    python -m bis.ingest.updates --parse
    python -m bis.ingest.updates --upload
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import logging
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from bis.config import PROJECT_ROOT

log = logging.getLogger(__name__)

RAW_DIR = PROJECT_ROOT / "data" / "raw" / "news"
USER_AGENT = "BIS-Assistant/1.0 (SIH 26107 research project)"
REQUEST_TIMEOUT_SECONDS = 60.0
REQUEST_DELAY_SECONDS = 1.0

SOURCES = {
    "current": "https://www.bis.gov.in/whats-new/?lang=en",
    "archive": "https://www.bis.gov.in/whats-new-archive/?lang=en",
}

_PUBLISHED_RE = re.compile(r"Published\s*On\s*:\s*(.+)", re.IGNORECASE)
_TYPE_RE = re.compile(r"Type\s*:\s*(.+)", re.IGNORECASE)
_SIZE_RE = re.compile(r"Size\s*:\s*(.+)", re.IGNORECASE)

# "20 Aug, 2026" is the house format; the others show up in the archive.
_DATE_FORMATS = ("%d %b, %Y", "%d %B, %Y", "%d %b %Y", "%d %B %Y", "%d-%m-%Y", "%d.%m.%Y")

# What an item is about, worked out from its title. Order matters: the first
# match wins, so the more specific patterns come first.
_CATEGORIES: list[tuple[str, re.Pattern[str]]] = [
    ("amendment", re.compile(r"\bamend|\bcorrigend|\bgazette|\bnotification\b", re.I)),
    ("qco", re.compile(r"quality control order|\bQCO\b", re.I)),
    ("hallmarking", re.compile(r"hallmark|\bHUID\b", re.I)),
    ("licence", re.compile(r"\blicence\b|\blicense\b|all india first", re.I)),
    # Before "standard", because a recruitment notice or an event is usually
    # titled "... in Bureau of Indian Standards" and would otherwise be filed
    # as a standards update.
    ("recruitment", re.compile(r"recruit|vacanc|shortlist|interview|empanel|deputation|post of", re.I)),
    ("event", re.compile(r"webinar|quiz|workshop|conclave|celebrat|award", re.I)),
    # "standard" deliberately does not match a bare "standards": every page on
    # the site says "Bureau of Indian Standards" somewhere. It wants a standard
    # number, a singular "Indian Standard" that is not the Bureau's own name,
    # or an explicit revision.
    (
        "standard",
        re.compile(r"\bIS\s*\d|(?<!bureau of )indian standard\b|revision of|draft standard", re.I),
    ),
]

# Pulled out of the title when present, so a reader can search by it.
_IS_NUMBER_RE = re.compile(r"\bIS\s*(?:/\s*(?:IEC|ISO))?\s*[:\s]?\s*(\d{3,5})", re.IGNORECASE)


@dataclass
class UpdateItem:
    update_uid: str
    title: str
    url: str | None
    category: str
    media_type: str | None
    size: str | None
    published_on: str | None
    is_number: str | None
    source_page: str

    def to_row(self) -> dict:
        return asdict(self)


def classify(title: str) -> str:
    for name, pattern in _CATEGORIES:
        if pattern.search(title):
            return name
    return "news"


def parse_date(text: str) -> datetime.date | None:
    cleaned = " ".join((text or "").split()).strip(" .")
    for fmt in _DATE_FORMATS:
        try:
            return datetime.datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def is_number_in(title: str) -> str | None:
    match = _IS_NUMBER_RE.search(title or "")
    return f"IS {match.group(1)}" if match else None


def _uid(title: str, url: str | None) -> str:
    """Stable across re-fetches, so re-running updates rather than duplicates.

    Keyed on title and link rather than position: BIS reorders the feed as it
    publishes, and a position-based id would rewrite every row each run.
    """
    return hashlib.blake2b(f"{title}|{url or ''}".encode(), digest_size=12).hexdigest()


def parse_page(html: str, source_page: str) -> list[UpdateItem]:
    from selectolax.parser import HTMLParser

    items: list[UpdateItem] = []
    for block in HTMLParser(html).css(".staffcat"):
        link = block.css_first("h2 a")
        heading = block.css_first("h2")
        title = " ".join((link or heading).text(separator=" ", strip=True).split()) if (link or heading) else ""
        if not title:
            continue

        media_type = size = published = None
        for line in block.css("h3"):
            text = " ".join(line.text(strip=True).split())
            if (found := _TYPE_RE.match(text)):
                media_type = found.group(1).strip()
            elif (found := _SIZE_RE.match(text)):
                size = found.group(1).strip()
            elif (found := _PUBLISHED_RE.match(text)):
                published = found.group(1).strip()

        url = link.attributes.get("href") if link else None
        when = parse_date(published or "")

        items.append(
            UpdateItem(
                update_uid=_uid(title, url),
                title=title,
                url=url,
                category=classify(title),
                media_type=(media_type or "").lower() or None,
                size=size if size and size.upper() != "NA" else None,
                published_on=when.isoformat() if when else None,
                is_number=is_number_in(title),
                source_page=source_page,
            )
        )

    return items


def fetch(name: str, url: str, *, refresh: bool = False) -> Path | None:
    import httpx

    path = RAW_DIR / f"{name}.html"
    if path.exists() and path.stat().st_size > 0 and not refresh:
        return path

    try:
        response = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except Exception as exc:
        log.error("fetch failed %s: %s", url, str(exc)[:160])
        return None

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    log.info("fetched %-9s %7d bytes", name, len(response.content))
    time.sleep(REQUEST_DELAY_SECONDS)
    return path


def build(*, refresh: bool = False) -> list[UpdateItem]:
    """Both feeds, de-duplicated, newest first."""
    seen: dict[str, UpdateItem] = {}

    for name, url in SOURCES.items():
        path = fetch(name, url, refresh=refresh)
        if path is None:
            continue
        found = parse_page(path.read_text(encoding="utf-8", errors="replace"), url)
        undated = sum(1 for item in found if not item.published_on)
        log.info("%-9s %3d items%s", name, len(found), f" ({undated} undated)" if undated else "")
        for item in found:
            # The archive repeats items that are still on the current page.
            seen.setdefault(item.update_uid, item)

    items = sorted(seen.values(), key=lambda i: i.published_on or "", reverse=True)
    log.info("BIS updates: %d items", len(items))
    return items


def upload() -> int:
    from bis.store import supabase_store

    items = build()
    if not items:
        log.error("nothing parsed; leaving the table untouched")
        return 0

    client = supabase_store.get_write_client()
    rows = [item.to_row() for item in items]
    written = 0
    for start in range(0, len(rows), 200):
        batch = rows[start : start + 200]
        client.table("bis_updates").upsert(batch, on_conflict="update_uid").execute()
        written += len(batch)
        log.info("updates upserted %d/%d", written, len(rows))
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the BIS What's New feed.")
    parser.add_argument("--fetch", action="store_true", help="download the feeds")
    parser.add_argument("--parse", action="store_true", help="parse and report only")
    parser.add_argument("--upload", action="store_true", help="upsert into Supabase")
    parser.add_argument("--refresh", action="store_true", help="re-download cached pages")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.fetch:
        for name, url in SOURCES.items():
            fetch(name, url, refresh=args.refresh)
    if args.parse:
        for item in build(refresh=args.refresh):
            print(f"{item.published_on or '----------'}  {item.category:12} {item.title[:80]}")
    if args.upload:
        print(f"upserted {upload()} updates")
    if not (args.fetch or args.parse or args.upload):
        parser.print_help()


if __name__ == "__main__":
    main()
