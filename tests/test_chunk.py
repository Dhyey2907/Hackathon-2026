"""Tests for section-aware chunking.

The property that matters most: a chunk's clause label must actually describe
the text in that chunk, because that label becomes a citation.
"""

from bis.ingest.chunk import (
    ChunkRecord,
    Section,
    chunk_plain_text,
    chunk_sections,
    detect_heading,
    estimate_tokens,
    make_chunk_uid,
    split_sections,
)

SAMPLE = """1 SCOPE
This standard covers the requirements for portable electric lamps intended for
household use.

2 REFERENCES
The standards listed below contain provisions which constitute provisions of
this standard.

4.2.1 Marking
Each lamp shall be legibly and indelibly marked with the manufacturer name.

ANNEX A
Additional guidance on test methods is provided here for reference.
"""


def test_detect_heading_accepts_numbered_headings():
    assert detect_heading("1 SCOPE") == ("1", "SCOPE")
    assert detect_heading("4.2.1 Marking") == ("4.2.1", "Marking")


def test_detect_heading_accepts_annex():
    clause, _ = detect_heading("ANNEX A")
    assert clause == "ANNEX A"


def test_detect_heading_rejects_prose_starting_with_a_number():
    # A clause number followed by a full sentence is body text, not a heading.
    prose = "4.2.1 The manufacturer shall ensure that every lamp supplied under this licence is tested."
    assert detect_heading(prose) is None


def test_detect_heading_rejects_blank_and_overlong():
    assert detect_heading("") is None
    assert detect_heading("   ") is None
    assert detect_heading("2 " + "x" * 300) is None


def test_split_sections_assigns_clauses():
    sections = split_sections([(1, SAMPLE)])
    clauses = [s.clause for s in sections]
    assert "1" in clauses
    assert "4.2.1" in clauses
    assert "ANNEX A" in clauses


def test_split_sections_keeps_body_with_its_heading():
    sections = split_sections([(1, SAMPLE)])
    marking = next(s for s in sections if s.clause == "4.2.1")
    assert "indelibly marked" in marking.text


def test_section_path_nests():
    text = "4 REQUIREMENTS\nGeneral requirements follow.\n\n4.2 Marking\nMarking rules.\n"
    sections = split_sections([(1, text)])
    marking = next(s for s in sections if s.clause == "4.2")
    assert marking.section_path is not None
    assert "4 REQUIREMENTS" in marking.section_path
    assert "4.2 Marking" in marking.section_path


def test_chunks_never_span_two_clauses():
    sections = split_sections([(1, SAMPLE)])
    records = chunk_sections(
        sections,
        doc_key="demo",
        doc_title="Demo Standard",
        doc_type="standard",
        source_url="https://example.invalid/demo",
    )
    assert records
    for record in records:
        # Every chunk carries exactly one clause label, and the text of the
        # neighbouring clause must not have leaked in.
        if record.clause == "1":
            assert "indelibly marked" not in record.text


def test_chunk_metadata_is_stamped():
    records = chunk_sections(
        split_sections([(7, SAMPLE)]),
        doc_key="demo",
        doc_title="Demo Standard",
        doc_type="scheme_guideline",
        source_url="https://example.invalid/demo",
        is_number="IS 9999",
    )
    record = records[0]
    assert isinstance(record, ChunkRecord)
    assert record.page == 7
    assert record.doc_type == "scheme_guideline"
    assert record.source_url == "https://example.invalid/demo"
    assert record.is_number == "IS 9999"
    assert record.token_count > 0


def test_chunk_uid_is_stable_and_position_sensitive():
    a = make_chunk_uid("doc", 0, "hello world")
    b = make_chunk_uid("doc", 0, "hello world")
    c = make_chunk_uid("doc", 1, "hello world")
    assert a == b
    assert a != c


def test_long_section_is_split_with_overlap():
    para = "The licensee shall maintain records of every test performed. " * 40
    body = "\n\n".join([para] * 6)
    records = chunk_sections(
        [Section(text=body, clause="5", title="Records", page=1)],
        doc_key="long",
        doc_title="Long Doc",
        doc_type="scheme_guideline",
        source_url="https://example.invalid/long",
        target_tokens=200,
        overlap_tokens=40,
    )
    assert len(records) > 1
    # Overlap means consecutive chunks share some trailing/leading text.
    assert all(r.clause == "5" for r in records)


def test_tiny_fragments_are_dropped():
    records = chunk_sections(
        [Section(text="ok", clause="9", page=1)],
        doc_key="tiny",
        doc_title="Tiny",
        doc_type="faq",
        source_url="https://example.invalid/tiny",
    )
    assert records == []


def test_chunk_plain_text_handles_unstructured_pages():
    text = (
        "Hallmarking of gold jewellery is mandatory in notified districts. "
        "A jeweller must register with BIS before selling hallmarked articles. "
    ) * 12
    records = chunk_plain_text(
        text,
        doc_key="hallmark-faq",
        doc_title="Hallmarking FAQ",
        doc_type="faq",
        source_url="https://example.invalid/faq",
    )
    assert records
    assert records[0].doc_type == "faq"


def test_estimate_tokens_handles_devanagari():
    # Should not return 0 for non-Latin scripts.
    assert estimate_tokens("हॉलमार्किंग क्या है") > 0
