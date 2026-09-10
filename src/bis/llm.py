"""Groq client wrapper: chat, JSON-mode, streaming, and fallback.

Groq serves text generation only - it has no embeddings
endpoint - so embeddings come from Jina instead (see bis.retrieval.embed).
Reranking is done by a small Groq model here rather than a cross-encoder,
because nothing runs locally (see bis.retrieval.rerank).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from functools import lru_cache
from typing import Any

from groq import APIError, APIStatusError, Groq

from bis.config import get_settings

log = logging.getLogger(__name__)

Message = dict[str, str]


class LLMUnavailable(RuntimeError):
    """Raised when both the primary and the fallback model fail."""


@lru_cache(maxsize=1)
def get_client() -> Groq:
    settings = get_settings()
    if not settings.groq_api_key:
        raise LLMUnavailable("GROQ_API_KEY is not set - copy .env.example to .env")
    return Groq(api_key=settings.groq_api_key)


def chat(
    messages: list[Message],
    *,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 1600,
    json_mode: bool = False,
    use_fallback: bool = True,
) -> str:
    """Single-shot completion. Falls back to the secondary model on failure."""
    settings = get_settings()
    primary = model or settings.groq_answer_model
    candidates = [primary]
    if use_fallback and settings.groq_fallback_model != primary:
        candidates.append(settings.groq_fallback_model)

    last_error: Exception | None = None
    for candidate in candidates:
        try:
            kwargs: dict[str, Any] = {
                "model": candidate,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = get_client().chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except (APIError, APIStatusError) as exc:
            log.warning("Groq model %s failed: %s", candidate, exc)
            last_error = exc

    raise LLMUnavailable(f"all Groq models failed: {last_error}") from last_error


# JSON-mode calls need far more headroom than the output implies. The gpt-oss
# models reason before answering, and those tokens come out of the same budget,
# so a 512-token cap produced "max completion tokens reached before generating
# a valid document" - a 400, not a truncated response. That failure then fell
# back to the secondary model, whose larger prompt promptly hit the free tier's
# input-tokens-per-minute limit, turning one tight number into a 413 cascade.
JSON_MAX_TOKENS = 3000


def chat_json(
    messages: list[Message],
    *,
    model: str | None = None,
    temperature: float = 0.0,
    max_tokens: int = JSON_MAX_TOKENS,
    default: dict | None = None,
) -> dict:
    """Completion parsed as JSON. Returns `default` rather than raising on bad JSON."""
    raw = chat(
        messages,
        model=model or get_settings().groq_router_model,
        temperature=temperature,
        max_tokens=max_tokens,
        json_mode=True,
    )
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Groq returned non-JSON in JSON mode: %.200s", raw)
        return default if default is not None else {}
    return parsed if isinstance(parsed, dict) else (default or {})


def chat_stream(
    messages: list[Message],
    *,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 1600,
) -> Iterator[str]:
    """Yield content deltas. Raises LLMUnavailable before the first token only."""
    settings = get_settings()
    stream = get_client().chat.completions.create(
        model=model or settings.groq_answer_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    for event in stream:
        delta = event.choices[0].delta.content
        if delta:
            yield delta



def health() -> dict:
    """Cheap reachability probe used by GET /health."""
    settings = get_settings()
    if not settings.groq_api_key:
        return {"ok": False, "detail": "GROQ_API_KEY not set"}
    try:
        chat(
            [{"role": "user", "content": "ping"}],
            model=settings.groq_router_model,
            max_tokens=5,
            use_fallback=False,
        )
        return {"ok": True, "model": settings.groq_router_model}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)[:200]}
