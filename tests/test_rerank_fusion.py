"""Tests for reranking, the abstention threshold, and client-side fusion.

The reranker calls a Groq model, so chat_json is monkeypatched throughout - the
tests cover our scoring, filtering and failure handling, not the model's
judgement.
"""

import pytest

from bis.retrieval import rerank as rerank_mod
from bis.retrieval.fusion import fuse_hits, reciprocal_rank_fusion
from bis.store.supabase_store import Hit


def mk(uid: str, text: str = "passage text", score: float = 0.1) -> Hit:
    return Hit(chunk_uid=uid, text=text, payload={"doc_title": uid}, score=score)


def hits(n: int = 6) -> list[Hit]:
    return [mk(f"c{i}", f"passage {i}", score=0.1 - i * 0.01) for i in range(n)]


def fake_scores(mapping: dict[int, float]):
    """Return a chat_json stand-in yielding the given id -> score mapping."""

    def _fake(messages, **kwargs):
        return {"scores": [{"id": i, "score": s} for i, s in mapping.items()]}

    return _fake


# --- reranking ----------------------------------------------------------


def test_rerank_orders_by_model_score(monkeypatch):
    monkeypatch.setattr(
        rerank_mod, "chat_json", fake_scores({0: 2, 1: 9, 2: 5, 3: 1, 4: 8, 5: 0})
    )
    out = rerank_mod.rerank("q", hits(), top_k=3)
    assert [h.chunk_uid for h in out] == ["c1", "c4", "c2"]


def test_rerank_normalises_scores_to_unit_range(monkeypatch):
    monkeypatch.setattr(rerank_mod, "chat_json", fake_scores({i: 10 for i in range(6)}))
    out = rerank_mod.rerank("q", hits(), top_k=2)
    assert all(h.rerank_score == pytest.approx(1.0) for h in out)


def test_irrelevant_passages_are_dropped_below_the_floor(monkeypatch):
    # Only two passages are relevant; top_k=4 must not pad with junk, because
    # off-topic evidence in the prompt invites a wrong citation.
    monkeypatch.setattr(
        rerank_mod, "chat_json", fake_scores({0: 9, 1: 8, 2: 0, 3: 1, 4: 0, 5: 0})
    )
    out = rerank_mod.rerank("q", hits(), top_k=4)
    assert [h.chunk_uid for h in out] == ["c0", "c1"]


def test_all_irrelevant_keeps_one_so_abstention_can_measure_it(monkeypatch):
    monkeypatch.setattr(rerank_mod, "chat_json", fake_scores(dict.fromkeys(range(6), 0)))
    out = rerank_mod.rerank("q", hits(), top_k=3)
    assert len(out) == 1
    assert rerank_mod.evidence_is_weak(out)


def test_missing_score_gets_neutral_not_dropped(monkeypatch):
    # The model scored only ids 0-2; the rest must not silently vanish.
    # 8 candidates against top_k=6 so the reranker does not short-circuit.
    monkeypatch.setattr(rerank_mod, "chat_json", fake_scores({0: 9, 1: 8, 2: 7}))
    out = rerank_mod.rerank("q", hits(8), top_k=6)
    unscored = [h for h in out if h.chunk_uid not in {"c0", "c1", "c2"}]
    assert unscored, "unscored passages were dropped entirely"
    assert all(h.rerank_score == pytest.approx(0.5) for h in unscored)


def test_rerank_falls_back_to_fusion_order_when_model_fails(monkeypatch):
    def boom(messages, **kwargs):
        raise ValueError("model unavailable")

    monkeypatch.setattr(rerank_mod, "chat_json", boom)
    out = rerank_mod.rerank("q", hits(), top_k=3)
    # Degraded ranking beats no answer at all.
    assert [h.chunk_uid for h in out] == ["c0", "c1", "c2"]


def test_rerank_handles_empty_model_response(monkeypatch):
    monkeypatch.setattr(rerank_mod, "chat_json", lambda messages, **kw: {})
    out = rerank_mod.rerank("q", hits(), top_k=2)
    assert len(out) == 2


def test_rerank_skips_model_call_when_already_small(monkeypatch):
    def should_not_run(messages, **kwargs):
        raise AssertionError("model should not be called")

    monkeypatch.setattr(rerank_mod, "chat_json", should_not_run)
    out = rerank_mod.rerank("q", hits(2), top_k=6)
    assert len(out) == 2


def test_rerank_of_empty_list():
    assert rerank_mod.rerank("q", [], top_k=3) == []


# --- abstention ---------------------------------------------------------


def test_no_evidence_is_weak():
    assert rerank_mod.evidence_is_weak([])


def test_strong_evidence_is_not_weak():
    strong = hits(3)
    for h in strong:
        h.rerank_score = 0.9
    assert not rerank_mod.evidence_is_weak(strong)


def test_one_strong_hit_cannot_carry_two_weak_ones():
    # Mean of top 3, not max: a single lucky match must not suppress abstention.
    mixed = hits(3)
    mixed[0].rerank_score = 1.0
    mixed[1].rerank_score = 0.0
    mixed[2].rerank_score = 0.0
    assert rerank_mod.evidence_is_weak(mixed)


# --- client-side fusion -------------------------------------------------


def test_fuse_hits_merges_and_dedupes():
    a = [mk("x"), mk("y")]
    b = [mk("y"), mk("z")]
    fused = fuse_hits([a, b])
    assert [h.chunk_uid for h in fused][0] == "y"
    assert len(fused) == 3


def test_fuse_hits_handles_empty_lists():
    assert fuse_hits([[], []]) == []


def test_fuse_hits_single_list_preserves_order():
    fused = fuse_hits([[mk("a"), mk("b"), mk("c")]])
    assert [h.chunk_uid for h in fused] == ["a", "b", "c"]


def test_rrf_still_matches_reference_formula():
    assert reciprocal_rank_fusion([["x"]], k=60)["x"] == pytest.approx(1 / 61)


def test_rerank_survives_a_rate_limit_error(monkeypatch):
    """A provider rate limit must not take down the request.

    Regression: the except clause listed only (ValueError, TypeError, KeyError,
    JSONDecodeError), so LLMUnavailable from a Groq 413 propagated out of
    rerank and killed the whole answer. Reranking is an optimisation; the
    fusion order is a usable ranking on its own.
    """
    from bis.llm import LLMUnavailable

    def rate_limited(messages, **kwargs):
        raise LLMUnavailable("Error code: 413 - request too large (ITPM)")

    monkeypatch.setattr(rerank_mod, "chat_json", rate_limited)
    out = rerank_mod.rerank("q", hits(20), top_k=3)
    assert [h.chunk_uid for h in out] == ["c0", "c1", "c2"]


def test_rerank_caps_how_many_candidates_reach_the_model(monkeypatch):
    """Only the head of the list is scored, to stay inside token limits."""
    seen = {}

    def capture(messages, **kwargs):
        seen["passages"] = messages[1]["content"].count("\n---\n") + 1
        return {"scores": [{"id": i, "score": 9} for i in range(rerank_mod.MAX_CANDIDATES)]}

    monkeypatch.setattr(rerank_mod, "chat_json", capture)
    rerank_mod.rerank("q", hits(40), top_k=5)
    assert seen["passages"] <= rerank_mod.MAX_CANDIDATES
