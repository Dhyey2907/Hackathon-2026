"""Tests for the hallmarking corpus builder.

Every test here runs offline. What is covered is our handling of what bis.gov.in
serves - the accordion shape, the navigation chrome, the corrupt-font Hindi, the
redirect that pretends to be a PDF - because each of those, left alone, puts
something uncitable into the corpus and a citation is only worth what the chunk
behind it says.
"""

import pytest

from bis.ingest import hallmarking as hm

# --- FAQ accordions -------------------------------------------------------

ACCORDION = """
<html><body>
  <button class="accordion">1.What is Hallmarking?</button>
  <div class="panel"><p>Hallmarking is the accurate determination of purity.</p></div>
  <button class="accordion">2.What is HUID?</button>
  <div class="panel"><p>A six digit alphanumeric code unique to each article.</p></div>
</body></html>
"""


def test_question_and_answer_stay_together():
    sections = hm._accordion_sections(ACCORDION)
    assert len(sections) == 2
    assert sections[1].title == "What is HUID?"
    assert "six digit alphanumeric" in sections[1].text


def test_the_question_number_becomes_the_citable_label():
    """faq_cache only loads chunks with a non-null clause, so this is what
    admits a hallmarking FAQ to the verbatim fast path."""
    assert [s.clause for s in hm._accordion_sections(ACCORDION)] == ["Q1", "Q2"]


def test_the_question_is_not_duplicated_into_the_body():
    """chunk_sections prepends "<clause> <title>" to the text, so a question
    written to both fields appears twice in every chunk."""
    section = hm._accordion_sections(ACCORDION)[0]
    assert "What is Hallmarking?" not in section.text


def test_an_unnumbered_heading_still_gets_a_label():
    html = """<html><body>
      <div class="accordion">Who issues the HUID?</div>
      <div class="panel">The Assaying and Hallmarking Centre.</div>
    </body></html>"""
    assert hm._accordion_sections(html)[0].clause == "Q1"


def test_a_question_with_no_answer_is_dropped():
    html = """<html><body>
      <div class="accordion">1.What is Hallmarking?</div><div class="panel"></div>
      <div class="accordion">2.What is HUID?</div><div class="panel">A code.</div>
    </body></html>"""
    assert [s.clause for s in hm._accordion_sections(html)] == ["Q2"]


def test_mismatched_accordions_fall_back_rather_than_pairing_wrongly():
    """Pairing question 2 with answer 3 would produce confident nonsense."""
    html = """<html><body>
      <div class="accordion">1.A?</div>
      <div class="accordion">2.B?</div>
      <div class="panel">only one answer</div>
    </body></html>"""
    assert hm._accordion_sections(html) == []


# --- prose pages ----------------------------------------------------------


def test_navigation_only_pages_yield_nothing():
    """Regression: bis.gov.in ships its whole mega-menu in the markup, and a
    <body>-level extraction produced ~750 tokens of menu links with no content.
    Indexed, that is a citation pointing at the navigation bar."""
    html = """<html><body>
      <div class="menu"><a>Standard of the Week</a><a>BIS Library</a></div>
      <div class="footer_row"><a>Follow Us on Twitter</a></div>
    </body></html>"""
    assert hm._prose_sections(html) == []


def test_content_is_read_from_the_bis_content_container():
    html = """<html><body>
      <div class="menu">Standard of the Week</div>
      <div class="who_we_area">
        Home
        Consumer Protection
        A consumer may get jewellery tested at any recognised centre on a
        chargeable basis, and the centre issues an assay report.
      </div>
    </body></html>"""
    sections = hm._prose_sections(html)
    assert sections
    assert "assay report" in sections[0].text
    assert "Standard of the Week" not in sections[0].text


# --- legibility -----------------------------------------------------------


def test_english_is_legible():
    assert hm.is_legible("The jeweller shall register with the Bureau.")


def test_corrupt_font_hindi_is_dropped():
    """These gazettes embed Devanagari in a legacy non-Unicode font, and it
    extracts as mojibake - unreadable to the model and to whoever follows the
    citation. The English text of the same clause is in the same PDF."""
    assert not hm.is_legible("और हॉलमा-कग क का नाम एसेग और हॉलमा-कग क है िजसक")


def test_english_with_a_hindi_heading_survives():
    """The bilingual pages put a Devanagari heading above English prose. That
    page is still evidence, and dropping it would lose the clause entirely."""
    text = "हॉलमार्किंग " + "The registered jeweller shall maintain records of every article. " * 6
    assert hm.is_legible(text)


def test_legibility_ignores_documents_with_no_devanagari_at_all():
    assert hm.is_legible("")


# --- fetching -------------------------------------------------------------


class _Response:
    def __init__(self, content, content_type="application/pdf"):
        self.content = content
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        return None


def test_a_redirect_to_the_homepage_is_not_saved_as_a_pdf(monkeypatch, tmp_path):
    """BIS answers a moved PDF with a 302 to its homepage, not a 404. Saved
    under a .pdf name it parses as prose and is indexed as a gazette."""
    import httpx

    monkeypatch.setattr(hm, "RAW_DIR", tmp_path)
    monkeypatch.setattr(
        httpx, "get", lambda *a, **k: _Response(b"\n\n<!DOCTYPE html>", "text/html")
    )
    source = hm.Source("https://www.bis.gov.in/gone.pdf", "Missing Order", "qco")
    assert hm.fetch(source) is None
    assert not list(tmp_path.iterdir())


def test_a_real_pdf_is_saved(monkeypatch, tmp_path):
    import httpx

    monkeypatch.setattr(hm, "RAW_DIR", tmp_path)
    monkeypatch.setattr(hm, "REQUEST_DELAY_SECONDS", 0)
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _Response(b"%PDF-1.7 body"))
    source = hm.Source("https://www.bis.gov.in/order.pdf", "Order", "qco")
    path = hm.fetch(source)
    assert path is not None and path.read_bytes().startswith(b"%PDF")


def test_a_cached_file_is_not_refetched(monkeypatch, tmp_path):
    """The corpus is fetched a document at a time and a run can fail halfway;
    re-running must resume rather than re-download."""
    import httpx

    monkeypatch.setattr(hm, "RAW_DIR", tmp_path)
    source = hm.Source("https://www.bis.gov.in/order.pdf", "Order", "qco")
    hm._cache_path(source).write_bytes(b"%PDF-1.7 cached")

    def should_not_run(*a, **k):
        raise AssertionError("a cached document was re-downloaded")

    monkeypatch.setattr(httpx, "get", should_not_run)
    assert hm.fetch(source) == hm._cache_path(source)


def test_a_dead_link_costs_one_document_not_the_corpus(monkeypatch, tmp_path):
    import httpx

    monkeypatch.setattr(hm, "RAW_DIR", tmp_path)

    def boom(*a, **k):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(httpx, "get", boom)
    assert hm.fetch(hm.Source("https://www.bis.gov.in/x.pdf", "X", "qco")) is None


# --- the manifest itself --------------------------------------------------


def test_every_source_is_a_bis_url():
    for source in hm.SOURCES:
        assert source.url.startswith("https://www.bis.gov.in/"), source.url


def test_doc_keys_are_unique():
    """A collision would make one document overwrite another's chunks."""
    keys = [s.doc_key for s in hm.SOURCES]
    assert len(keys) == len(set(keys))


@pytest.mark.parametrize("source", hm.HTML_SOURCES, ids=lambda s: s.title)
def test_faq_pages_are_typed_as_faq_so_the_fast_path_can_see_them(source):
    assert source.doc_type in {"faq", "consumer", "scheme_guideline"}


# --- the phase-wise district table ----------------------------------------


def _table(*rows):
    return [(1, line) for line in rows]


DISTRICT_TABLE = _table(
    "List of  256 districts covered under the mandatory hallmarking in the first phase",
    "Dated 23rd June, 2021",
    "Sr No", "State/UT", "Names of the District",
    "1", "Maharashtra", "NAGPUR",
    "2", "Maharashtra", "PUNE",
    "3", "Kerala", "Kannur",
    "List of additional 32 districts covered under the mandatory hallmarking in the 2nd phase",
    "Order Dated 4th April, 2022",
    "4", "Maharashtra", "Wardha",
)


def test_districts_are_grouped_by_state_and_phase():
    sections = hm.district_sections(DISTRICT_TABLE)
    paths = {s.section_path for s in sections}
    assert "first phase, dated 23rd June, 2021 > Maharashtra" in paths
    assert "2nd phase, dated 4th April, 2022 > Maharashtra" in paths
    assert "first phase, dated 23rd June, 2021 > Kerala" in paths


def test_a_state_section_names_its_districts_in_the_first_line():
    """Regression: chunked as one flat list, Maharashtra sat ~7,000 characters
    past the opening of the run, so the reranker - which sees only the head of
    a passage - scored the chunk containing the answer as not answering it, and
    the assistant abstained on a district it had."""
    section = next(
        s for s in hm.district_sections(DISTRICT_TABLE)
        if s.section_path == "first phase, dated 23rd June, 2021 > Maharashtra"
    )
    assert section.text.startswith("Districts of Maharashtra where hallmarking")
    assert "NAGPUR" in section.text and "PUNE" in section.text
    assert "Kannur" not in section.text


def test_a_district_carries_the_phase_it_was_added_in():
    sections = hm.district_sections(DISTRICT_TABLE)
    wardha = next(s for s in sections if "Wardha" in s.text)
    assert "2nd phase" in wardha.text
    assert "Nagpur" not in wardha.text and "NAGPUR" not in wardha.text


def test_table_headers_are_not_read_as_rows():
    for section in hm.district_sections(DISTRICT_TABLE):
        assert "Sr No" not in section.text
        assert "Names of the District" not in section.text


def test_a_stray_cell_resyncs_instead_of_shifting_every_row():
    """One dropped cell must not turn every later district into a state."""
    rows = _table(
        "orphan",
        "1", "Goa", "North Goa",
        "2", "Goa", "South Goa",
    )
    sections = hm.district_sections(rows)
    assert len(sections) == 1
    assert "North Goa" in sections[0].text and "South Goa" in sections[0].text


def test_an_empty_table_yields_no_sections():
    assert hm.district_sections([]) == []
