"""Citation validation.

The model is asked to cite evidence as inline markers [S1], [S2]. Prompting
alone does not guarantee the markers correspond to anything real, so every
answer is parsed here and checked against the evidence that was actually
retrieved. Markers that do not resolve are stripped rather than shown, because
a citation that looks authoritative and points nowhere is worse than no
citation at all - especially for questions about legal certification duties.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

MARKER_RE = re.compile(r"\[S(\d+)\]")

# Models do not reliably emit ASCII brackets. gpt-oss in particular produces
# fullwidth CJK brackets - an answer citing 【S1】 looked perfectly cited to a
# reader while resolving to zero sources, because the validator saw no markers
# at all and silently dropped every one. Normalising first turns that invisible
# failure back into a working citation.
_BRACKET_TRANSLATION = str.maketrans({
    "【": "[",  # 【
    "】": "]",  # 】
    "［": "[",  # ［
    "］": "]",  # ］
    "❨": "[",
    "❩": "]",
})


def normalise_markers(text: str) -> str:
    """Rewrite non-ASCII citation brackets so markers can be matched."""
    return (text or "").translate(_BRACKET_TRANSLATION)


@dataclass
class Evidence:
    """One retrieved passage offered to the model, numbered S1..Sn."""

    index: int
    chunk_uid: str
    text: str
    title: str | None = None
    url: str | None = None
    doc_type: str | None = None
    clause: str | None = None
    page: int | None = None
    is_number: str | None = None
    score: float = 0.0

    @property
    def marker(self) -> str:
        return f"[S{self.index}]"

    def locator(self) -> str | None:
        parts = []
        if self.clause:
            parts.append(f"clause {self.clause}")
        if self.page is not None:
            parts.append(f"p. {self.page}")
        return ", ".join(parts) or None

    def to_source(self) -> dict[str, Any]:
        return {
            "marker": f"S{self.index}",
            "chunk_uid": self.chunk_uid,
            "title": self.title,
            "url": self.url,
            "doc_type": self.doc_type,
            "locator": self.locator(),
            "is_number": self.is_number,
        }


@dataclass
class ValidationResult:
    text: str
    sources: list[dict[str, Any]] = field(default_factory=list)
    dropped_markers: list[str] = field(default_factory=list)
    uncited: bool = False

    @property
    def is_clean(self) -> bool:
        return not self.dropped_markers and not self.uncited


def build_evidence(hits: list[Any]) -> list[Evidence]:
    """Number retrieved hits S1..Sn for presentation to the model."""
    evidence: list[Evidence] = []
    for i, hit in enumerate(hits, start=1):
        payload = getattr(hit, "payload", {}) or {}
        evidence.append(
            Evidence(
                index=i,
                chunk_uid=getattr(hit, "chunk_uid", payload.get("chunk_uid", "")),
                text=getattr(hit, "text", payload.get("text", "")),
                title=payload.get("doc_title"),
                url=payload.get("source_url"),
                doc_type=payload.get("doc_type"),
                clause=payload.get("clause"),
                page=payload.get("page"),
                is_number=payload.get("is_number"),
                score=getattr(hit, "rerank_score", None) or getattr(hit, "score", 0.0),
            )
        )
    return evidence


def format_evidence_block(evidence: list[Evidence], max_chars: int = 2000) -> str:
    """Render evidence for the prompt, one labelled block per passage."""
    blocks = []
    for item in evidence:
        header = f"[S{item.index}] {item.title or 'Untitled'}"
        if item.is_number:
            header += f" ({item.is_number})"
        locator = item.locator()
        if locator:
            header += f" - {locator}"
        if item.url:
            header += f"\nURL: {item.url}"
        body = item.text[:max_chars]
        blocks.append(f"{header}\n{body}")
    return "\n\n---\n\n".join(blocks)


def validate(text: str, evidence: list[Evidence]) -> ValidationResult:
    """Strip unresolvable markers; return the answer plus only cited sources."""
    text = normalise_markers(text)
    valid_indices = {e.index for e in evidence}
    by_index = {e.index: e for e in evidence}

    used: list[int] = []
    dropped: list[str] = []

    def replace(match: re.Match[str]) -> str:
        index = int(match.group(1))
        if index in valid_indices:
            if index not in used:
                used.append(index)
            return match.group(0)
        dropped.append(match.group(0))
        return ""

    cleaned = MARKER_RE.sub(replace, text)
    # Collapse whitespace left behind by removed markers.
    cleaned = re.sub(r" +([.,;:])", r"\1", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned).strip()

    sources = [by_index[i].to_source() for i in sorted(used)]

    return ValidationResult(
        text=cleaned,
        sources=sources,
        dropped_markers=dropped,
        uncited=bool(evidence) and not used,
    )


IS_NUMBER_RE = re.compile(r"\bIS[\s/]?(\d{1,5})(?::(\d{4}))?\b", re.IGNORECASE)
CLAUSE_CLAIM_RE = re.compile(
    r"\b(?:as per |per |under |vide )?clause\s+(\d+(?:\.\d+)*)", re.IGNORECASE
)


def find_unsupported_clause_claims(text: str, evidence: list[Evidence]) -> list[str]:
    """Clause numbers asserted in the answer but absent from the evidence.

    The corpus holds catalogue metadata for standards, not their full texts, so
    a clause number that appears in no retrieved passage is almost certainly
    invented. Callers treat a non-empty result as grounds to fall back.
    """
    supported = {e.clause for e in evidence if e.clause}
    for item in evidence:
        supported.update(CLAUSE_CLAIM_RE.findall(item.text))
        supported.update(
            m.group(1) for m in re.finditer(r"^\s*(\d+(?:\.\d+)+)\s", item.text, re.M)
        )

    claimed = set(CLAUSE_CLAIM_RE.findall(text))
    return sorted(claimed - {s for s in supported if s})
