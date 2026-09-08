"""Tests for RRF fusion and citation validation."""

import pytest

from bis.guardrails.citations import (
    Evidence,
    find_unsupported_clause_claims,
    format_evidence_block,
    validate,
)
from bis.retrieval.fusion import reciprocal_rank_fusion


def ev(index: int, **kw) -> Evidence:
    defaults = dict(
        chunk_uid=f"uid{index}",
        text=kw.pop("text", "some evidence text"),
        title=f"Doc {index}",
        url=f"https://example.invalid/{index}",
    )
    defaults.update(kw)
    return Evidence(index=index, **defaults)


# --- RRF ---------------------------------------------------------------


def test_rrf_rewards_agreement_between_arms():
    dense = ["a", "b", "c"]
    sparse = ["b", "a", "d"]
    scores = reciprocal_rank_fusion([dense, sparse], k=60)
    # "b" is 2nd and 1st; "a" is 1st and 2nd - symmetric, so they tie, and both
    # must outrank items that appear in only one list.
    assert scores["a"] == pytest.approx(scores["b"])
    assert scores["a"] > scores["c"]
    assert scores["a"] > scores["d"]


def test_rrf_uses_standard_formula():
    scores = reciprocal_rank_fusion([["x"]], k=60)
    assert scores["x"] == pytest.approx(1 / 61)


def test_rrf_k_damps_top_rank_dominance():
    lists = [["a", "b"], ["b", "a"]]
    small_k = reciprocal_rank_fusion(lists, k=1)
    large_k = reciprocal_rank_fusion(lists, k=200)
    spread_small = max(small_k.values()) - min(small_k.values())
    spread_large = max(large_k.values()) - min(large_k.values())
    assert spread_large <= spread_small


def test_rrf_handles_empty_arm():
    scores = reciprocal_rank_fusion([["a", "b"], []], k=60)
    assert set(scores) == {"a", "b"}
    assert scores["a"] > scores["b"]


def test_rrf_weights_apply():
    lists = [["a"], ["b"]]
    scores = reciprocal_rank_fusion(lists, k=60, weights=[2.0, 1.0])
    assert scores["a"] > scores["b"]


def test_rrf_rejects_mismatched_weights():
    with pytest.raises(ValueError):
        reciprocal_rank_fusion([["a"], ["b"]], weights=[1.0])


# --- Citation validation ------------------------------------------------


def test_valid_markers_are_kept_and_reported():
    evidence = [ev(1), ev(2)]
    result = validate("Registration is mandatory [S1]. Fees vary [S2].", evidence)
    assert "[S1]" in result.text
    assert "[S2]" in result.text
    assert [s["marker"] for s in result.sources] == ["S1", "S2"]
    assert result.is_clean


def test_hallucinated_marker_is_stripped():
    evidence = [ev(1)]
    result = validate("This is required [S1] and also this [S7].", evidence)
    assert "[S7]" not in result.text
    assert "[S1]" in result.text
    assert result.dropped_markers == ["[S7]"]
    assert not result.is_clean


def test_only_cited_sources_are_returned():
    evidence = [ev(1), ev(2), ev(3)]
    result = validate("Only the first matters [S1].", evidence)
    assert [s["marker"] for s in result.sources] == ["S1"]


def test_answer_with_evidence_but_no_markers_is_flagged():
    result = validate("Registration is mandatory.", [ev(1)])
    assert result.uncited
    assert not result.is_clean


def test_no_evidence_and_no_markers_is_not_flagged():
    # Small talk and refusals legitimately cite nothing.
    result = validate("I can help with BIS certification questions.", [])
    assert not result.uncited
    assert result.is_clean


def test_source_carries_locator_and_url():
    evidence = [ev(1, clause="4.2.1", page=12, is_number="IS 15111")]
    result = validate("See the marking rule [S1].", evidence)
    source = result.sources[0]
    assert source["locator"] == "clause 4.2.1, p. 12"
    assert source["url"] == "https://example.invalid/1"
    assert source["is_number"] == "IS 15111"


def test_whitespace_is_tidied_after_stripping():
    result = validate("Certification is needed [S9] .", [ev(1)])
    assert "  " not in result.text
    assert result.text.endswith(".")


# --- Clause-claim grounding ---------------------------------------------


def test_unsupported_clause_claim_is_detected():
    evidence = [ev(1, text="The licensee shall maintain records.")]
    unsupported = find_unsupported_clause_claims(
        "You must comply with clause 7.3 of the standard.", evidence
    )
    assert unsupported == ["7.3"]


def test_clause_claim_supported_by_evidence_metadata_passes():
    evidence = [ev(1, clause="7.3", text="Records shall be maintained.")]
    assert find_unsupported_clause_claims("See clause 7.3.", evidence) == []


def test_clause_claim_supported_by_evidence_text_passes():
    evidence = [ev(1, text="4.2.1 Marking\nEach lamp shall be marked.")]
    assert find_unsupported_clause_claims("As per clause 4.2.1, mark it.", evidence) == []


def test_evidence_block_labels_every_passage():
    block = format_evidence_block([ev(1, clause="2.1"), ev(2)])
    assert "[S1]" in block and "[S2]" in block
    assert "clause 2.1" in block
    assert "https://example.invalid/1" in block
