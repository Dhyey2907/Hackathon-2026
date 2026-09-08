"""Tests for catalogue ingestion helpers."""

from bis.ingest.scrape_catalogue import (
    committee_code,
    is_number_root,
    normalize_is_number,
    parse_year,
)


def test_normalize_collapses_whitespace():
    assert normalize_is_number("IS  302  (Part 1) : 2024") == "IS 302 (Part 1) : 2024"


def test_normalize_uppercases_prefix():
    # BIS data entry is inconsistent: the catalogue holds "Is 2347:2023".
    assert normalize_is_number("Is 2347:2023") == "IS 2347:2023"
    assert normalize_is_number("is 694:2010") == "IS 694:2010"


def test_normalize_preserves_iso_iec_designations():
    assert normalize_is_number("IS/ISO 603 (Part 14):2026").startswith("IS/ISO 603")
    assert normalize_is_number("is/iec 62368:2023").startswith("IS/IEC 62368")


def test_root_strips_part_and_year():
    assert is_number_root("IS 302 (Part 1):2024") == "IS 302"
    assert is_number_root("IS 9873 (Part 12):2025") == "IS 9873"
    assert is_number_root("IS 269:2015") == "IS 269"


def test_root_is_case_insensitive():
    # The bug this guards: a case-sensitive check reported IS 2347 as missing
    # when the catalogue held it as "Is 2347:2023".
    assert is_number_root("Is 2347:2023") == is_number_root("IS 2347")


def test_root_of_bare_number_is_itself():
    assert is_number_root("IS 1786") == "IS 1786"


def test_parse_year():
    assert parse_year("2015-12-31") == 2015
    assert parse_year(None) is None
    assert parse_year("") is None


def test_committee_code():
    assert committee_code({"aliasName": "ETD", "committeeNumber": "9"}) == "ETD 9"
    assert committee_code({"aliasName": "CED", "committeeNumber": 2}) == "CED 2"
