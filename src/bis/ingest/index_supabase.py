"""Push the catalogue to Supabase and embed it.

Two phases, deliberately separate:

  upload  - copy standards from the local SQLite staging DB into Supabase
  embed   - fill in embeddings for rows that do not have one yet

Splitting them means an interrupted embedding run never has to re-upload, and
because the embed phase selects only rows where embedding IS NULL, re-running it
resumes exactly where it stopped. That matters: embedding 6,209 rows against a
rate-limited free tier is the longest operation in the project, and losing it to
a transient 429 an hour in would be painful.

Run:
    python -m bis.ingest.index_supabase --upload
    python -m bis.ingest.index_supabase --embed
    python -m bis.ingest.index_supabase --status
"""

from __future__ import annotations

import argparse
import logging
import time

from bis.ingest.scrape_catalogue import load_groups
from bis.retrieval import embed as embed_mod
from bis.store import supabase_store
from bis.store.db import Standard, session_scope

log = logging.getLogger(__name__)

EMBED_BATCH = 100


def _group_for_committee() -> dict[str, str]:
    """committee code -> product group key, so rows can be filtered by group."""
    mapping: dict[str, str] = {}
    for group in load_groups():
        for code in group.committees:
            # A committee shared by two groups keeps the first; group_key is a
            # coarse retrieval filter, not an authoritative classification.
            mapping.setdefault(code, group.key)
    return mapping


def upload_standards(batch_size: int = 200) -> int:
    """Copy the local catalogue into Supabase, without embeddings."""
    by_committee = _group_for_committee()

    with session_scope() as session:
        rows = session.query(Standard).all()
        payload = []
        for row in rows:
            code = (row.committee or "").split(" - ")[0].strip()
            payload.append(
                {
                    "is_number": row.is_number,
                    "title": row.title,
                    "scope": row.scope,
                    "ics_code": row.ics_code,
                    "division": row.division,
                    "committee": row.committee,
                    "year": row.year,
                    "status": row.status,
                    "under_qco": bool(row.under_qco),
                    "source_url": row.source_url,
                    "group_key": by_committee.get(code),
                }
            )

    log.info("uploading %d standards", len(payload))
    return supabase_store.upsert_standards(payload, batch_size=batch_size)


def embed_standards(limit: int | None = None) -> int:
    """Embed catalogue rows that have no vector yet. Safe to re-run."""
    client = supabase_store.get_write_client()
    done = 0
    started = time.time()

    while True:
        pending = supabase_store.standards_missing_embeddings(limit=EMBED_BATCH)
        if not pending:
            break
        if limit is not None and done >= limit:
            break

        # A standard's searchable text is its number, title and committee.
        # The number is included so that a query naming "IS 1786" still has a
        # lexical-style signal inside the dense vector, not only in the FTS arm.
        texts = [
            f"{row['is_number']} {row.get('title') or ''} "
            f"({row.get('committee') or ''})".strip()
            for row in pending
        ]

        vectors = embed_mod.embed_documents(texts)

        for row, vector in zip(pending, vectors, strict=True):
            client.table("standards").update({"embedding": vector}).eq(
                "is_number", row["is_number"]
            ).execute()

        done += len(pending)
        rate = done / max(time.time() - started, 1e-6)
        log.info("embedded %d standards (%.1f/s)", done, rate)

    return done


def status() -> dict:
    counts = supabase_store.counts()
    pending = len(supabase_store.standards_missing_embeddings(limit=1000))
    return {
        "rows": counts,
        "standards_without_embedding_sample": pending,
        "note": "sample is capped at 1000",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload", action="store_true", help="copy SQLite catalogue to Supabase")
    parser.add_argument("--embed", action="store_true", help="embed rows missing a vector")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="cap rows embedded this run")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.status:
        for key, value in status().items():
            print(f"{key}: {value}")
        return

    if args.upload:
        count = upload_standards()
        print(f"uploaded {count} standards")

    if args.embed:
        count = embed_standards(limit=args.limit)
        print(f"embedded {count} standards")

    if not (args.upload or args.embed):
        parser.print_help()


if __name__ == "__main__":
    main()
