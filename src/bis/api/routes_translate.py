"""Translate an answer the user is already looking at.

Deliberately a separate endpoint rather than a parameter on /chat. The answer
is composed and its citations validated in English, against an English corpus;
translating afterwards keeps that check on the text it was written for, and
keeps the English original one click away. A `language` field on /chat would
mean every claim reaching the user had passed through a translation nobody
verified.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from bis.i18n import translate as translate_mod

log = logging.getLogger(__name__)
router = APIRouter(tags=["translate"])


class TranslateRequest(BaseModel):
    # Capped near the answer ceiling; this translates one answer, not a book.
    text: str = Field(min_length=1, max_length=12000)
    target: str = Field(min_length=2, max_length=8)


class TranslateResponse(BaseModel):
    text: str
    language: str
    """False when translation was refused; `text` is then the English original."""
    translated: bool
    warning: str | None = None


@router.get("/languages")
def languages() -> dict:
    """What the picker can offer, with each language in its own script."""
    return {
        "languages": [
            {
                "code": code,
                "english_name": english,
                "name": translate_mod.LANGUAGE_NAMES.get(code, english),
            }
            for code, english in translate_mod.LANGUAGES.items()
        ]
    }


@router.post("/translate", response_model=TranslateResponse)
def post_translate(request: TranslateRequest) -> TranslateResponse:
    try:
        result = translate_mod.translate(request.text, request.target)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TranslateResponse(
        text=result.text,
        language=result.language,
        translated=result.translated,
        warning=result.warning,
    )
