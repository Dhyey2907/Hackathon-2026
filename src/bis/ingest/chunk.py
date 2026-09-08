"""Section-aware chunking.

Whatever metadata is stamped here is exactly what a citation can later show, so
this module is the ceiling on citation quality for the whole system. Two rules
drive the design:

1. Never split across a clause boundary. A passage that begins mid-clause
   cannot be honestly cited as "clause 4.2.1", and a half-clause is usually
   unusable as evidence anyway.
2. Every chunk keeps its own locator (clause, page, section path). We do not
   reconstruct locators at answer time - by then the structure is gone.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from typing import Any

# Matches numbered clauses ("4", "4.2", "4.2.1") and annex headings
# ("Annex B", "ANNEXURE II", "Appendix C") at the start of a line.
CLAUSE_RE = re.compile(
    r"^\s*(?P<clause>\d+(?:\.\d+)*)\s+(?P<title>\S.*)$",
)
ANNEX_RE = re.compile(
    r"^\s*(?P<clause>(?:ANNEX|ANNEXURE|APPENDIX|SCHEDULE)\s+[A-Z0-9]+)\b\.?\s*(?P<title>.*)$",
    re.IGNORECASE,
)

TARGET_TOKENS = 800
OVERLAP_TOKENS = 120
# Short clauses are common and still citable ("4.2.1 Marking: each lamp shall
# be marked ..."), so this floor only exists to drop headers, page numbers and
# other layout debris.
MIN_TOKENS = 20


def estimate_tokens(text: str) -> int:
    """Cheap token estimate.

    Deliberately not a real tokenizer: this runs over every line of every PDF
    and only needs to be right enough to size chunks. Roughly 0.75 tokens per
    whitespace word, floored by a characters/4 estimate so that Devanagari and
    other scripts - where words are longer and split differently - are not
    wildly under-counted.
    """
    words = len(text.split())
    return max(int(words / 0.75), len(text) // 4)


@dataclass
class Section:
    """A contiguous run of text under one heading."""

    text: str
    clause: str | None = None
    title: str | None = None
    page: int | None = None
    section_path: str | None = None


@dataclass
class ChunkRecord:
    """A chunk ready to be embedded, indexed and cited."""

    chunk_uid: str
    text: str
    doc_key: str
    doc_title: str
    doc_type: str
    source_url: str
    ordinal: int
    token_count: int
    clause: str | None = None
    section_path: str | None = None
    page: int | None = None
    is_number: str | None = None
    language: str = "en"
    extra: dict[str, Any] = field(default_factory=dict)

    def to_payload(self) -> dict[str, Any]:
        """Payload stored alongside the vector in Qdrant."""
        payload = asdict(self)
        extra = payload.pop("extra", {})
        payload.update(extra)
        return payload


def make_chunk_uid(doc_key: str, ordinal: int, text: str) -> str:
    """Stable id: same document + position + text always yields the same uid.

    This makes re-indexing idempotent, so a re-run updates points in place
    instead of duplicating them.
    """
    digest = hashlib.sha256(
        f"{doc_key}|{ordinal}|{text}".encode()
    ).hexdigest()
    return digest[:32]


def detect_heading(line: str) -> tuple[str, str] | None:
    """Return (clause, title) when a line looks like a heading, else None."""
    stripped = line.strip()
    if not stripped or len(stripped) > 200:
        return None

    annex = ANNEX_RE.match(stripped)
    if annex:
        return annex.group("clause").upper(), annex.group("title").strip()

    match = CLAUSE_RE.match(stripped)
    if not match:
        return None

    clause = match.group("clause")
    title = match.group("title").strip()

    # A line like "4.2.1 The manufacturer shall ensure that ..." is prose that
    # happens to start with a clause number, not a standalone heading. Headings
    # are short and rarely end in a sentence period.
    if len(title.split()) > 14:
        return None
    if title.endswith((".", ";", ",")) and len(title.split()) > 8:
        return None
    return clause, title


def split_sections(
    pages: Iterable[tuple[int, str]],
) -> list[Section]:
    """Split (page_number, page_text) pairs into heading-delimited sections."""
    sections: list[Section] = []
    current = Section(text="", clause=None, title=None, page=None)
    path_stack: list[tuple[str, str]] = []

    def flush() -> None:
        if current.text.strip():
            current.text = current.text.strip()
            sections.append(current)

    for page_no, page_text in pages:
        for line in page_text.splitlines():
            heading = detect_heading(line)
            if heading is None:
                if current.page is None:
                    current.page = page_no
                current.text += line + "\n"
                continue

            clause, title = heading
            flush()

            depth = clause.count(".") if clause[0].isdigit() else 0
            path_stack = path_stack[:depth]
            path_stack.append((clause, title))

            current = Section(
                text="",
                clause=clause,
                title=title,
                page=page_no,
                section_path=" > ".join(f"{c} {t}".strip() for c, t in path_stack),
            )

    flush()
    return sections


def _split_long_text(text: str, target: int, overlap: int) -> list[str]:
    """Split on paragraph boundaries, then sentence boundaries if still too big."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return []

    pieces: list[str] = []
    buffer: list[str] = []
    buffer_tokens = 0

    for para in paragraphs:
        para_tokens = estimate_tokens(para)

        if para_tokens > target:
            if buffer:
                pieces.append("\n\n".join(buffer))
                buffer, buffer_tokens = [], 0
            sentences = re.split(r"(?<=[.;:])\s+", para)
            sent_buf: list[str] = []
            sent_tokens = 0
            for sentence in sentences:
                st = estimate_tokens(sentence)
                if sent_buf and sent_tokens + st > target:
                    pieces.append(" ".join(sent_buf))
                    sent_buf, sent_tokens = [], 0
                sent_buf.append(sentence)
                sent_tokens += st
            if sent_buf:
                pieces.append(" ".join(sent_buf))
            continue

        if buffer and buffer_tokens + para_tokens > target:
            pieces.append("\n\n".join(buffer))
            buffer, buffer_tokens = [], 0
        buffer.append(para)
        buffer_tokens += para_tokens

    if buffer:
        pieces.append("\n\n".join(buffer))

    if overlap <= 0 or len(pieces) < 2:
        return pieces

    # Prepend a tail of the previous piece so a passage split mid-argument still
    # carries the context needed to be understood on its own.
    overlapped = [pieces[0]]
    for prev, piece in zip(pieces[:-1], pieces[1:], strict=True):
        words = prev.split()
        tail_words = words[-int(overlap / 0.75) :] if words else []
        tail = " ".join(tail_words)
        overlapped.append(f"{tail}\n\n{piece}".strip() if tail else piece)
    return overlapped


def chunk_sections(
    sections: list[Section],
    *,
    doc_key: str,
    doc_title: str,
    doc_type: str,
    source_url: str,
    is_number: str | None = None,
    language: str = "en",
    target_tokens: int = TARGET_TOKENS,
    overlap_tokens: int = OVERLAP_TOKENS,
) -> list[ChunkRecord]:
    """Turn sections into chunk records, never merging across clauses."""
    records: list[ChunkRecord] = []
    ordinal = 0

    for section in sections:
        body = section.text.strip()
        if not body:
            continue
        if section.title:
            body = f"{section.clause or ''} {section.title}\n{body}".strip()

        if estimate_tokens(body) <= target_tokens:
            parts = [body]
        else:
            parts = _split_long_text(body, target_tokens, overlap_tokens)

        for part in parts:
            tokens = estimate_tokens(part)
            if tokens < MIN_TOKENS:
                continue
            uid = make_chunk_uid(doc_key, ordinal, part)
            records.append(
                ChunkRecord(
                    chunk_uid=uid,
                    text=part,
                    doc_key=doc_key,
                    doc_title=doc_title,
                    doc_type=doc_type,
                    source_url=source_url,
                    ordinal=ordinal,
                    token_count=tokens,
                    clause=section.clause,
                    section_path=section.section_path,
                    page=section.page,
                    is_number=is_number,
                    language=language,
                )
            )
            ordinal += 1

    return records


def chunk_plain_text(
    text: str,
    *,
    doc_key: str,
    doc_title: str,
    doc_type: str,
    source_url: str,
    language: str = "en",
    is_number: str | None = None,
) -> list[ChunkRecord]:
    """Chunk unstructured text (an HTML page with no clause numbering)."""
    sections = split_sections([(1, text)])
    if not sections:
        sections = [Section(text=text, page=1)]
    return chunk_sections(
        sections,
        doc_key=doc_key,
        doc_title=doc_title,
        doc_type=doc_type,
        source_url=source_url,
        is_number=is_number,
        language=language,
    )
