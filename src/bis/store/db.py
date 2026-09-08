"""SQLAlchemy models and session handling.

The catalogue (Standard) and the structured directories (Lab, Scheme) live here.
Chunk rows mirror what is stored in Qdrant so that a citation can always be
resolved back to an exact source URL, page and clause without a vector lookup.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from bis.config import get_settings


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


class Base(DeclarativeBase):
    pass


class Standard(Base):
    """One row per Indian Standard, from the public BIS catalogue.

    Catalogue metadata only - we do not hold IS full texts. The scope column is
    the published abstract where available; it is what recommend_standards
    searches over.
    """

    __tablename__ = "standards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    is_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(Text)
    scope: Mapped[str | None] = mapped_column(Text, default=None)
    ics_code: Mapped[str | None] = mapped_column(String(32), index=True, default=None)
    division: Mapped[str | None] = mapped_column(String(128), default=None)
    committee: Mapped[str | None] = mapped_column(String(128), default=None)
    year: Mapped[int | None] = mapped_column(Integer, default=None)
    reaffirmed_year: Mapped[int | None] = mapped_column(Integer, default=None)
    status: Mapped[str | None] = mapped_column(String(64), default=None)
    no_of_amendments: Mapped[int] = mapped_column(Integer, default=0)
    under_qco: Mapped[bool] = mapped_column(Boolean, default=False)
    source_url: Mapped[str | None] = mapped_column(Text, default=None)
    scraped_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_utcnow)

    def citation_label(self) -> str:
        return f"{self.is_number} - {self.title}"


class Document(Base):
    """A public BIS document (scheme guideline, QCO, Act/Rules, FAQ page)."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    doc_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    title: Mapped[str] = mapped_column(Text)
    doc_type: Mapped[str] = mapped_column(String(48), index=True)
    source_url: Mapped[str] = mapped_column(Text)
    local_path: Mapped[str | None] = mapped_column(Text, default=None)
    language: Mapped[str] = mapped_column(String(8), default="en")
    published_on: Mapped[str | None] = mapped_column(String(32), default=None)
    checksum: Mapped[str | None] = mapped_column(String(64), default=None)
    scraped_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_utcnow)

    chunks: Mapped[list[Chunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class Chunk(Base):
    """A retrievable passage. chunk_uid is the id used as the Qdrant point id."""

    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chunk_uid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    section_path: Mapped[str | None] = mapped_column(Text, default=None)
    clause: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    page: Mapped[int | None] = mapped_column(Integer, default=None)
    is_number: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    ordinal: Mapped[int] = mapped_column(Integer, default=0)

    document: Mapped[Document] = relationship(back_populates="chunks")

    def citation(self) -> dict:
        """The shape handed to the answer layer and echoed in API responses."""
        locator = []
        if self.clause:
            locator.append(f"clause {self.clause}")
        if self.page is not None:
            locator.append(f"p. {self.page}")
        return {
            "chunk_uid": self.chunk_uid,
            "title": self.document.title if self.document else None,
            "doc_type": self.document.doc_type if self.document else None,
            "url": self.document.source_url if self.document else None,
            "locator": ", ".join(locator) or None,
            "is_number": self.is_number,
        }


Index("ix_chunks_doc_ordinal", Chunk.document_id, Chunk.ordinal)


class Scheme(Base):
    """A BIS scheme (ISI mark, CRS registration, hallmarking, lab recognition)."""

    __tablename__ = "schemes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text, default=None)
    applies_to: Mapped[str | None] = mapped_column(Text, default=None)
    source_url: Mapped[str | None] = mapped_column(Text, default=None)


class Lab(Base):
    """A BIS-recognised testing laboratory."""

    __tablename__ = "labs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(96), index=True, default=None)
    state: Mapped[str | None] = mapped_column(String(96), index=True, default=None)
    scope: Mapped[str | None] = mapped_column(Text, default=None)
    schemes: Mapped[str | None] = mapped_column(Text, default=None)
    contact: Mapped[str | None] = mapped_column(Text, default=None)
    source_url: Mapped[str | None] = mapped_column(Text, default=None)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_uid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_utcnow)

    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(String(8), default=None)
    intent: Mapped[str | None] = mapped_column(String(48), default=None)
    latency_ms: Mapped[float | None] = mapped_column(Float, default=None)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        url = get_settings().database_url
        kwargs: dict = {"future": True}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        _engine = create_engine(url, **kwargs)
    return _engine


def get_sessionmaker():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), expire_on_commit=False, future=True
        )
    return _SessionLocal


def init_db() -> None:
    from bis.config import ensure_dirs

    ensure_dirs()
    Base.metadata.create_all(get_engine())


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
