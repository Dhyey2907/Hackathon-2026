"""Ingest the BIS catalogue for the target product groups into SQLite.

Scope is the 25 priority groups in data/seed/target_committees.yaml rather than
the whole ~15k-standard catalogue, so the corpus stays focused on the QCO-heavy
consumer and industrial products the assistant is meant to advise on.

Run:
    python -m bis.ingest.scrape_catalogue --check-mapping   # validate config
    python -m bis.ingest.scrape_catalogue                   # ingest
    python -m bis.ingest.scrape_catalogue --stats           # what is in the db
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import re
from dataclasses import dataclass, field

import yaml

from bis.config import SEED_DIR
from bis.ingest import bis_api
from bis.store.db import Standard, init_db, session_scope

log = logging.getLogger(__name__)

CONFIG_PATH = SEED_DIR / "target_committees.yaml"
PORTAL_DETAIL_URL = "https://standards.bis.gov.in/website/standard-details"


@dataclass
class Group:
    key: str
    name: str
    priority: int
    committees: list[str]
    seed_standards: list[str] = field(default_factory=list)


class MappingError(RuntimeError):
    pass


def load_groups(path=CONFIG_PATH) -> list[Group]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return [
        Group(
            key=g["key"],
            name=g["name"],
            priority=int(g.get("priority", 3)),
            committees=list(g.get("committees") or []),
            seed_standards=list(g.get("seed_standards") or []),
        )
        for g in data["groups"]
    ]


def committee_code(record: dict) -> str:
    """"ETD 9" from a committee record."""
    return f"{record.get('aliasName', '').strip()} {str(record.get('committeeNumber', '')).strip()}"


def normalize_is_number(raw: str) -> str:
    """Canonicalise a standard number for storage and comparison.

    Collapses whitespace and upper-cases the designation prefix. BIS data entry
    is inconsistent about case - the catalogue contains both "IS 2347:2023" and
    "Is 2347:2023" - so without this a case-sensitive lookup silently reports a
    standard as absent when it is present.
    """
    text = re.sub(r"\s+", " ", (raw or "").strip())
    return re.sub(
        # Longest alternative first: "is" would otherwise match the prefix
        # of "is/iec" and leave the remainder lower-cased.
        r"^(is/iso|is/iec|iso|iec|is)\b",
        lambda m: m.group(1).upper(),
        text,
        flags=re.IGNORECASE,
    )


def is_number_root(raw: str) -> str:
    """The bare standard number, without part or year.

    "IS 302 (Part 1):2024" -> "IS 302". Used to check whether a seed number was
    captured by any of its parts or revisions.
    """
    text = normalize_is_number(raw).upper()
    text = re.split(r"\s*\(", text)[0]
    text = re.split(r"\s*:", text)[0]
    return text.strip()


def parse_year(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"(\d{4})", str(value))
    return int(match.group(1)) if match else None


def resolve_committees(groups: list[Group]) -> dict[str, dict]:
    """Map each configured "ALIAS NUM" code to its committee record.

    Raises rather than skipping on an unknown code: a typo here silently empties
    a whole product group, which is far more expensive to discover later.
    """
    committees = bis_api.fetch_committees()
    by_code: dict[str, dict] = {}
    for record in committees:
        by_code[committee_code(record)] = record

    wanted = {code for g in groups for code in g.committees}
    unknown = sorted(wanted - set(by_code))
    if unknown:
        raise MappingError(
            "unknown committee codes in target_committees.yaml: " + ", ".join(unknown)
        )
    return {code: by_code[code] for code in wanted}


def department_tokens() -> dict[int, str]:
    """departmentId -> encryptedDepartmentId, required by the standards API."""
    return {
        int(d["departmentId"]): d["encryptedDepartmentId"]
        for d in bis_api.fetch_departments()
        if d.get("encryptedDepartmentId")
    }


def verify_seed_coverage(
    groups: list[Group], seen_by_group: dict[str, set[str]]
) -> dict[str, list[str]]:
    """Seed IS numbers each group's own committees failed to bring in.

    Checked per group rather than against the union of everything ingested: a
    global check passes as long as some group somewhere picked the standard up,
    which hides a group whose committee mapping is simply wrong. That is not
    hypothetical - the helmet standards IS 4151 and IS 2925 are filed by BIS
    under CED 22 (Fire Fighting), so a global check reported helmets_ppe as
    covered while its own committees contained neither.
    """
    missing: dict[str, list[str]] = {}
    for group in groups:
        roots = {is_number_root(n) for n in seen_by_group.get(group.key, set())}
        gaps = [s for s in group.seed_standards if is_number_root(s) not in roots]
        if gaps:
            missing[group.key] = gaps
    return missing


def ingest(groups: list[Group], use_cache: bool = True) -> dict[str, int]:
    """Fetch every mapped committee and upsert standards. Returns per-group counts."""
    init_db()
    by_code = resolve_committees(groups)
    dept_tokens = department_tokens()

    per_group: dict[str, int] = {}
    seen_by_group: dict[str, set[str]] = {}
    now = dt.datetime.now(dt.UTC)

    # One fetch per committee even when several groups share it.
    fetched: dict[str, list[dict]] = {}

    with session_scope() as session:
        existing = {number for (number,) in session.query(Standard.is_number).all()}

        for group in groups:
            group_count = 0
            group_seen = seen_by_group.setdefault(group.key, set())
            for code in group.committees:
                if code not in fetched:
                    committee = by_code[code]
                    dept_id = int(committee["departmentId"])
                    token = dept_tokens.get(dept_id)
                    if not token:
                        log.error("no department token for %s (dept %s)", code, dept_id)
                        fetched[code] = []
                    else:
                        fetched[code] = bis_api.fetch_published_standards(
                            token,
                            committee_id=int(committee["committeeId"]),
                            use_cache=use_cache,
                        )
                    log.info(
                        "%-9s %-52s %5d standards",
                        code,
                        (by_code[code].get("committeeName") or "")[:52],
                        len(fetched[code]),
                    )

                for record in fetched[code]:
                    number = normalize_is_number(record.get("standardNumber", ""))
                    if not number:
                        continue
                    group_seen.add(number)
                    group_count += 1

                    if number in existing:
                        continue

                    title = (record.get("standardName") or "").strip()
                    committee = by_code[code]
                    session.add(
                        Standard(
                            is_number=number,
                            title=title,
                            # The catalogue exposes no separate scope abstract;
                            # the title is the only descriptive text available
                            # and is what recommend_standards searches over.
                            scope=title or None,
                            division=committee.get("aliasName"),
                            committee=f"{code} - {committee.get('committeeName', '')}",
                            year=parse_year(record.get("publishedOn")),
                            status="published",
                            source_url=(
                                f"{PORTAL_DETAIL_URL}?id={record.get('standardId', '')}"
                                if record.get("standardId")
                                else PORTAL_DETAIL_URL
                            ),
                            scraped_at=now,
                        )
                    )
                    existing.add(number)

            per_group[group.key] = group_count

    missing = verify_seed_coverage(groups, seen_by_group)
    if missing:
        log.warning("seed standards NOT found - check these committee mappings:")
        for key, gaps in missing.items():
            log.warning("  %-26s missing %s", key, ", ".join(gaps))
    else:
        log.info("all seed standards accounted for")

    return per_group


def show_stats() -> None:
    with session_scope() as session:
        total = session.query(Standard).count()
        print(f"standards in database: {total}")
        rows = (
            session.query(Standard.committee, Standard.is_number)
            .order_by(Standard.committee)
            .all()
        )
    counts: dict[str, int] = {}
    for committee, _ in rows:
        counts[committee or "?"] = counts.get(committee or "?", 0) + 1
    for committee, count in sorted(counts.items(), key=lambda kv: -kv[1])[:30]:
        print(f"  {count:5d}  {committee[:70]}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-mapping", action="store_true")
    parser.add_argument("--stats", action="store_true")
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.stats:
        show_stats()
        return

    groups = load_groups()

    if args.check_mapping:
        by_code = resolve_committees(groups)
        print(f"all {len(by_code)} committee codes resolved")
        for group in groups:
            names = ", ".join(
                f"{c} ({by_code[c].get('committeeName', '')[:28]})"
                for c in group.committees
            )
            print(f"  {group.key:28s} {names}")
        return

    counts = ingest(groups, use_cache=not args.no_cache)
    with session_scope() as session:
        total = session.query(Standard).count()

    print("\nper-group standards seen:")
    for key, count in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {key:28s} {count:5d}")
    print(f"\nunique standards in database: {total}")


if __name__ == "__main__":
    main()
