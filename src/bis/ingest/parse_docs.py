"""Parse the FaQs/ corpus into citable chunks.

Two document shapes need different handling, and getting this wrong is the most
expensive mistake in the pipeline: whatever locator is captured here is exactly
what an [S1] citation shows the user.

  PDF   - PyMuPDF, page by page, so every chunk keeps a real page number.
  DOCX  - python-docx, paragraph by paragraph. Word files carry no pages, so a
          chunk gets a section path instead and page stays null rather than
          being invented.

BIS FAQ documents are mostly Q&A rather than numbered clauses, so on top of the
clause detection in chunk.py this module recognises question headings ("Q1.",
"Q 7", "1. What is ...?"). A question and its answer belong together: splitting
them produces a chunk that cites a question with no answer, or an answer whose
subject is unrecoverable.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from bis.config import PROJECT_ROOT
from bis.ingest.chunk import ChunkRecord, Section, chunk_sections

log = logging.getLogger(__name__)

FAQ_ROOT = PROJECT_ROOT / "FaQs"

# "Q1.", "Q 1", "Q.7", "Question 3" - the BIS FAQ house styles.
QUESTION_RE = re.compile(
    r"^\s*(?:Q(?:uestion)?\s*\.?\s*(\d+)\s*[.):]?)\s*(?P<rest>\S.*)?$",
    re.IGNORECASE,
)
# "12. What is a licence?" - numbered question without a Q prefix. Requires a
# question mark or an interrogative opening, so ordinary numbered prose in a
# scheme document is not mistaken for a question.
NUMBERED_QUESTION_RE = re.compile(
    r"^\s*(\d{1,3})\s*[.)]\s+(?P<rest>(?:What|Who|When|Where|Why|How|Is|Are|Can|Do|Does|Should|Whether|Which)\b.*)$",
    re.IGNORECASE,
)

# Page furniture that adds noise and never answers anything.
NOISE_RE = re.compile(
    r"^\s*(?:Page\s+\d+\s+of\s+\d+|\d+\s*\|\s*P\s*a\s*g\s*e|https?://\S+\s*$)\s*$",
    re.IGNORECASE,
)

# Folder name -> doc_type, so retrieval can be filtered by intent.
DOC_TYPE_BY_FOLDER = {
    "01_BIS_Certification_Schemes_Overview": "scheme_guideline",
    "02_Standard_Specific_FAQs_Manuals": "faq",
    "03_FMCS": "faq",
    "04_Scheme_X_Certification_FAQ": "faq",
}

# Public BIS landing pages, so a citation can link somewhere real rather than a
# local file path the user cannot open.
SOURCE_URLS = {
    "Scheme_I_ISI_Mark_Scheme": "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
    "Scheme_II_Registration_Scheme": "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
    "Scheme_X_Certification": "https://www.bis.gov.in/scheme-x-certification/",
    "Scheme-X_Certification_FAQ": "https://www.bis.gov.in/scheme-x-certification/",
    "Upcoming_QCOs_Notified_and_Due_for_Implementation": "https://www.bis.gov.in/upcoming-qcos-notified/",
    "FAQs_FMCS": "https://www.bis.gov.in/product-certification/foreign-manufacturers-certification-scheme/",
    "product_and_system_certi_faq": "https://www.bis.gov.in/product-certification/",
    "System_certifications": "https://www.bis.gov.in/management-system-certification/",
}
DEFAULT_SOURCE_URL = "https://www.bis.gov.in/"


@dataclass
class ParsedDoc:
    doc_key: str
    title: str
    doc_type: str
    source_url: str
    sections: list[Section]


def _clean_line(line: str) -> str | None:
    """Drop page furniture; return None when the line carries nothing."""
    if NOISE_RE.match(line):
        return None
    text = line.replace("\xa0", " ").rstrip()
    return text if text.strip() else ""


def detect_question(line: str) -> tuple[str, str] | None:
    """Return (label, remainder) when a line opens a FAQ question."""
    stripped = line.strip()
    if not stripped or len(stripped) > 300:
        return None

    match = QUESTION_RE.match(stripped)
    if match:
        return f"Q{match.group(1)}", (match.group("rest") or "").strip()

    match = NUMBERED_QUESTION_RE.match(stripped)
    if match:
        return f"Q{match.group(1)}", match.group("rest").strip()
    return None


def _title_from(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip()


def _doc_key(path: Path) -> str:
    rel = path.relative_to(FAQ_ROOT).as_posix()
    return hashlib.blake2b(rel.encode(), digest_size=8).hexdigest()


def _source_url(path: Path) -> str:
    return SOURCE_URLS.get(path.stem, DEFAULT_SOURCE_URL)


def _doc_type(path: Path) -> str:
    folder = path.relative_to(FAQ_ROOT).parts[0]
    return DOC_TYPE_BY_FOLDER.get(folder, "faq")


def _sections_from_lines(
    lines: list[tuple[int | None, str]],
) -> list[Section]:
    """Group (page, line) pairs into question-delimited sections.

    A section runs from one question heading to the next, so the answer stays
    attached to its question. Text before the first question becomes an
    unlabelled preamble section rather than being dropped.
    """
    sections: list[Section] = []
    current = Section(text="", clause=None, title=None, page=None)

    def flush() -> None:
        if current.text.strip():
            current.text = current.text.strip()
            sections.append(current)

    for page, raw in lines:
        cleaned = _clean_line(raw)
        if cleaned is None:
            continue

        question = detect_question(cleaned)
        if question is None:
            if current.page is None:
                current.page = page
            current.text += cleaned + "\n"
            continue

        label, rest = question
        flush()
        # The question text goes in `title` only, never also in `text`:
        # chunk_sections prepends "<clause> <title>" to the body, so writing it
        # to both repeats the whole question inside every chunk.
        current = Section(
            text="",
            clause=label,
            title=rest[:200] if rest else None,
            page=page,
            section_path=label,
        )

    flush()
    return sections


def parse_pdf(path: Path) -> ParsedDoc:
    import pymupdf

    lines: list[tuple[int | None, str]] = []
    with pymupdf.open(path) as doc:
        for index, page in enumerate(doc, start=1):
            for raw in page.get_text().splitlines():
                lines.append((index, raw))

    return ParsedDoc(
        doc_key=_doc_key(path),
        title=_title_from(path),
        doc_type=_doc_type(path),
        source_url=_source_url(path),
        sections=_sections_from_lines(lines),
    )


def parse_docx(path: Path) -> ParsedDoc:
    import docx

    document = docx.Document(str(path))
    # Word has no page concept available here, so page stays None rather than
    # being guessed - a wrong page number in a citation is worse than none.
    lines: list[tuple[int | None, str]] = [
        (None, paragraph.text) for paragraph in document.paragraphs
    ]

    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                lines.append((None, " | ".join(cells)))

    return ParsedDoc(
        doc_key=_doc_key(path),
        title=_title_from(path),
        doc_type=_doc_type(path),
        source_url=_source_url(path),
        sections=_sections_from_lines(lines),
    )


def parse_file(path: Path) -> ParsedDoc | None:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            return parse_pdf(path)
        if suffix == ".docx":
            return parse_docx(path)
    except Exception as exc:
        log.error("failed to parse %s: %s", path.name, str(exc)[:200])
        return None
    log.info("skipping unsupported file %s", path.name)
    return None


def parse_corpus(root: Path = FAQ_ROOT) -> list[ChunkRecord]:
    """Parse every supported document under `root` into chunk records."""
    records: list[ChunkRecord] = []

    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name.lower() == "readme.md":
            continue

        parsed = parse_file(path)
        if parsed is None or not parsed.sections:
            continue

        chunks = chunk_sections(
            parsed.sections,
            doc_key=parsed.doc_key,
            doc_title=parsed.title,
            doc_type=parsed.doc_type,
            source_url=parsed.source_url,
        )
        log.info(
            "%-52s %3d sections -> %3d chunks",
            path.name[:52],
            len(parsed.sections),
            len(chunks),
        )
        records.extend(chunks)

    return records
