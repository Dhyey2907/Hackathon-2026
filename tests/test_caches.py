"""Tests for the answer cache and the FAQ fast path."""

import pytest

from bis.agent import answer_cache, faq_cache


@pytest.fixture(autouse=True)
def clean_cache():
    answer_cache.clear()
    yield
    answer_cache.clear()


class FakeAnswer:
    def __init__(self, text="answer"):
        self.text = text


# --- key normalisation ----------------------------------------------------


def test_case_and_punctuation_are_noise():
    assert answer_cache.normalise("What is FMCS?") == answer_cache.normalise("what is fmcs")
    assert answer_cache.normalise("What is FMCS ?") == answer_cache.normalise("What is FMCS")


def test_internal_whitespace_collapses():
    assert answer_cache.normalise("what   is    FMCS") == "what is fmcs"


def test_different_words_are_different_questions():
    """The cache must not guess that two questions mean the same thing."""
    a = answer_cache.normalise("Who needs a BIS licence?")
    b = answer_cache.normalise("Who needs a CRS registration?")
    assert a != b


# --- cache behaviour ------------------------------------------------------


def test_repeat_question_returns_the_same_object():
    original = FakeAnswer("cited answer [S1]")
    answer_cache.put("What is FMCS?", original)
    assert answer_cache.get("what is fmcs") is original


def test_miss_returns_none():
    assert answer_cache.get("never asked") is None


def test_eviction_is_least_recently_used(monkeypatch):
    monkeypatch.setattr(answer_cache, "MAX_ENTRIES", 3)
    for i in range(3):
        answer_cache.put(f"q{i}", FakeAnswer(str(i)))
    answer_cache.get("q0")            # q0 becomes most recent
    answer_cache.put("q3", FakeAnswer("3"))   # evicts q1, the oldest untouched

    assert answer_cache.get("q0") is not None
    assert answer_cache.get("q1") is None
    assert answer_cache.get("q3") is not None


def test_blank_question_is_not_cached():
    answer_cache.put("   ", FakeAnswer())
    assert answer_cache.stats()["entries"] == 0


def test_clear_drops_everything():
    answer_cache.put("q", FakeAnswer())
    answer_cache.clear()
    assert answer_cache.stats()["entries"] == 0


def test_stats_track_hit_rate():
    answer_cache.put("q", FakeAnswer())
    answer_cache.get("q")
    answer_cache.get("missing")
    stats = answer_cache.stats()
    assert stats["hits"] == 1 and stats["misses"] == 1
    assert stats["hit_rate"] == 0.5


# --- FAQ question extraction ----------------------------------------------


def test_answer_marker_splits_question_from_answer():
    text = "Q3 If stock could not be exhausted, what do we do?\nA3 : The stock may be sold."
    assert faq_cache._question_of(text) == "If stock could not be exhausted, what do we do?"


def test_question_mark_used_when_no_answer_marker():
    text = "Q8 What is the fee structure?\nFor details of Fee Structure, click here."
    assert faq_cache._question_of(text) == "What is the fee structure?"


def test_first_line_used_when_neither_marker_present():
    # Regression: this case previously swallowed the whole answer into the
    # question, which dragged the similarity score down and caused a
    # verbatim question to match the wrong entry.
    text = "Q8 What is the fee structure\nLIST OF FEES TO BE CHARGED FROM APPLICANTS"
    assert faq_cache._question_of(text) == "What is the fee structure"


def test_extraction_collapses_wrapped_lines():
    text = "Q1 As a manufacturer located outside India\ncan we import cells?\nA1 : No."
    assert "\n" not in faq_cache._question_of(text)


# --- FAQ matching guards --------------------------------------------------


def _entry(question, vector):
    return faq_cache.FaqEntry(
        chunk_uid="c1", question=question, text=question, doc_title="FAQ",
        source_url=None, clause="Q1", page=1, embedding=vector,
    )


def test_weak_similarity_falls_through(monkeypatch):
    monkeypatch.setattr(faq_cache, "_entries", [_entry("a", [1.0, 0.0]), _entry("b", [0.0, 1.0])])
    monkeypatch.setattr(faq_cache.embed_mod, "embed_query", lambda q: [0.6, 0.6])
    assert faq_cache.match("something unrelated") is None


def test_ambiguous_match_falls_through(monkeypatch):
    """Two FAQs matching about equally is a coin flip, so answer neither."""
    monkeypatch.setattr(
        faq_cache, "_entries",
        [_entry("a", [1.0, 0.0]), _entry("b", [0.999, 0.044])],
    )
    monkeypatch.setattr(faq_cache.embed_mod, "embed_query", lambda q: [1.0, 0.0])
    assert faq_cache.match("ambiguous") is None


def test_strong_unambiguous_match_is_served(monkeypatch):
    monkeypatch.setattr(
        faq_cache, "_entries",
        [_entry("exact", [1.0, 0.0]), _entry("other", [0.0, 1.0])],
    )
    monkeypatch.setattr(faq_cache.embed_mod, "embed_query", lambda q: [1.0, 0.0])
    hit = faq_cache.match("exact")
    assert hit is not None
    assert hit.entry.question == "exact"
    assert hit.to_source()["locator"] == "clause Q1, p. 1"


def test_embedding_failure_does_not_break_answering(monkeypatch):
    def boom(q):
        raise RuntimeError("provider down")

    monkeypatch.setattr(faq_cache, "_entries", [_entry("a", [1.0, 0.0])])
    monkeypatch.setattr(faq_cache.embed_mod, "embed_query", boom)
    assert faq_cache.match("anything") is None
