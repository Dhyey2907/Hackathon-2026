"""Embeddings: dense from bge-m3, sparse from a local lexical encoder.

Groq has no embeddings endpoint, so this all runs locally.

Dense vectors come from BAAI/bge-m3 (multilingual, 1024-dim), which is what
lets a Hindi question match English source text.

Sparse vectors are produced here rather than by bge-m3's learned sparse head.
That is a deliberate trade: the learned head needs the heavyweight
FlagEmbedding stack, while this corpus's hard cases are exact tokens -
"IS 15111", "HUID", "CRS", "QCO" - where a transparent BM25-style encoder is
already the right tool. It is also inspectable, which matters when debugging
why a specific standard number failed to surface. If recall on paraphrased
queries later plateaus, swapping in the learned head is a contained change:
only encode_documents/encode_query need to move.
"""

from __future__ import annotations

import json
import logging
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

from bis.config import PROCESSED_DIR, get_settings

log = logging.getLogger(__name__)

IDF_PATH = PROCESSED_DIR / "sparse_idf.json"
HASH_SPACE = 2**20

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:\.[0-9]+)*|[ऀ-ॿ]+|[ঀ-௿]+")

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
    "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
    "was", "what", "when", "where", "which", "who", "will", "with", "do", "does",
    "can", "my", "me", "you", "your", "we", "us",
}


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens, keeping dotted forms like 4.2.1 and IS numbers intact."""
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in STOPWORDS]


def _bigrams(tokens: list[str]) -> list[str]:
    """Adjacent pairs, so "is 15111" scores above the two tokens seen apart."""
    return [f"{a}_{b}" for a, b in zip(tokens, tokens[1:], strict=False)]


def term_id(term: str) -> int:
    """Stable hash into the sparse index space."""
    return hash_str(term) % HASH_SPACE


def hash_str(text: str) -> int:
    # Python's builtin hash is salted per process, so use a stable digest.
    import hashlib

    return int.from_bytes(hashlib.blake2b(text.encode(), digest_size=8).digest(), "big")


class SparseEncoder:
    """BM25-flavoured hashed sparse encoder.

    Weights are sublinear TF times IDF. IDF is fitted over the corpus at index
    time and persisted, so query-side and document-side weighting agree. With
    no fitted IDF it degrades to TF-only, which still retrieves but ranks
    common terms too highly - so always fit before indexing.
    """

    def __init__(self, idf: dict[str, float] | None = None, doc_count: int = 0):
        self.idf = idf or {}
        self.doc_count = doc_count

    @classmethod
    def load(cls, path: Path = IDF_PATH) -> SparseEncoder:
        if not path.exists():
            return cls()
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(idf=data.get("idf", {}), doc_count=data.get("doc_count", 0))

    def save(self, path: Path = IDF_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"idf": self.idf, "doc_count": self.doc_count}),
            encoding="utf-8",
        )

    def fit(self, texts: list[str]) -> SparseEncoder:
        """Compute IDF over the corpus."""
        doc_freq: Counter[str] = Counter()
        for text in texts:
            tokens = tokenize(text)
            doc_freq.update(set(tokens) | set(_bigrams(tokens)))

        n = len(texts)
        self.doc_count = n
        # Smoothed IDF, floored at a small positive value so that a term
        # appearing in every document still contributes a little.
        self.idf = {
            term: max(math.log((n - df + 0.5) / (df + 0.5) + 1.0), 0.05)
            for term, df in doc_freq.items()
        }
        return self

    def _weight(self, term: str) -> float:
        if self.idf:
            return self.idf.get(term, math.log(self.doc_count + 1.0) if self.doc_count else 1.0)
        return 1.0

    def encode(self, text: str, max_terms: int = 256) -> dict[int, float]:
        tokens = tokenize(text)
        if not tokens:
            return {}
        counts = Counter(tokens)
        counts.update(_bigrams(tokens))

        raw: dict[str, float] = {}
        for term, tf in counts.items():
            raw[term] = (1.0 + math.log(tf)) * self._weight(term)

        top = sorted(raw.items(), key=lambda kv: kv[1], reverse=True)[:max_terms]
        norm = math.sqrt(sum(v * v for _, v in top)) or 1.0

        vector: dict[int, float] = {}
        for term, value in top:
            idx = term_id(term)
            # Hash collisions are rare at 2^20 and additive here, which is the
            # standard hashing-trick behaviour.
            vector[idx] = vector.get(idx, 0.0) + value / norm
        return vector


@lru_cache(maxsize=1)
def get_dense_model():
    """Load bge-m3. First call downloads ~2.2 GB."""
    from sentence_transformers import SentenceTransformer

    settings = get_settings()
    log.info("loading dense model %s on %s", settings.embed_model, settings.embed_device)
    return SentenceTransformer(settings.embed_model, device=settings.embed_device)


@lru_cache(maxsize=1)
def get_sparse_encoder() -> SparseEncoder:
    return SparseEncoder.load()


def encode_documents(
    texts: list[str], batch_size: int = 8, show_progress: bool = False
) -> tuple[list[list[float]], list[dict[int, float]]]:
    """Encode passages. Returns (dense_vectors, sparse_vectors)."""
    model = get_dense_model()
    dense = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=show_progress,
        convert_to_numpy=True,
    )
    encoder = get_sparse_encoder()
    sparse = [encoder.encode(t) for t in texts]
    return [vec.tolist() for vec in dense], sparse


def encode_query(text: str) -> tuple[list[float], dict[int, float]]:
    """Encode a query. bge-m3 needs no instruction prefix, unlike bge-v1.5."""
    model = get_dense_model()
    dense = model.encode([text], normalize_embeddings=True, convert_to_numpy=True)[0]
    return dense.tolist(), get_sparse_encoder().encode(text)


def fit_sparse(texts: list[str]) -> SparseEncoder:
    """Fit and persist the IDF table. Call once per full re-index."""
    encoder = SparseEncoder().fit(texts)
    encoder.save()
    get_sparse_encoder.cache_clear()
    log.info("fitted sparse IDF over %d documents, %d terms", len(texts), len(encoder.idf))
    return encoder


def health() -> dict:
    """Report model availability without forcing a multi-GB download."""
    settings = get_settings()
    info: dict = {
        "model": settings.embed_model,
        "device": settings.embed_device,
        "sparse_idf_fitted": IDF_PATH.exists(),
    }
    if get_dense_model.cache_info().currsize:
        info["ok"] = True
        info["loaded"] = True
        return info

    try:
        import sentence_transformers  # noqa: F401

        info["ok"] = True
        info["loaded"] = False
        info["detail"] = "library present, model loads lazily on first use"
    except ImportError as exc:
        info["ok"] = False
        info["detail"] = str(exc)
    return info
