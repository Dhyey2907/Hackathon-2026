"""Central configuration, loaded from environment / .env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SEED_DIR = DATA_DIR / "seed"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Groq. Verified against the live model list - Groq no longer serves the
    # Llama chat models, so anything referencing llama-3.x will 404. The
    # fallback is deliberately a different family from the answer model, so a
    # provider-side problem with one does not take out both.
    groq_api_key: str = ""
    groq_router_model: str = "openai/gpt-oss-20b"
    groq_answer_model: str = "openai/gpt-oss-120b"
    groq_fallback_model: str = "qwen/qwen3.8-27b"
    groq_stt_model: str = "whisper-large-v3"

    # Embeddings. Provider is swappable because free-tier limits differ wildly:
    # Gemini allows only 1,000 embedded items per DAY on the free tier, which
    # would take a week for this corpus, while Jina's free tier is ~1M tokens.
    #
    # Vectors from different providers are NOT comparable. Changing this means
    # re-embedding every row and resizing the vector column - never mix them.
    #
    # 1024 dimensions also keeps us under pgvector's 2000-dim HNSW index cap.
    embed_provider: str = "jina"
    embed_model: str = "jina-embeddings-v3"
    embed_dimensions: int = 1024
    jina_api_key: str = ""
    gemini_api_key: str = ""

    # Reranking. Gemini offers no reranker, so a small Groq model scores the
    # candidates instead of a cross-encoder - see retrieval.rerank.
    rerank_model: str = "openai/gpt-oss-20b"

    # Stores. Supabase Postgres (pgvector) over the REST API; the direct
    # database host is IPv6-only, which many networks cannot reach.
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    database_url: str = "sqlite:///./data/bis.db"

    # Retrieval
    retrieve_top_k: int = 30
    rerank_top_k: int = 6
    rrf_k: int = 60
    min_evidence_score: float = 0.35

    # Scraping
    scrape_delay_seconds: float = 1.0
    scrape_user_agent: str = "bis-assistant/0.1 (SIH-26107 research prototype)"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def ensure_dirs() -> None:
    for d in (DATA_DIR, RAW_DIR, PROCESSED_DIR, SEED_DIR):
        d.mkdir(parents=True, exist_ok=True)
