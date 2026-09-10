"""Fetch and parse the public BIS hallmarking corpus.

Hallmarking is named in the problem statement, and until now the assistant
abstained on every HUID question because it had no hallmarking documents to
cite. This module closes that gap from bis.gov.in's public pages and PDFs.

Two document shapes, handled differently:

  HTML FAQ pages - BIS renders these as accordions: the question sits in
      `.accordion`, the answer in the `.panel` that follows it. Each pair
      becomes one section, so a chunk always carries its question with its
      answer. These are stamped `doc_type="faq"`, which also admits them to the
      verbatim fast path in `agent.faq_cache` - "What is HUID?" is then answered
      in BIS's own wording without a generation call.

  PDFs - regulations, quality control orders and guidelines, parsed page by
      page through the shared clause-aware splitter so a citation can name a
      real clause and page.

On which documents to include: mandatory hallmarking lives in an amendment
chain, and the principal order alone is actively misleading - it covered 256
districts in 2021 and the coverage has been extended repeatedly since. So the
amendments are ingested alongside it. The opposite rule applies to guidelines,
where BIS publishes a replacement rather than a delta: only the current
jeweller guidelines are here, because indexing the superseded January 2024
edition beside them would let an answer cite withdrawn requirements with a
straight face.

Run:
    python -m bis.ingest.hallmarking --fetch
    python -m bis.ingest.hallmarking --parse
    python -m bis.ingest.hallmarking --upload
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import re
import time
from dataclasses import dataclass
from pathlib import Path

from bis.config import PROJECT_ROOT
from bis.ingest.chunk import ChunkRecord, Section, chunk_sections, split_sections

log = logging.getLogger(__name__)

RAW_DIR = PROJECT_ROOT / "data" / "raw" / "hallmarking"

# Identifies the crawler to BIS rather than impersonating a browser, and the
# delay keeps a full fetch to roughly one request a second.
USER_AGENT = "BIS-Assistant/1.0 (SIH 26107 research project)"
REQUEST_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 60.0


@dataclass(frozen=True)
class Source:
    url: str
    title: str
    doc_type: str
    # "district_table" routes to the parser for the phase-wise coverage list,
    # which is a three-column table the generic clause splitter cannot read.
    parser: str = "auto"

    @property
    def is_pdf(self) -> bool:
        return self.url.lower().endswith(".pdf")

    @property
    def doc_key(self) -> str:
        """Stable across re-downloads: derived from the URL, not the file."""
        return hashlib.blake2b(self.url.encode(), digest_size=8).hexdigest()


# BIS publishes hallmarking FAQs split by audience. All six are ingested: a
# jeweller and a consumer ask different questions about the same scheme, and
# the answers differ in ways that matter.
HTML_SOURCES = [
    Source(
        "https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq/?lang=en",
        "Hallmarking FAQs - General",
        "faq",
    ),
    Source(
        "https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/mandatory/?lang=en",
        "Hallmarking FAQs - Under the Mandatory System",
        "faq",
    ),
    Source(
        "https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/bis-act-and-regulation-faq/?lang=en",
        "Hallmarking FAQs - BIS Act and Regulations",
        "faq",
    ),
    Source(
        "https://www.bis.gov.in/hallmarking-jewellers/?lang=en",
        "Hallmarking FAQs - Jewellers",
        "faq",
    ),
    Source(
        "https://www.bis.gov.in/a-h-centre/?lang=en",
        "Hallmarking FAQs - Assaying and Hallmarking Centres",
        "faq",
    ),
    Source(
        "https://www.bis.gov.in/refineries/?lang=en",
        "Hallmarking FAQs - Refineries",
        "faq",
    ),
    Source(
        "https://www.bis.gov.in/hallmarking-overview/consumer-protection/?lang=en",
        "Hallmarking - Consumer Protection",
        "consumer",
    ),
    # Deliberately absent: the Jewellers Registration Scheme landing page. Its
    # content is a list of links to the PDFs already ingested below, so indexing
    # it adds a chunk that answers nothing and competes for retrieval slots with
    # the documents it points at.
]

PDF_SOURCES = [
    # The regulations, and the amendments that make them current.
    Source(
        "https://www.bis.gov.in/bs/BIS_Hallmarking_Regulations_2018_Gazette_notification.pdf",
        "BIS (Hallmarking) Regulations, 2018",
        "regulation",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2021/11/BIS_HM_Amdt_Regulations_2021_Gazette.pdf",
        "BIS (Hallmarking) Amendment Regulations, 2021",
        "regulation",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2022/03/BIS-HM-Amendment-Regulations-2022.pdf",
        "BIS (Hallmarking) Amendment Regulations, 2022",
        "regulation",
    ),
    # Mandatory hallmarking: the order, the QCO, and the coverage extensions.
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2020/01/Mandatory-Hallmarking-Order-15.01.2020.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts Order, 2020",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2021/06/qc-order-June-2021-2.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts Quality Control Order, 2021",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2022/01/QCO_HMD.pdf",
        "Mandatory Hallmarking - Exemptions and Guidelines",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2023/09/Hallmarking-Third-Amendment-Order-06092023.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts (Third Amendment) Order, 2023",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2024/11/Amendment-05-Nov-2024-1.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts Amendment Order, November 2024",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2023/04/Hallmarking-notification-dt-31.3.2023.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts Amendment Order, 31 March 2023",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2026/03/Gazette-Notification-dt-02-March-2026-Mandatory-Hallmarking-amendment-order-1-1.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts Amendment Order, 02 March 2026",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2026/05/Hallmarking-of-gold-jewellery-and-gold-artefacts-order-2026-second-amendments-385-districts-1.pdf",
        "Hallmarking of Gold Jewellery and Gold Artefacts (Second Amendment) Order, 2026 - 385 districts",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2026/08/Notification-related-to-mandatory-Hallmarking-2.pdf",
        "Notification on Mandatory Hallmarking, 03 August 2026",
        "qco",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2026/09/Phase-wise-coverage-of-districts-under-gold-mandatory-hallmarking.pdf",
        "Phase-wise Coverage of Districts under Mandatory Gold Hallmarking",
        "qco",
        parser="district_table",
    ),
    # Guidelines: current editions only.
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2026/07/Guidelines-for-Jewellers.pdf",
        "Guidelines for Jewellers",
        "scheme_guideline",
    ),
    # Deliberately absent: Guide_Jeweller_Registration_v1.1.pdf. It is a
    # screenshot walkthrough of the Manak portal - 2.6 MB of images yielding one
    # chunk of "click the tab as shown in fig.1", which cites a figure the
    # assistant cannot show and states no actual requirement. The Guidelines for
    # Jewellers below carry the substance.
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2026/07/GuidelinesForAHCs.pdf",
        "Guidelines for Assaying and Hallmarking Centres",
        "scheme_guideline",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2018/11/Hm_Manual.pdf",
        "Generic Quality Manual for Assaying and Hallmarking Centres",
        "scheme_guideline",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2018/11/Guidelines_for_Refinery_or_Mint_08102018.pdf",
        "Guidelines for Refineries and Mints",
        "scheme_guideline",
    ),
    Source(
        "https://www.bis.gov.in/wp-content/uploads/2020/12/brief-on-Hallmarking.pdf",
        "Brief on Hallmarking",
        "scheme_guideline",
    ),
]

SOURCES = HTML_SOURCES + PDF_SOURCES

# "1.What is Hallmarking?", "Q 12. ...", "5) ..." - the numbering styles BIS
# uses in accordion headings. The number becomes the citable label.
_HEADING_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*[.):]?\s*(?P<rest>\S.*)$")


def _cache_path(source: Source) -> Path:
    suffix = ".pdf" if source.is_pdf else ".html"
    return RAW_DIR / f"{source.doc_key}{suffix}"


def fetch(source: Source, *, refresh: bool = False) -> Path | None:
    """Download one source into the raw cache. Skips what is already there.

    Returns None on failure rather than raising: one dead BIS link should cost
    us that document, not the whole corpus.
    """
    import httpx

    path = _cache_path(source)
    if path.exists() and path.stat().st_size > 0 and not refresh:
        log.debug("cached %s", source.title)
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

    if not response.content:
        log.error("empty response for %s", source.url)
        return None

    # BIS answers a moved PDF with a 302 to its homepage rather than a 404, and
    # httpx follows it happily. Without this check the homepage would be saved
    # under a .pdf name, parsed as prose, and indexed as though it were a
    # gazette notification - a citation pointing at navigation boilerplate.
    if source.is_pdf and not response.content.startswith(b"%PDF"):
        log.error(
            "not a PDF (served %s, likely redirected): %s",
            response.headers.get("content-type", "?"),
            source.url,
        )
        return None

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    log.info("fetched %-58s %7d bytes", source.title[:58], len(response.content))
    time.sleep(REQUEST_DELAY_SECONDS)
    return path


def fetch_all(*, refresh: bool = False) -> list[tuple[Source, Path]]:
    fetched: list[tuple[Source, Path]] = []
    for source in SOURCES:
        path = fetch(source, refresh=refresh)
        if path is not None:
            fetched.append((source, path))
    log.info("fetched %d of %d sources", len(fetched), len(SOURCES))
    return fetched


def _accordion_sections(html: str) -> list[Section]:
    """Question/answer pairs from a BIS FAQ accordion.

    Returns an empty list when the page is not an accordion, so the caller can
    fall back to reading it as prose.
    """
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    questions = tree.css(".accordion")
    answers = tree.css(".panel")
    if not questions or len(questions) != len(answers):
        return []

    sections: list[Section] = []
    for index, (q_node, a_node) in enumerate(zip(questions, answers, strict=True), start=1):
        question = " ".join(q_node.text(separator=" ", strip=True).split())
        answer = " ".join(a_node.text(separator=" ", strip=True).split())
        if not question or not answer:
            continue

        match = _HEADING_RE.match(question)
        if match:
            label, question = f"Q{match.group(1)}", match.group("rest").strip()
        else:
            # No number on the heading: fall back to position, so the chunk
            # still has the non-null clause the FAQ fast path requires.
            label = f"Q{index}"

        sections.append(
            Section(
                text=answer,
                clause=label,
                title=question[:300],
                page=None,
                section_path=label,
            )
        )
    return sections


# bis.gov.in puts page content in `.who_we_area`. Falling back to <body> is not
# an option here: the site ships its entire mega-menu and footer in the markup,
# so a body-level extraction yields ~750 tokens of navigation links and not one
# sentence of content - which would then be indexed and cited as though it were
# the page. Better to extract nothing and log it than to cite the menu.
CONTENT_SELECTORS = (".who_we_area", "main", "article", ".entry-content")

_CHROME_RE = re.compile(
    r"^(?:Home|Skip Content|BIS Login|BIS FAQ|Media|BIS Blog|Hindi|"
    r"Like Us on|Follow Us on|Subscribe on|Facebook|Twitter|LinkedIn|YouTube|Instagram)$",
    re.IGNORECASE,
)


def _prose_sections(html: str) -> list[Section]:
    """Readable body text of a page that is not an FAQ accordion."""
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    for node in tree.css("script, style, nav, header, footer, .menu, .footer_row"):
        node.decompose()

    main = next((n for sel in CONTENT_SELECTORS if (n := tree.css_first(sel)) is not None), None)
    if main is None:
        return []

    text = main.text(separator="\n", strip=True)
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not _CHROME_RE.match(line.strip())
    ]
    if not lines:
        return []
    return split_sections([(1, "\n".join(lines))])


def parse_html(path: Path) -> list[Section]:
    html = path.read_text(encoding="utf-8", errors="replace")
    return _accordion_sections(html) or _prose_sections(html)


def parse_pdf(path: Path) -> list[Section]:
    import pymupdf

    pages: list[tuple[int, str]] = []
    with pymupdf.open(path) as document:
        for index, page in enumerate(document, start=1):
            pages.append((index, page.get_text()))
    return split_sections(pages)


_DEVANAGARI = re.compile(r"[ऀ-ॿ]")
_LATIN = re.compile(r"[A-Za-z]")

# Above this share of Devanagari, a chunk is the Hindi half of a bilingual
# gazette page rather than English prose with a Hindi heading.
DEVANAGARI_SHARE_LIMIT = 0.5


def is_legible(text: str) -> bool:
    """Reject the Hindi half of the bilingual gazette PDFs.

    Not a judgement about Hindi. These gazettes embed Devanagari in a legacy
    non-Unicode font, and PyMuPDF extracts it as mojibake - "हॉलमार्किंग"
    comes out as "हॉलमा-कग". It is unreadable to the model, unreadable to the
    user who follows the citation, and it competes for retrieval slots with the
    English text of the same clause, which every one of these documents also
    contains. Nothing is lost by dropping it; a fixed extraction of these fonts
    would be the way to add Hindi back.
    """
    deva = len(_DEVANAGARI.findall(text))
    if not deva:
        return True
    latin = len(_LATIN.findall(text))
    return deva / (deva + latin) < DEVANAGARI_SHARE_LIMIT


# "List of additional 32 districts covered under the mandatory hallmarking in
# the 2nd phase", and the "Dated ..." line that follows it.
_PHASE_RE = re.compile(
    r"^List of\s+(?:additional\s+)?[\d,]+\s+districts?\s+covered.*?\bin the\s+(?P<phase>[^,]*?phase)\b",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"^(?:Order\s+)?Dated\s+(?P<date>.+?)\s*$", re.IGNORECASE)
_TABLE_HEADER = {"sr no", "sr. no", "state/ut", "names of the district", "state", "district"}


def parse_district_table(path: Path) -> list[Section]:
    """The phase-wise district list, grouped one section per state per phase.

    Parsed apart from the other PDFs because it is a three-column table, not
    prose: PyMuPDF flattens it to a stream of "412 / Maharashtra / Nagpur"
    triples that the clause splitter reads as one undifferentiated blob.

    Grouping by state is the point. Chunked as a flat list, the districts of
    Maharashtra sit ~7,000 characters into a run that opens with Andhra
    Pradesh - so the reranker, which sees only the head of a passage, scored
    the chunk that literally contains the answer as "same topic, does not
    answer the question", and the assistant abstained on a district it had.
    One state per section puts the answer in the first line.
    """
    import pymupdf

    lines: list[tuple[int, str]] = []
    with pymupdf.open(path) as document:
        for page_no, page in enumerate(document, start=1):
            for raw in page.get_text().splitlines():
                lines.append((page_no, raw))
    return district_sections(lines)


def district_sections(lines: list[tuple[int, str]]) -> list[Section]:
    """Group (page, line) pairs from the district table into one section per
    state per phase. Split out from the PDF reader so it can be tested."""
    phase = "mandatory hallmarking"
    # (phase, state) -> [districts], plus the page each group opened on.
    groups: dict[tuple[str, str], list[str]] = {}
    pages: dict[tuple[str, str], int] = {}
    pending: list[tuple[int, str]] = []

    def take_triple() -> None:
        """Consume one Sr No / State / District row from the buffer."""
        while len(pending) >= 3:
            if not pending[0][1].isdigit():
                pending.pop(0)  # resync: drop a stray cell rather than misalign
                continue
            _, (page, state), (_, district) = pending[0], pending[1], pending[2]
            del pending[:3]
            key = (phase, " ".join(state.split()).title())
            groups.setdefault(key, []).append(" ".join(district.split()))
            pages.setdefault(key, page)

    for page_no, raw in lines:
        line = raw.strip()
        if not line or line.lower().rstrip(":") in _TABLE_HEADER:
            continue

        heading = _PHASE_RE.match(line)
        if heading:
            take_triple()
            pending.clear()  # a partial row cannot straddle a phase
            phase = " ".join(heading.group("phase").split()).lower()
            continue

        date = _DATE_RE.match(line)
        if date and phase and "dated" not in phase:
            phase = f"{phase}, dated {date.group('date').strip()}"
            continue

        pending.append((page_no, line))
        take_triple()

    take_triple()

    sections: list[Section] = []
    for (group_phase, state), districts in groups.items():
        unique = list(dict.fromkeys(districts))
        # Written as a sentence rather than a bare list so the passage states
        # what the districts mean - a citation to "Nagpur, Nashik" alone says
        # nothing about whether hallmarking applies there.
        body = (
            f"Districts of {state} where hallmarking of gold jewellery and gold "
            f"artefacts is mandatory ({group_phase}): "
            + ", ".join(unique)
            + "."
        )
        sections.append(
            Section(
                text=body,
                clause=None,
                title=f"Mandatory hallmarking districts - {state}",
                page=pages[(group_phase, state)],
                section_path=f"{group_phase} > {state}",
            )
        )
    return sections


def build(*, refresh: bool = False) -> list[ChunkRecord]:
    """Fetch what is missing, then parse everything into chunk records."""
    records: list[ChunkRecord] = []

    for source, path in fetch_all(refresh=refresh):
        try:
            if source.parser == "district_table":
                sections = parse_district_table(path)
            else:
                sections = parse_pdf(path) if source.is_pdf else parse_html(path)
        except Exception as exc:
            log.error("failed to parse %s: %s", source.title, str(exc)[:200])
            continue

        if not sections:
            log.warning("no sections extracted from %s", source.title)
            continue

        chunks = chunk_sections(
            sections,
            doc_key=source.doc_key,
            doc_title=source.title,
            doc_type=source.doc_type,
            source_url=source.url,
        )
        legible = [c for c in chunks if is_legible(c.text)]
        log.info(
            "%-58s %3d sections -> %3d chunks%s",
            source.title[:58],
            len(sections),
            len(legible),
            f" ({len(chunks) - len(legible)} illegible dropped)"
            if len(legible) != len(chunks)
            else "",
        )
        records.extend(legible)

    log.info("hallmarking corpus: %d chunks", len(records))
    return records


def upload() -> int:
    """Upsert the hallmarking chunks into Supabase, without embeddings.

    Embedding is left to `index_supabase --embed`, which fills in every chunk
    missing a vector regardless of which corpus it came from.
    """
    from bis.store import supabase_store

    records = build()
    payload = [
        {
            "chunk_uid": r.chunk_uid,
            "text": r.text,
            "doc_key": r.doc_key,
            "doc_title": r.doc_title,
            "doc_type": r.doc_type,
            "source_url": r.source_url,
            "ordinal": r.ordinal,
            "token_count": r.token_count,
            "clause": r.clause,
            "section_path": r.section_path,
            "page": r.page,
            "is_number": r.is_number,
            "language": r.language,
        }
        for r in records
    ]
    log.info("uploading %d hallmarking chunks", len(payload))
    return supabase_store.upsert_chunks(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the BIS hallmarking corpus.")
    parser.add_argument("--fetch", action="store_true", help="download sources into data/raw")
    parser.add_argument("--parse", action="store_true", help="parse and report, without uploading")
    parser.add_argument("--upload", action="store_true", help="upsert chunks into Supabase")
    parser.add_argument("--refresh", action="store_true", help="re-download cached sources")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.fetch:
        fetch_all(refresh=args.refresh)
    if args.parse:
        build(refresh=args.refresh)
    if args.upload:
        print(f"upserted {upload()} chunks")
    if not (args.fetch or args.parse or args.upload):
        parser.print_help()


if __name__ == "__main__":
    main()
