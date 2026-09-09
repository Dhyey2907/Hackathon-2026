"""Tests for JSON-mode token budget and write retry."""

import pytest

from bis import llm
from bis.store import supabase_store

# --- JSON mode headroom ---------------------------------------------------


def test_chat_json_requests_generous_token_budget(monkeypatch):
    """Regression: a 512-token cap made JSON mode fail outright.

    gpt-oss reasons before answering and those tokens come from the same
    budget, so the API returned 400 "max completion tokens reached before
    generating a valid document" - not a truncated string we could salvage.
    The failure then fell back to the larger model and tripped a 413.
    """
    seen = {}

    def fake_chat(messages, **kwargs):
        seen.update(kwargs)
        return '{"intent": "certification"}'

    monkeypatch.setattr(llm, "chat", fake_chat)
    llm.chat_json([{"role": "user", "content": "hi"}])
    assert seen["max_tokens"] >= 2000, "JSON mode needs room for reasoning tokens"
    assert seen["json_mode"] is True


def test_chat_json_returns_default_on_unparseable_output(monkeypatch):
    monkeypatch.setattr(llm, "chat", lambda messages, **kw: "not json at all")
    assert llm.chat_json([], default={"intent": "fallback"}) == {"intent": "fallback"}


def test_chat_json_rejects_non_dict_json(monkeypatch):
    monkeypatch.setattr(llm, "chat", lambda messages, **kw: "[1, 2, 3]")
    assert llm.chat_json([], default={"ok": True}) == {"ok": True}


# --- write retry ----------------------------------------------------------


class _FlakyClient:
    """Fails the first `fail_times` calls, then succeeds."""

    def __init__(self, fail_times: int):
        self.fail_times = fail_times
        self.attempts = 0

    def table(self, _name):
        return self

    def update(self, _values):
        return self

    def eq(self, _col, _val):
        return self

    def execute(self):
        self.attempts += 1
        if self.attempts <= self.fail_times:
            raise ConnectionError("Server disconnected")
        return {"data": []}


def test_update_retries_a_dropped_connection(monkeypatch):
    """Supabase drops connections under concurrent writes; retry rather than lose the row."""
    client = _FlakyClient(fail_times=2)
    monkeypatch.setattr(supabase_store, "get_write_client", lambda: client)
    monkeypatch.setattr(supabase_store.time, "sleep", lambda _s: None)

    supabase_store.update_with_retry("chunks", "chunk_uid", "abc", {"embedding": [0.1]})
    assert client.attempts == 3


def test_update_raises_once_retries_are_exhausted(monkeypatch):
    client = _FlakyClient(fail_times=99)
    monkeypatch.setattr(supabase_store, "get_write_client", lambda: client)
    monkeypatch.setattr(supabase_store.time, "sleep", lambda _s: None)

    with pytest.raises(supabase_store.StoreError):
        supabase_store.update_with_retry("chunks", "chunk_uid", "abc", {"embedding": [0.1]})


def test_update_succeeds_first_time_without_sleeping(monkeypatch):
    client = _FlakyClient(fail_times=0)
    monkeypatch.setattr(supabase_store, "get_write_client", lambda: client)

    def no_sleep(_s):
        raise AssertionError("should not back off on a clean write")

    monkeypatch.setattr(supabase_store.time, "sleep", no_sleep)
    supabase_store.update_with_retry("standards", "is_number", "IS 1", {"embedding": []})
    assert client.attempts == 1
