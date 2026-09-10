"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from bis.api import (
    routes_chat,
    routes_context,
    routes_extract,
    routes_search,
    routes_translate,
    routes_updates,
)
from bis.config import get_settings
from bis.llm import LLMUnavailable
from bis.store.db import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
log = logging.getLogger("bis")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log.info("database ready")

    # Warm the FAQ fast path at startup rather than on the first question, so
    # no user pays the one-off load and embedding cost. Failure is not fatal:
    # the full pipeline answers everything the fast path would have.
    try:
        from bis.agent import faq_cache

        faq_cache.load()
    except Exception as exc:
        log.warning("FAQ fast path unavailable: %s", str(exc)[:160])

    yield


app = FastAPI(
    title="BIS Intelligent Assistant",
    description=(
        "Source-backed conversational access to Indian Standards catalogue "
        "metadata and public BIS scheme, licensing, hallmarking and consumer "
        "documents (SIH 26107)."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_chat.router)
app.include_router(routes_search.router)
app.include_router(routes_context.router)
app.include_router(routes_translate.router)
app.include_router(routes_updates.router)
app.include_router(routes_extract.router)


@app.exception_handler(LLMUnavailable)
def llm_unavailable(request: Request, exc: LLMUnavailable) -> JSONResponse:
    # Groq's free tier limits tokens per minute. Uncaught, that surfaced as a
    # bare 500 without CORS headers, and the browser reported only "Failed to
    # fetch". A 503 with a reason lets the chat say what actually happened.
    logging.getLogger(__name__).warning("model unavailable: %s", str(exc)[:200])
    return JSONResponse(
        status_code=503,
        content={"detail": "The language model is busy or rate-limited. Wait a minute and retry."},
    )


@app.get("/health", tags=["ops"])
def health() -> dict:
    """Report on every external dependency the assistant needs."""
    from bis import llm
    from bis.retrieval import embed as embed_mod
    from bis.store import supabase_store

    settings = get_settings()

    store = supabase_store.health()
    embed = embed_mod.health()
    groq = llm.health()

    from bis.agent import answer_cache, faq_cache

    return {
        "status": "ok" if (store["ok"] and groq["ok"] and embed["ok"]) else "degraded",
        "groq": groq,
        "supabase": store,
        "embeddings": embed,
        "caches": {"answers": answer_cache.stats(), "faq": faq_cache.stats()},
        "models": {
            "router": settings.groq_router_model,
            "answer": settings.groq_answer_model,
            "fallback": settings.groq_fallback_model,
            "embed": f"{settings.embed_model} ({settings.embed_dimensions}d)",
            "rerank": settings.rerank_model,
        },
    }
