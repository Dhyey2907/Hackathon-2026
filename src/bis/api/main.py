"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bis.config import get_settings
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


@app.get("/health", tags=["ops"])
def health() -> dict:
    """Report on every external dependency the assistant needs."""
    from bis import llm
    from bis.store import vectors

    settings = get_settings()

    qdrant: dict = {"ok": False}
    try:
        client = vectors.get_client()
        collections = [c.name for c in client.get_collections().collections]
        qdrant = {
            "ok": True,
            "url": settings.qdrant_url,
            "collection": settings.qdrant_collection,
            "collection_exists": settings.qdrant_collection in collections,
            "points": vectors.count(),
        }
    except Exception as exc:
        qdrant = {"ok": False, "detail": str(exc)[:200]}

    embed: dict = {"ok": False, "detail": "not loaded"}
    try:
        from bis.retrieval import embed as embed_mod

        embed = embed_mod.health()
    except Exception as exc:
        embed = {"ok": False, "detail": str(exc)[:200]}

    groq = llm.health()

    return {
        "status": "ok" if (qdrant["ok"] and groq["ok"]) else "degraded",
        "groq": groq,
        "qdrant": qdrant,
        "embeddings": embed,
        "models": {
            "router": settings.groq_router_model,
            "answer": settings.groq_answer_model,
            "fallback": settings.groq_fallback_model,
            "embed": settings.embed_model,
            "rerank": settings.rerank_model,
        },
    }
