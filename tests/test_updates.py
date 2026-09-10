"""Tests for the BIS What's New ingest.

Offline. What is covered is the reading of BIS's own markup and the
classification we layer on top - the part that is ours, and therefore the part
that can be wrong in a way BIS cannot be blamed for.
"""

import datetime

import pytest

from bis.ingest import updates

ITEM = """
<div class="staffcat">
  <div class="staffrightcat1">
    <h2><a href="https://www.bis.gov.in/x/IS-19497-AIF.pdf" target="_blank">
      Grant of All India First Licence for &ldquo;Carbon Black&rdquo; as per IS 17440 : 2020.
    </a></h2>
    <h3>Type: pdf</h3>
    <h3>Size: 1 MB</h3>
    <h3>Published On: 20 Aug, 2026</h3>
  </div>
</div>
"""


# --- reading the feed -----------------------------------------------------


def test_an_item_is_read_whole():
    [item] = updates.parse_page(ITEM, "src")
    assert "Carbon Black" in item.title
    assert item.url == "https://www.bis.gov.in/x/IS-19497-AIF.pdf"
    assert item.media_type == "pdf"
    assert item.size == "1 MB"
    assert item.published_on == "2026-08-20"
    assert item.source_page == "src"


def test_the_standard_number_is_lifted_from_the_title():
    """So a reader can find every notice that mentions IS 17440."""
    [item] = updates.parse_page(ITEM, "src")
    assert item.is_number == "IS 17440"


def test_a_video_has_no_size():
    """BIS writes "Size: NA" for videos; NA is not a size."""
    html = ITEM.replace("Type: pdf", "Type: youtube").replace("Size: 1 MB", "Size: NA")
    [item] = updates.parse_page(html, "src")
    assert item.media_type == "youtube"
    assert item.size is None


def test_an_item_with_no_title_is_skipped():
    assert updates.parse_page('<div class="staffcat"><div class="staffrightcat1"></div></div>', "s") == []


def test_the_id_is_stable_across_refetches():
    """BIS reorders the feed as it publishes. Keying on position would rewrite
    every row on each run; keying on content means a re-run updates in place."""
    first = updates.parse_page(ITEM, "a")[0]
    second = updates.parse_page(ITEM, "b")[0]
    assert first.update_uid == second.update_uid


def test_different_items_get_different_ids():
    other = ITEM.replace("Carbon Black", "Rigid PVC Sheets").replace("IS-19497", "IS-6307")
    assert updates.parse_page(ITEM, "s")[0].update_uid != updates.parse_page(other, "s")[0].update_uid


# --- dates ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("20 Aug, 2026", datetime.date(2026, 8, 20)),
        ("4 June, 2026", datetime.date(2026, 6, 4)),
        ("08-05-2026", datetime.date(2026, 5, 8)),
    ],
)
def test_dates_parse(text, expected):
    assert updates.parse_date(text) == expected


def test_an_unreadable_date_is_none_rather_than_guessed():
    assert updates.parse_date("shortly") is None


def test_an_undated_item_is_kept():
    """A notice BIS published without a date is still a notice. Dropping it
    would make our feed shorter than the Bureau's own page."""
    html = ITEM.replace("<h3>Published On: 20 Aug, 2026</h3>", "")
    [item] = updates.parse_page(html, "src")
    assert item.published_on is None
    assert item.title


# --- classification -------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("Hallmarking of Gold Jewellery (Second Amendment) Order, 2026", "amendment"),
        ("Gazette Notification dated 02 March 2026", "amendment"),
        ("Grant of All India First Licence for Carbon Black", "licence"),
        ("Report on Wide Circulation Draft for Revision of IS 5175", "standard"),
        ("Bhartiya Manak - Bharat Ka Bharosa Quiz", "event"),
        ("Technical Textiles Conclave 2026", "event"),
        ("Podcast of DG, BIS", "news"),
    ],
)
def test_titles_are_classified(title, expected):
    assert updates.classify(title) == expected


@pytest.mark.parametrize(
    "title",
    [
        "Advertisement for the post of Section Officer on deputation basis in Bureau of Indian Standards",
        "For the Provisionally Shortlisted Candidates for Interview",
        "Empanelment of retired officers as Inquiry Officers",
    ],
)
def test_a_job_advert_is_not_a_standards_update(title):
    """Regression: nearly every notice ends "... Bureau of Indian Standards",
    so a bare "standards" pattern filed recruitment adverts and podcasts as
    standards activity."""
    assert updates.classify(title) == "recruitment"


def test_the_bureau_s_own_name_does_not_make_something_a_standard():
    assert updates.classify("Citizen-Centric Initiatives | DG-Bureau of Indian Standards") == "news"


def test_an_unrecognised_title_falls_back_to_news():
    assert updates.classify("Something entirely new") == "news"


# --- the sources ----------------------------------------------------------


def test_both_feeds_are_bis_urls():
    for url in updates.SOURCES.values():
        assert url.startswith("https://www.bis.gov.in/")
