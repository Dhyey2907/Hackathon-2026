"""Read an uploaded document so it can go to the assistant with a question.

The file is sent as base64 in JSON rather than as multipart form data, which
keeps this service free of a form-parsing dependency for what is one endpoint
and one file at a time. It is read in memory and not stored: the extracted
text is returned to the browser, and the browser sends it with the next
question. See `bis.documents.extract` for what can and cannot be read.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from bis.documents import extract as extract_mod

log = logging.getLogger(__name__)
router = APIRouter(tags=["documents"])


class ExtractRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    # 10 MB of file is about 13.4 MB once base64-encoded.
    content_base64: str = Field(min_length=1, max_length=14_500_000)


class ExtractResponse(BaseModel):
    filename: str
    kind: str
    text: str
    pages: int | None
    characters: int
    truncated: bool
    """False when no text could be read; `message` then says why."""
    readable: bool
    message: str | None = None


@router.post("/extract", response_model=ExtractResponse)
def post_extract(request: ExtractRequest) -> ExtractResponse:
    try:
        data = extract_mod.decode(request.content_base64)
    except extract_mod.ExtractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = extract_mod.extract(request.filename, data)
    return ExtractResponse(
        filename=result.filename,
        kind=result.kind,
        text=result.text,
        pages=result.pages,
        characters=result.characters,
        truncated=result.truncated,
        readable=result.readable,
        message=result.message,
    )
