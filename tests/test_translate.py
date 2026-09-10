"""Tests for answer translation.

The model call is monkeypatched throughout. What is covered is our handling of
what comes back - above all the refusal to publish a translation that has lost
its citations, which is the one failure that would turn a sourced answer into
an unsourced one without anybody noticing.
"""

import pytest

from bis.i18n import translate as tr

ENGLISH = "HUID is a six-digit alphanumeric code [S1]. It is unique to each article [S2]."


def returns(text):
    def _fake(messages, **kwargs):
        return text

    return _fake


# --- the citation guarantee -----------------------------------------------


def test_a_faithful_translation_is_returned(monkeypatch):
    monkeypatch.setattr(tr, "chat", returns("HUID एक छह-अंकीय कोड है [S1]। यह अनन्य है [S2]।"))
    result = tr.translate(ENGLISH, "hi")
    assert result.translated is True
    assert result.warning is None
    assert "[S1]" in result.text and "[S2]" in result.text


def test_a_translation_that_drops_a_citation_is_refused(monkeypatch):
    """The whole point. An answer that arrives without its markers reads just
    as authoritative and can no longer be checked against anything."""
    monkeypatch.setattr(tr, "chat", returns("HUID एक छह-अंकीय कोड है [S1]। यह अनन्य है।"))
    result = tr.translate(ENGLISH, "hi")

    assert result.translated is False
    assert result.text == ENGLISH
    assert "citations" in (result.warning or "")


def test_dropping_every_citation_is_refused(monkeypatch):
    monkeypatch.setattr(tr, "chat", returns("HUID एक छह-अंकीय कोड है।"))
    assert tr.translate(ENGLISH, "hi").translated is False


def test_extra_markers_are_tolerated(monkeypatch):
    """A duplicated marker is untidy but loses nothing; the answer's own
    citation validator has already decided which markers are real."""
    monkeypatch.setattr(tr, "chat", returns("क [S1]। ख [S2]। ग [S1]।"))
    assert tr.translate(ENGLISH, "hi").translated is True


def test_an_answer_with_no_citations_translates_normally(monkeypatch):
    monkeypatch.setattr(tr, "chat", returns("नमस्ते, मैं मदद कर सकता हूँ।"))
    result = tr.translate("Hello, I can help with BIS questions.", "hi")
    assert result.translated is True


# --- failure handling -----------------------------------------------------


def test_a_provider_failure_returns_the_original(monkeypatch):
    def boom(messages, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(tr, "chat", boom)
    result = tr.translate(ENGLISH, "hi")

    assert result.translated is False
    assert result.text == ENGLISH
    assert result.warning


def test_an_unsupported_language_is_rejected():
    with pytest.raises(ValueError):
        tr.translate(ENGLISH, "xx")


def test_empty_text_makes_no_model_call(monkeypatch):
    def should_not_run(messages, **kwargs):
        raise AssertionError("empty text should not reach the model")

    monkeypatch.setattr(tr, "chat", should_not_run)
    assert tr.translate("   ", "hi").translated is False


# --- what the picker offers -----------------------------------------------


def test_every_language_has_an_endonym():
    """A speaker looks for their language written the way they write it."""
    assert set(tr.LANGUAGES) == set(tr.LANGUAGE_NAMES)
    for code, name in tr.LANGUAGE_NAMES.items():
        assert name and not name.isascii(), code


def test_the_prompt_names_the_target_language():
    prompt = tr.SYSTEM_PROMPT.format(language="Tamil")
    assert "Tamil" in prompt
    assert "[S1]" in prompt


@pytest.mark.parametrize("code", sorted(tr.LANGUAGES))
def test_each_language_round_trips(monkeypatch, code):
    monkeypatch.setattr(tr, "chat", returns("translated [S1] [S2]"))
    result = tr.translate(ENGLISH, code)
    assert result.language == code
    assert result.translated is True
