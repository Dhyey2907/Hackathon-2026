"""Tests for the laboratory directory parser.

All offline. What is covered is the messy parts of BIS's own lists - the state
column written a dozen ways, the city hidden in the name, and a Remarks column
that is a free-text audit trail rather than a status field. Each of those, read
naively, puts something wrong in front of someone choosing where to send a
sample for a licence.
"""

import pytest

from bis.ingest import labs

# --- state names ----------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("U.P.", "Uttar Pradesh"),
        ("U.P", "Uttar Pradesh"),
        ("Uttar Pradesh", "Uttar Pradesh"),
        ("Utter Pradesh", "Uttar Pradesh"),
        ("Karnatka", "Karnataka"),
        ("Telengana", "Telangana"),
        ("Kerla", "Kerala"),
        ("Harayana", "Haryana"),
        ("Pubjab", "Punjab"),
        ("Maharshtra", "Maharashtra"),
        ("Rajasth an", "Rajasthan"),
        ("Uttra Khand", "Uttarakhand"),
        ("Tamilnadu", "Tamil Nadu"),
        ("W.B", "West Bengal"),
        ("J & K", "Jammu and Kashmir"),
        ("New Delhi", "Delhi"),
        ("Orissa", "Odisha"),
    ],
)
def test_state_variants_collapse_to_one_name(raw, expected):
    """Regression: the filter offered "U.P." and "Uttar Pradesh" separately,
    so choosing either hid most of the laboratories in that state."""
    assert labs.normalise_state(raw) == expected


def test_a_city_in_the_state_column_is_corrected():
    """Guwahati is entered as a state in the source. It is in Assam."""
    assert labs.normalise_state("Guwahati") == "Assam"


def test_an_unknown_state_is_kept_rather_than_dropped():
    assert labs.normalise_state("Ladakh") == "Ladakh"


def test_a_blank_state_is_none():
    assert labs.normalise_state("   ") is None


# --- city extraction ------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("AES Laboratories (P) Ltd, Noida", "Noida"),
        ("Anacon Laboratories Pvt Ltd, Nagpur", "Nagpur"),
        ("Some Lab, Bangalore", "Bengaluru"),
        ("Some Lab, Gurgaon", "Gurugram"),
        ("Some Lab, Cochin", "Kochi"),
    ],
)
def test_the_trailing_segment_is_the_city(name, expected):
    assert labs.city_from_name(name) == expected


@pytest.mark.parametrize(
    "name",
    [
        "AANKAN CALIBRATION AND TESTING CENTRE LLP",
        "Indian Oil Corporation Ltd(IOCL), Kakinada Laboratory",
        "Something, Quality Control Services",
        "No comma here",
    ],
)
def test_a_trailing_company_fragment_is_not_a_city(name):
    """Regression: "Kakinada Laboratory" was read as a city because the word
    boundary after "laborator" never matched the trailing "y"."""
    assert labs.city_from_name(name) is None


# --- suspension status ----------------------------------------------------


def test_no_remarks_means_operative():
    assert labs.latest_status("") is True


def test_a_bare_suspension_is_current():
    assert labs.latest_status("Suspended w.e.f. 30.04.2026") is False


def test_a_later_revocation_restores_it():
    assert labs.latest_status(
        "Suspension revoked w.e.f. 27-05-2026. Suspended w.e.f. 23.04.2026"
    ) is True


def test_order_in_the_column_does_not_decide_it():
    """The entries are not reliably newest-first: here the revocation is
    written first but the suspension that follows it is nine months later."""
    assert labs.latest_status(
        "Suspension revoked w.e.f. 13-01-2025. Suspended w.e.f. 24.10.2025"
    ) is False


def test_malformed_dates_do_not_derail_the_reading():
    """The source contains "06.04..2022" - a doubled separator."""
    assert labs.latest_status(
        "Suspension revoked w.e.f. 06.04..2022. Suspended w.e.f. 01.01.2020"
    ) is True


def test_an_undated_mention_of_suspension_is_not_taken_as_current():
    """Without a date there is nothing to compare, and guessing "suspended"
    would strike a working laboratory off the list."""
    assert labs.latest_status("Suspension revoked. Present status operative") is True


# --- row assembly ---------------------------------------------------------


def _row(sl, name, state, category, osl, valid, remarks=""):
    return [sl, name, state, category, osl, valid, remarks]


def test_a_row_becomes_a_record(monkeypatch):
    monkeypatch.setattr(
        labs,
        "_rows_from_pdf",
        lambda path: [_row("1.", "AES Laboratories (P) Ltd, Noida", "U.P.", "Private", "8117716", "14.02.2027")],
    )
    source = labs.SOURCES[0]
    [record] = labs.parse_list(source, path=None)  # type: ignore[arg-type]

    assert record.name == "AES Laboratories (P) Ltd, Noida"
    assert record.city == "Noida"
    assert record.state == "Uttar Pradesh"
    assert record.osl_code == "8117716"
    assert record.valid_to == "2027-02-14"
    assert record.operative is True
    assert record.schemes == "BIS recognised (Group 1)"


def test_scope_and_contact_stay_empty(monkeypatch):
    """Neither is published. A plausible-looking placeholder in either field is
    the defect this whole ingest exists to remove."""
    monkeypatch.setattr(
        labs,
        "_rows_from_pdf",
        lambda path: [_row("1.", "A Lab, Pune", "Maharashtra", "Private", "1", "01.01.2030")],
    )
    [record] = labs.parse_list(labs.SOURCES[0], path=None)  # type: ignore[arg-type]
    assert record.scope is None
    assert record.contact is None


def test_a_nameless_row_folds_into_the_one_above(monkeypatch):
    """The Remarks column overflows into rows of its own. Left alone those
    become nameless laboratories; the text belongs to the row before."""
    monkeypatch.setattr(
        labs,
        "_rows_from_pdf",
        lambda path: [
            _row("1.", "A Lab, Pune", "Maharashtra", "Private", "1", "01.01.2030",
                 "Suspension revoked w.e.f. 01.01.2024."),
            _row("", "", "", "", "", "", "Suspended w.e.f. 05.05.2029"),
        ],
    )
    records = labs.parse_list(labs.SOURCES[0], path=None)  # type: ignore[arg-type]

    assert len(records) == 1
    assert "05.05.2029" in records[0].remarks
    # The folded-in event is newer, so the status is recomputed from both.
    assert records[0].operative is False


def test_group_two_is_labelled_as_not_recognised(monkeypatch):
    """BIS says plainly that Group 2 laboratories are not recognised and not
    audited. Merging them into one list would overstate 352 entries."""
    monkeypatch.setattr(
        labs,
        "_rows_from_pdf",
        lambda path: [["1.", "Some Facility, Pune", "Maharashtra", "Govt.", "9999"]],
    )
    [record] = labs.parse_list(labs.SOURCES[1], path=None)  # type: ignore[arg-type]
    assert record.schemes == "Facility used by BIS, not recognised (Group 2)"
    assert record.valid_to is None


def test_every_source_is_a_bis_url():
    for source in labs.SOURCES:
        assert source.url.startswith("https://www.bis.gov.in/")
