"""Chat endpoints.

The SSE event shapes here are the contract published in docs/FRONTEND_PROMPT.md.
Changing one means changing the other, or the frontend breaks silently.
"""

from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from bis.agent import answer as answer_mod

log = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None
    language: str = "auto"


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    session_id: str
    abstained: bool
    intent: str
    latency_ms: float
    structured: dict = {}
    warnings: list[str] = []


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """Answer a question in one response. Fallback when SSE is unavailable."""
    result = answer_mod.answer(request.message)
    return ChatResponse(
        answer=result.text,
        sources=result.sources,
        session_id=request.session_id or str(uuid.uuid4()),
        abstained=result.abstained,
        intent=result.intent,
        latency_ms=result.latency_ms,
        structured=result.structured,
        warnings=result.warnings,
    )


@router.post("/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Answer as Server-Sent Events."""
    session_id = request.session_id or str(uuid.uuid4())

    def event_stream():
        try:
            for event in answer_mod.answer_stream(request.message):
                if event.get("event") == "done":
                    event["session_id"] = session_id
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as exc:
            log.exception("chat stream failed")
            payload = {"event": "error", "message": str(exc)[:200]}
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Without this, nginx buffers the whole response and the client
            # sees one burst at the end instead of a stream.
            "X-Accel-Buffering": "no",
        },
    )
