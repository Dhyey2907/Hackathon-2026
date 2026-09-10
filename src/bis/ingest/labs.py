"""Build the testing-laboratory directory from BIS's own published lists.

The `labs` table was empty and the interface was filling the gap with ten
fixture rows that paired real institution names with invented phone numbers.
This replaces them with the two lists BIS actually publishes:

  Group 1 - laboratories BIS has formally recognised under the Laboratory
      Recognition Scheme. Each row carries an OSL code and a recognition
      expiry date.

  Group 2 - laboratories whose facilities BIS uses without formally
      recognising them. BIS is explicit that these are *not* recognised labs
      and are not audited, so they are kept and labelled rather than quietly
      merged into the same list.

Both are PDFs of a bordered table, read with PyMuPDF's table extractor rather
than flat text: the Remarks column runs to many lines per row and a flat read
interleaves one lab's suspension history with the next lab's name.

Three things these lists do not contain, which the interface must not pretend
otherwise about:

  Test scopes. Neither list says what a laboratory can test. Scope lives in the
  LIMS portal, searchable by standard number, and is not published in bulk. So
  `scope` stays null and the UI points at LIMS for that question.

  Contact details. No phone, no e-mail, no street address. Null is the honest
  value; a plausible-looking placeholder is the thing that got us here.

  A clean status flag. Remarks is a free-text audit trail - "Suspension revoked
  w.e.f. 13-01-2025. Suspended w.e.f. 24.10.2025" - not always in date order,
  sometimes with malformed dates ("06.04..2022"). We take the latest dated
  event and treat a suspension as current only when it is the newest thing
  said, and we keep the raw remarks so the reader can judge for themselves.

Run:
    python -m bis.ingest.labs --parse
    python -m bis.ingest.labs --upload
"""

from __future__ import annotations

import argparse
import datetime
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from bis.config import PROJECT_ROOT

log = logging.getLogger(__name__)

RAW_DIR = PROJECT_ROOT / "data" / "raw" / "labs"
USER_AGENT = "BIS-Assistant/1.0 (SIH 26107 research project)"
REQUEST_TIMEOUT_SECONDS = 60.0

LIMS_SCOPE_SEARCH = "https://lims.bis.gov.in/home/search_is_number/"


@dataclass(frozen=True)
class ListSource:
    url: str
    group: str
    """What recognition, if any, this list confers. Shown to the user."""
    recognition: str

    @property
    def filename(self) -> str:
        return self.url.rsplit("/", 1)[-1]


SOURCES = [
    ListSource(
        "https://www.bis.gov.in/wp-content/uploads/2026/06/Group_1_24062026.pdf",
        group="Group 1",
        recognition="BIS recognised",
    ),
    ListSource(
        "https://www.bis.gov.in/wp-content/uploads/2026/04/Group-2_23042026.pdf",
        group="Group 2",
        recognition="Facility used by BIS, not recognised",
    ),
]

# BIS writes the same state a dozen ways across 790 rows, with genuine typos
# among them - Karnatka, Telengana, Kerla, Harayana, "Rajasth an". Left alone,
# the state filter offers "U.P." and "Uttar Pradesh" as two different places.
# Keys are the state text reduced to bare letters.
STATE_ALIASES = {
    "up": "Uttar Pradesh",
    "uttarpradesh": "Uttar Pradesh",
    "utterpradesh": "Uttar Pradesh",
    "mp": "Madhya Pradesh",
    "madhyapradesh": "Madhya Pradesh",
    "ap": "Andhra Pradesh",
    "andhrapradesh": "Andhra Pradesh",
    "hp": "Himachal Pradesh",
    "himachalpradesh": "Himachal Pradesh",
    "wb": "West Bengal",
    "westbengal": "West Bengal",
    "jk": "Jammu and Kashmir",
    "jammukashmir": "Jammu and Kashmir",
    "jammuandkashmir": "Jammu and Kashmir",
    "karnataka": "Karnataka",
    "karnatka": "Karnataka",
    "telangana": "Telangana",
    "telengana": "Telangana",
    "tamilnadu": "Tamil Nadu",
    "kerala": "Kerala",
    "kerla": "Kerala",
    "haryana": "Haryana",
    "harayana": "Haryana",
    "maharashtra": "Maharashtra",
    "maharshtra": "Maharashtra",
    "punjab": "Punjab",
    "pubjab": "Punjab",
    "rajasthan": "Rajasthan",
    "uttarakhand": "Uttarakhand",
    "uttrakhand": "Uttarakhand",
    "uttaranchal": "Uttarakhand",
    "uttranchal": "Uttarakhand",
    "odisha": "Odisha",
    "orissa": "Odisha",
    "chhattisgarh": "Chhattisgarh",
    "chattisgarh": "Chhattisgarh",
    "puducherry": "Puducherry",
    "pondicherry": "Puducherry",
    "delhi": "Delhi",
    "newdelhi": "Delhi",
    "nctofdelhi": "Delhi",
    "andamannicobar": "Andaman and Nicobar Islands",
    "andamanandnicobar": "Andaman and Nicobar Islands",
    "daman": "Dadra and Nagar Haveli and Daman and Diu",
    # A city entered in the state column. Guwahati is unambiguously in Assam,
    # so it is corrected rather than left standing as a state of its own.
    "guwahati": "Assam",
}

# Cities carry the same problem as states: renamings and misspellings split one
# place into several entries in a filter. Same bare-letters keying.
CITY_ALIASES = {
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "newdelhi": "New Delhi",
    "gurgaon": "Gurugram",
    "gurugram": "Gurugram",
    "sonepat": "Sonipat",
    "sonipat": "Sonipat",
    "ahemdabad": "Ahmedabad",
    "ahmedabad": "Ahmedabad",
    "cochin": "Kochi",
    "kochi": "Kochi",
    "bombay": "Mumbai",
    "mumbai": "Mumbai",
    "calcutta": "Kolkata",
    "kolkata": "Kolkata",
    "madras": "Chennai",
    "chennai": "Chennai",
    "baroda": "Vadodara",
    "vadodara": "Vadodara",
    "trivandrum": "Thiruvananthapuram",
    "pondicherry": "Puducherry",
    "nasik": "Nashik",
    "nashik": "Nashik",
    "poona": "Pune",
}

# A trailing comma segment is usually the city ("… Pvt Ltd, Noida"), unless it
# is more of the company name.
_NOT_A_CITY = re.compile(
    r"\b(ltd|pvt|llp|limited|inc|corp|centre|center|institut\w*|laborator\w*|"
    r"service\w*|technolog\w*|industr\w*|india|division|unit|dept|department|"
    r"complex|campus|works|plant|refinery|termina\w*)\b",
    re.IGNORECASE,
)

# "Suspended w.e.f. 30.04.2026", "Suspension revoked w.e.f. 13-01-2025".
# The date part tolerates the stray double dots that appear in the source.
_EVENT_RE = re.compile(
    r"(suspension\s+revoked|revoked|suspended)[^0-9]{0,24}(\d{1,2})[.\-/]+(\d{1,2})[.\-/]+(\d{4})",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"(\d{1,2})[.\-/]+(\d{1,2})[.\-/]+(\d{4})")


@dataclass
class LabRecord:
    name: str
    city: str | None
    state: str | None
    scope: str | None
    schemes: str | None
    contact: str | None
    source_url: str
    osl_code: str | None = None
    category: str | None = None
    valid_to: str | None = None
    operative: bool = True
    remarks: str | None = None
    extra: dict = field(default_factory=dict)

    def to_row(self) -> dict:
        row = asdict(self)
        row.pop("extra", None)
        return row


def _parse_date(text: str) -> datetime.date | None:
    match = _DATE_RE.search(text or "")
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def latest_status(remarks: str) -> bool:
    """Is the laboratory operative, as far as the remarks can tell us?

    Returns True when nothing says otherwise. A suspension counts as current
    only when it is the newest dated event in the column - the entries are not
    reliably in date order, so position cannot be trusted and the dates have to
    be compared.
    """
    events: list[tuple[datetime.date, str]] = []
    for match in _EVENT_RE.finditer(remarks or ""):
        day, month, year = (int(part) for part in match.group(2, 3, 4))
        try:
            when = datetime.date(year, month, day)
        except ValueError:
            continue
        kind = "revoked" if "revok" in match.group(1).lower() else "suspended"
        events.append((when, kind))

    if not events:
        return True
    # max() on (date, kind) breaks same-day ties toward "suspended", which is
    # the cautious direction: better to under-claim availability.
    return max(events)[1] != "suspended"


def normalise_state(raw: str) -> str | None:
    text = " ".join((raw or "").split()).strip(" .")
    if not text:
        return None
    # Keyed on bare letters, so punctuation and spacing stop mattering:
    # "U.P.", "U.P" and "Rajasth an" all reduce to something matchable.
    key = re.sub(r"[^a-z]", "", text.lower())
    if key in STATE_ALIASES:
        return STATE_ALIASES[key]
    # Unknown but plausible - title-case so "ASSAM" and "Assam" agree.
    return text.title()


def city_from_name(name: str) -> str | None:
    if "," not in name:
        return None
    tail = " ".join(name.rsplit(",", 1)[1].split()).strip(" .")
    if not tail or len(tail) > 28 or _NOT_A_CITY.search(tail):
        return None
    key = re.sub(r"[^a-z]", "", tail.lower())
    return CITY_ALIASES.get(key, tail.title() if tail.isupper() else tail)


def _rows_from_pdf(path: Path) -> list[list[str]]:
    """Every data row of the table, across all pages, header rows dropped."""
    import pymupdf

    rows: list[list[str]] = []
    with pymupdf.open(path) as document:
        for page in document:
            for table in page.find_tables().tables:
                for raw in table.extract():
                    cells = [" ".join((c or "").split()) for c in raw]
                    if not any(cells):
                        continue
                    # The extractor treats the first row of each page as a
                    # header, which on continuation pages is really data.
                    if cells[0].lower().startswith("sl"):
                        continue
                    rows.append(cells)
    return rows


def parse_list(source: ListSource, path: Path) -> list[LabRecord]:
    """One list PDF into lab records.

    Rows whose name cell is blank are continuation fragments of the row above -
    the Remarks column overflows into them - so their remarks are folded back
    into the previous lab rather than becoming a nameless entry.
    """
    records: list[LabRecord] = []

    for cells in _rows_from_pdf(path):
        # Pad so Group 2's five columns and Group 1's seven read the same way.
        cells = cells + [""] * (7 - len(cells)) if len(cells) < 7 else cells
        name = cells[1].strip()

        if not name:
            if records and cells[6].strip():
                previous = records[-1]
                previous.remarks = " ".join(
                    part for part in [previous.remarks, cells[6].strip()] if part
                )
                previous.operative = latest_status(previous.remarks or "")
            continue

        remarks = cells[6].strip() or None
        valid = _parse_date(cells[5])

        records.append(
            LabRecord(
                name=name,
                city=city_from_name(name),
                state=normalise_state(cells[2]),
                # Not published in these lists - see the module docstring.
                scope=None,
                schemes=f"{source.recognition} ({source.group})",
                contact=None,
                source_url=source.url,
                osl_code=cells[4].strip() or None,
                category=cells[3].strip() or None,
                valid_to=valid.isoformat() if valid else None,
                operative=latest_status(remarks or ""),
                remarks=remarks,
            )
        )

    return records


def fetch(source: ListSource, *, refresh: bool = False) -> Path | None:
    import httpx

    path = RAW_DIR / source.filename
    if path.exists() and path.stat().st_size > 0 and not refresh:
        return path

    try:
        response = httpx.get(
            source.url,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except Exception as exc:
        log.error("fetch failed %s: %s", source.url, str(exc)[:160])
        return None

    # BIS answers a moved PDF with a redirect to its homepage, not a 404.
    if not response.content.startswith(b"%PDF"):
        log.error("not a PDF (likely redirected): %s", source.url)
        return None

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    log.info("fetched %-28s %7d bytes", source.filename, len(response.content))
    return path


def build(*, refresh: bool = False) -> list[LabRecord]:
    records: list[LabRecord] = []
    for source in SOURCES:
        path = fetch(source, refresh=refresh)
        if path is None:
            continue
        found = parse_list(source, path)
        suspended = sum(1 for r in found if not r.operative)
        log.info(
            "%-9s %3d laboratories (%d not currently operative)",
            source.group,
            len(found),
            suspended,
        )
        records.extend(found)

    log.info("laboratory directory: %d rows", len(records))
    return records


def upload() -> int:
    """Replace the labs table with the current published lists.

    A straight replace rather than an upsert: these lists are re-published as a
    whole, and a laboratory dropped from the new edition has lost its
    recognition. Leaving it behind would keep a stale entry on screen.
    """
    from bis.store import supabase_store

    records = build()
    if not records:
        log.error("nothing parsed; leaving the table untouched")
        return 0

    client = supabase_store.get_write_client()
    client.table("labs").delete().neq("id", -1).execute()

    rows = [record.to_row() for record in records]
    written = 0
    for start in range(0, len(rows), 200):
        batch = rows[start : start + 200]
        client.table("labs").insert(batch).execute()
        written += len(batch)
        log.info("labs inserted %d/%d", written, len(rows))
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the BIS laboratory directory.")
    parser.add_argument("--fetch", action="store_true", help="download the list PDFs")
    parser.add_argument("--parse", action="store_true", help="parse and report only")
    parser.add_argument("--upload", action="store_true", help="replace the labs table")
    parser.add_argument("--refresh", action="store_true", help="re-download cached PDFs")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.fetch:
        for source in SOURCES:
            fetch(source, refresh=args.refresh)
    if args.parse:
        build(refresh=args.refresh)
    if args.upload:
        print(f"inserted {upload()} laboratories")
    if not (args.fetch or args.parse or args.upload):
        parser.print_help()


if __name__ == "__main__":
    main()
