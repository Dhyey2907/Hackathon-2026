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

    # Groq
    groq_api_key: str = ""
    groq_router_model: str = "llama-3.1-8b-instant"
    groq_answer_model: str = "llama-3.3-70b-versatile"
    groq_fallback_model: str = "openai/gpt-oss-120b"
    groq_stt_model: str = "whisper-large-v3"

    # Local models (Groq offers no embedding endpoint)
    embed_model: str = "BAAI/bge-m3"
    rerank_model: str = "BAAI/bge-reranker-v2-m3"
    embed_device: str = "cpu"

    # Stores
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "bis_chunks"
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
