"""Business context and next-step suggestions for the chat interface.

The frontend posts the conversation it already holds; this returns what the
assistant can reasonably infer about the user's business, plus what they might
usefully ask next.

The history is supplied by the caller rather than fetched here. The frontend
reads it from Supabase, where row-level security confines each account to its
own messages, so nothing in this service can reach another user's conversation -
it never touches the table.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from bis.agent import business_context

log = logging.getLogger(__name__)
router = APIRouter(tags=["context"])


class HistoryMessage(BaseModel):
    role: str
    content: str = Field(max_length=8000)


class ContextRequest(BaseModel):
    # Capped so a long-running account cannot send an unbounded transcript.
    messages: list[HistoryMessage] = Field(default_factory=list, max_length=200)
    last_question: str | None = Field(default=None, max_length=2000)
    # The interface language; the headline and suggestions are written in it.
    language: str = Field(default="en", pattern="^(en|hi)$")


class ContextResponse(BaseModel):
    """What the interface needs to decide between onboarding and welcome-back."""

    is_new_user: bool
    business_context: dict
    suggestions: list[str]


@router.post("/context", response_model=ContextResponse)
def get_context(request: ContextRequest) -> ContextResponse:
    """Infer business context and propose next steps.

    `is_new_user` drives which opening state the chat shows. It is true whenever
    there is nothing trustworthy to personalise with - including for someone who
    has talked to the assistant before but only ever asked general questions.
    Someone whose entire history is "what is BIS certification?" has no business
    context, and pretending otherwise would mean inventing one.
    """
    messages = [m.model_dump() for m in request.messages]
    context = business_context.extract(messages)
    suggestions = business_context.suggest(
        context, last_question=request.last_question, language=request.language
    )

    return ContextResponse(
        is_new_user=not context.is_usable,
        business_context=context.to_dict(request.language),
        suggestions=suggestions,
    )
