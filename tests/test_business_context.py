"""Tests for business-context extraction, confidence and suggestions.

The LLM call is monkeypatched throughout: these cover our handling of what the
model returns - the confidence rules, the evidence check, the hedging and the
fabrication filter - not the model's judgement.
"""

import pytest

from bis.agent import business_context as bc


@pytest.fixture(autouse=True)
def clear():
    bc.clear_cache()
    yield
    bc.clear_cache()


def user(*texts):
    return [{"role": "user", "content": t} for t in texts]


def model_returns(payload):
    def _fake(messages, **kwargs):
        return payload

    return _fake


# --- what counts as usable context ---------------------------------------


def test_explicit_statement_is_high_confidence_and_usable(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["pressure cookers"], "role": "manufacturer",
        "confidence": "high", "evidence": "I manufacture pressure cookers",
    }))
    ctx = bc.extract(user("I manufacture pressure cookers"))
    assert ctx.confidence == "high"
    assert ctx.role == "manufacturer"
    assert ctx.is_usable


def test_a_seller_is_never_promoted_to_manufacturer(monkeypatch):
    """"I sell jewellery" must not become "makes jewellery"."""
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["jewellery"], "role": "seller",
        "confidence": "high", "evidence": "I sell jewellery",
    }))
    assert bc.extract(user("I sell jewellery")).role == "seller"


def test_low_confidence_is_not_usable(monkeypatch):
    """One passing mention is not a business, and must not drive the UI."""
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["concrete"], "role": "unknown",
        "confidence": "low", "evidence": None,
    }))
    ctx = bc.extract(user("Is IS 456 about concrete?"))
    assert not ctx.is_usable
    assert ctx.headline() is None


def test_general_questions_yield_no_business(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": [], "role": "unknown", "confidence": "none", "evidence": None,
    }))
    assert not bc.extract(user("What is BIS certification?")).is_usable


def test_no_messages_makes_no_model_call(monkeypatch):
    def should_not_run(messages, **kwargs):
        raise AssertionError("no history should mean no extraction call")

    monkeypatch.setattr(bc, "chat_json", should_not_run)
    assert bc.extract([]).confidence == "none"


def test_assistant_turns_are_ignored(monkeypatch):
    """The assistant discusses whatever was asked; only the user describes themselves."""
    seen = {}

    def capture(messages, **kwargs):
        seen["prompt"] = messages[1]["content"]
        return {"products": [], "confidence": "none"}

    monkeypatch.setattr(bc, "chat_json", capture)
    bc.extract([
        {"role": "user", "content": "what is BIS"},
        {"role": "assistant", "content": "hallmarking covers gold purity"},
    ])
    assert "hallmarking" not in seen["prompt"]


# --- the evidence check ---------------------------------------------------


def test_high_confidence_without_quotable_evidence_is_demoted(monkeypatch):
    """A claim the user never made cannot stay high confidence."""
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["helmets"], "role": "manufacturer", "confidence": "high",
        "evidence": "I run a large helmet factory in Pune",  # never said
    }))
    ctx = bc.extract(user("what standard covers helmets?"))
    assert ctx.confidence == "medium"


def test_evidence_matching_tolerates_rewording(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["cables"], "role": "manufacturer", "confidence": "high",
        "evidence": "manufacture electrical cables",
    }))
    ctx = bc.extract(user("I manufacture electrical cables for housing"))
    assert ctx.confidence == "high"


# --- how it is said back to the user --------------------------------------


def test_stated_context_is_asserted(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["helmets"], "role": "manufacturer",
        "confidence": "high", "evidence": "I manufacture helmets",
    }))
    assert bc.extract(user("I manufacture helmets")).headline() == "you're working with helmets"


def test_inferred_context_is_hedged(monkeypatch):
    """Never tell someone what they do when they only asked about it."""
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["pressure cookers"], "role": "unknown",
        "confidence": "medium", "evidence": None,
    }))
    headline = bc.extract(user("what certification do pressure cookers need?")).headline()
    assert headline == "you've been asking about pressure cookers"
    assert "you manufacture" not in headline


# --- the prompt block handed to the answering model -----------------------


def test_prompt_block_omits_unknown_role(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": ["cement"], "role": "unknown", "confidence": "medium",
    }))
    block = bc.extract(user("cement standards?")).prompt_block()
    assert "cement" in block
    assert "unknown" not in block


def test_unusable_context_produces_no_prompt_block(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "products": [], "confidence": "none",
    }))
    assert bc.extract(user("what is BIS?")).prompt_block() is None


# --- suggestions ----------------------------------------------------------


def test_suggestions_naming_a_standard_are_dropped(monkeypatch):
    """Regression: a packaged-water business was offered "Check IS 14228
    compliance". The real standard is IS 14543. A suggestion carries no
    sources, so the citation validator never sees it - it must not name one."""
    monkeypatch.setattr(bc, "chat_json", model_returns({"suggestions": [
        "Check IS 14228 compliance",
        "Find a testing lab",
        "Prepare documents",
        "Understand marking rules",
    ]}))
    out = bc.suggest(bc.BusinessContext(products=["water"], confidence="high"))
    assert not any("14228" in s for s in out)
    assert "Find a testing lab" in out


@pytest.mark.parametrize("bad", [
    "Check IS 14228 compliance", "Review IS/IEC 62368",
    "Compare IS/ISO 603 parts", "IEC 61215 testing",
])
def test_standard_number_forms_are_all_caught(bad):
    assert bc._drops_a_standard_number(bad)


@pytest.mark.parametrize("good", [
    "Check applicable standards", "Find a testing lab",
    "Required documents", "Understand marking rules",
])
def test_ordinary_suggestions_survive(good):
    assert not bc._drops_a_standard_number(good)


def test_a_new_user_still_gets_something_to_ask(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({"suggestions": []}))
    assert bc.suggest(bc.BusinessContext()) == bc.GENERIC_SUGGESTIONS


def test_suggestions_are_capped(monkeypatch):
    monkeypatch.setattr(bc, "chat_json", model_returns({
        "suggestions": [f"Action {i}" for i in range(9)]
    }))
    assert len(bc.suggest(bc.BusinessContext(products=["x"], confidence="high"))) <= 4


def test_model_failure_falls_back_rather_than_raising(monkeypatch):
    def boom(messages, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(bc, "chat_json", boom)
    assert bc.suggest(bc.BusinessContext(products=["x"], confidence="high"))
    assert bc.extract(user("I make helmets")).confidence == "none"


# --- context is not evidence ----------------------------------------------


def test_user_context_is_labelled_separately_from_sources():
    """Context must never enter the SOURCES block, where it would be citable."""
    from bis.agent.answer import _with_user_context

    prompt = _with_user_context("Which standard applies?", "works with: helmets")
    assert prompt.startswith("[About the user:")
    assert "Which standard applies?" in prompt


def test_absent_context_leaves_the_question_untouched():
    from bis.agent.answer import _with_user_context

    assert _with_user_context("What is BIS?", None) == "What is BIS?"


# --------------------------------------------------------------- Hindi


def test_hindi_headline_keeps_the_hedge():
    stated = bc.BusinessContext(products=["helmets"], confidence="high")
    inferred = bc.BusinessContext(products=["helmets"], confidence="medium")
    assert stated.headline("hi") == "आप helmets के साथ काम करते हैं"
    assert inferred.headline("hi") == "आप helmets के बारे में पूछते रहे हैं"
    # English is unchanged, and remains the default.
    assert stated.headline() == "you're working with helmets"
    assert stated.to_dict("hi")["headline"] == stated.headline("hi")


def test_a_new_hindi_user_gets_hindi_starters():
    assert bc.suggest(bc.BusinessContext(), language="hi") == bc.GENERIC_SUGGESTIONS_HI


def test_hindi_suggestions_are_asked_for_in_hindi(monkeypatch):
    seen = {}

    def capture(messages, **kwargs):
        seen["system"] = messages[0]["content"]
        return {"suggestions": ["परीक्षण प्रयोगशाला खोजें", "आवश्यक दस्तावेज़", "लागू मानक जाँचें"]}

    monkeypatch.setattr(bc, "chat_json", capture)
    out = bc.suggest(bc.BusinessContext(products=["helmets"], confidence="high"), language="hi")
    assert "Hindi" in seen["system"]
    assert out[0] == "परीक्षण प्रयोगशाला खोजें"


def test_english_suggestions_prompt_is_unchanged(monkeypatch):
    seen = {}

    def capture(messages, **kwargs):
        seen["system"] = messages[0]["content"]
        return {"suggestions": ["Find a testing lab", "Required documents", "Check applicable standards"]}

    monkeypatch.setattr(bc, "chat_json", capture)
    bc.suggest(bc.BusinessContext(products=["helmets"], confidence="high"))
    assert seen["system"] == bc.SUGGEST_PROMPT
