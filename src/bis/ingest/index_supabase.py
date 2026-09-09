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
from concurrent.futures import ThreadPoolExecutor, as_completed

from bis.ingest.scrape_catalogue import load_groups
from bis.retrieval import embed as embed_mod
from bis.store import supabase_store
from bis.store.db import Standard, session_scope

log = logging.getLogger(__name__)

EMBED_BATCH = 100

# Writing embeddings back is one REST round trip per row, which dominates the
# runtime - the embedding calls themselves are batched 100 at a time. Sending
# the updates concurrently turns a ~80 minute backfill into roughly ten.
UPDATE_WORKERS = 12


def _groups_for_committee() -> dict[str, list[str]]:
    """committee code -> every product group that claims it.

    A committee genuinely belongs to several groups: MED 33 (Utensils) serves
    both household appliances and pressure cookers, and CED 22 (Fire Fighting)
    owns extinguishers and helmets alike. An earlier version kept only the first
    match, which left cookers_utensils with zero rows because household
    appliances was listed first.
    """
    mapping: dict[str, list[str]] = {}
    for group in load_groups():
        for code in group.committees:
            mapping.setdefault(code, []).append(group.key)
    return mapping


def upload_standards(batch_size: int = 200) -> int:
    """Copy the local catalogue into Supabase, without embeddings."""
    by_committee = _groups_for_committee()

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
                    "group_keys": by_committee.get(code, []),
                }
            )

    log.info("uploading %d standards", len(payload))
    return supabase_store.upsert_standards(payload, batch_size=batch_size)


def embed_standards(limit: int | None = None) -> int:
    """Embed catalogue rows that have no vector yet. Safe to re-run."""
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

        def write(pair):
            row, vector = pair
            supabase_store.update_with_retry(
                "standards", "is_number", row["is_number"], {"embedding": vector}
            )
            return row["is_number"]

        failed = []
        with ThreadPoolExecutor(max_workers=UPDATE_WORKERS) as pool:
            futures = {
                pool.submit(write, pair): pair[0]["is_number"]
                for pair in zip(pending, vectors, strict=True)
            }
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as exc:
                    failed.append(futures[future])
                    log.warning("update failed for %s: %s", futures[future], str(exc)[:120])

        if failed:
            # Left unembedded on purpose: the next run picks them up, because
            # the query selects rows where embedding IS NULL.
            log.warning("%d rows failed to write and will be retried next run", len(failed))

        done += len(pending) - len(failed)
        rate = done / max(time.time() - started, 1e-6)
        log.info("embedded %d standards (%.1f/s)", done, rate)

    return done


def upload_chunks() -> int:
    """Parse the FaQs corpus and upsert chunks (without embeddings)."""
    from bis.ingest.parse_docs import parse_corpus

    records = parse_corpus()
    payload = [
        {
            "chunk_uid": r.chunk_uid,
            "text": r.text,
            "doc_key": r.doc_key,
            "doc_title": r.doc_title,
            "doc_type": r.doc_type,
            "source_url": r.source_url,
            "ordinal": r.ordinal,
            "token_count": r.token_count,
            "clause": r.clause,
            "section_path": r.section_path,
            "page": r.page,
            "is_number": r.is_number,
            "language": r.language,
        }
        for r in records
    ]
    log.info("uploading %d chunks", len(payload))
    return supabase_store.upsert_chunks(payload)


def embed_chunks() -> int:
    """Embed chunks that have no vector yet. Safe to re-run."""
    client = supabase_store.get_write_client()
    done = 0

    while True:
        response = (
            client.table("chunks")
            .select("chunk_uid,text,doc_title")
            .is_("embedding", "null")
            .limit(EMBED_BATCH)
            .execute()
        )
        pending = response.data or []
        if not pending:
            break

        # The document title is prepended so a passage carries its context: an
        # answer reading "Yes, within 30 days" is meaningless on its own, but
        # useful once the vector also encodes which scheme it belongs to.
        texts = [
            ((row.get("doc_title") or "") + "\n" + row["text"]).strip()
            for row in pending
        ]
        vectors = embed_mod.embed_documents(texts)

        def write(pair):
            row, vector = pair
            supabase_store.update_with_retry(
                "chunks", "chunk_uid", row["chunk_uid"], {"embedding": vector}
            )

        failed = 0
        with ThreadPoolExecutor(max_workers=UPDATE_WORKERS) as pool:
            futures = [pool.submit(write, pair) for pair in zip(pending, vectors, strict=True)]
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as exc:
                    failed += 1
                    log.warning("chunk update failed: %s", str(exc)[:120])

        done += len(pending) - failed
        log.info("embedded %d chunks", done)

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
    parser.add_argument("--chunks", action="store_true", help="parse, upload and embed FaQs documents")
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

    if args.chunks:
        print(f"uploaded {upload_chunks()} chunks")
        print(f"embedded {embed_chunks()} chunks")

    if not (args.upload or args.embed or args.chunks):
        parser.print_help()


if __name__ == "__main__":
    main()
