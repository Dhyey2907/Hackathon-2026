# BIS Intelligent Assistant

An AI assistant that answers questions about **Indian Standards and BIS services** — certification schemes, licensing, hallmarking, testing laboratories and consumer queries — in plain language, with **citations back to the source**.

Built for Smart India Hackathon problem statement **26107** (Bureau of Indian Standards).

> **Status: backend working end to end.** 6,209 standards and 220 document chunks are indexed in Supabase with hybrid dense + lexical search. The intent router, retrieval tools, chat API and citation guardrails all run against live data. A frontend is in progress separately.

---

## The problem

BIS publishes thousands of Indian Standards and runs a dozen services across several portals and PDFs. An MSME asking a simple question — *"I manufacture LED bulbs, which standards apply and what licence do I need?"* — has to search a catalogue, a scheme portal, a QCO notification and a lab directory separately. Students and consumers fare worse.

This project answers that question in one turn, and shows its sources.

## What makes this different from a generic chatbot

**Every claim is traceable.** The model cites evidence as inline `[S1]` markers; a validator parses the output and **strips any marker that does not resolve to a passage that was actually retrieved**. If the retrieved evidence is too weak, the assistant abstains and points to the right BIS page instead of guessing.

That matters here more than in most RAG projects: a confidently wrong answer about a *legal certification requirement* can cost a small manufacturer real money. Abstention is treated as a feature, not a failure.

**The corpus scope is honest.** Full IS standard texts are paywalled and are **not** in this system. What is here:

- **Catalogue metadata** for 6,209 standards — number, title, committee, publication year — which is enough to answer *"which standard applies to my product?"*
- **Full text of public documents** — scheme guidelines, QCOs, licensing procedures, hallmarking and consumer material — which is where genuine clause-level citation comes from.

The assistant will describe what a standard covers and link to its BIS page; it will not invent clause text for a standard it only has metadata for.

---

## Architecture

```
ingestion (offline)          retrieval (online)              generation
─────────────────            ──────────────────              ──────────
BIS portal API ─┐            query → detect language
public PDFs     ├→ chunks →  → hybrid search (dense+sparse)  → Groq LLM
seed CSVs       ┘  + metadata → RRF fuse → rerank            → cited answer
                      ↓                  ↑                        ↓
             Supabase pgvector     structured lookup          citation
              + Postgres FTS        (catalogue, labs)         validator
```

Answering is an **intent-routed agent**, not one RAG chain — the eight required capabilities need different retrieval strategies:

| Intent | Tool | Source |
|---|---|---|
| Which standard applies to my product? | `recommend_standards` | catalogue vectors + committee taxonomy |
| What does standard X cover? | `standard_lookup` | SQLite catalogue |
| Certification scheme / licensing | `passage_search` | scheme documents |
| Hallmarking (HUID, purity, registration) | `passage_search` | hallmarking documents |
| Find a testing lab | `find_labs` | BIS lab directory |
| Consumer rights / complaints | `passage_search` | consumer documents |

### Model choices

| Role | Model | Why |
|---|---|---|
| Answering | `openai/gpt-oss-120b` (Groq) | strongest available, 131k context |
| Fallback | `qwen/qwen3.8-27b` (Groq) | different family, so one provider-side fault can't take out both; strong Hindi |
| Routing | `openai/gpt-oss-20b` (Groq) | ~0.4 s intent classification, clean JSON |
| Embeddings | `jina-embeddings-v3` (Jina, 1024d) | multilingual — a Hindi question matches English source text; free tier covers the corpus |
| Reranking | `openai/gpt-oss-20b` (Groq) | Gemini has no reranker; one call scores the whole candidate list |

Everything runs on hosted APIs — **no model weights are downloaded**. Things worth knowing before changing providers:

- **Groq has no embeddings endpoint** — verified, not assumed: 14 models, none of them embedding, and `/v1/embeddings` returns 404. That is why embeddings come from elsewhere.
- **Groq no longer serves the Llama chat models.** Any tutorial referencing `llama-3.3-70b-versatile` or `llama-3.1-8b-instant` will 404 — only the prompt-guard Llama variants remain. Check `client.models.list()` rather than trusting documentation.
- **Gemini's free tier is unusable for bulk embedding.** The binding limit is `EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier = 1000` — a thousand embedded items *per day*, so this 6,209-row corpus would take a week. There is also a 100/minute cap that counts each item in a batch as a request, which is the one you hit first and which distracts from the real problem. Jina's free tier (~1M tokens) does the whole corpus in ~16 minutes.
- **Embeddings are 1024-dimensional.** pgvector's HNSW index caps at 2000 dimensions, so any provider must be truncated below that; vectors are re-normalised afterwards, since Matryoshka truncation does not preserve unit length.
- **Never mix embedding providers in one column.** Vectors from different models are not comparable, so a half-migrated table returns confident nonsense with no error. Switching provider means re-embedding everything and resizing the column — `EMBED_PROVIDER` exists to make that switch deliberate.
- **Embeddings are asymmetric.** Passages and queries use different task types (`retrieval.passage` / `retrieval.query` on Jina). Using one for both returns plausible vectors and quietly worse retrieval.

Reranking by LLM is a real trade-off: a trained cross-encoder would be better and cheaper per candidate. This buys a stack with no local weights.

Avoid `qwen/qwen3.6-27b`: it emits `<think>` reasoning blocks that would need stripping before display.

---

## Corpus scope

Rather than all ~15,000 published standards, the corpus targets **25 priority product groups** — the QCO-heavy consumer and industrial categories where BIS questions actually cluster — mapped onto **82 BIS sectional committees**.

Household electrical · Electronics & IT · Wires & cables · Cement · Steel & construction · Drinking water · Automobiles & tyres · Helmets & PPE · Cookers & utensils · LPG appliances · Toys · Hallmarking · Food · Pipes & plumbing · Plywood · Fire safety · Solar · EV charging · Furniture · Footwear · Textiles · Pumps & motors · Agriculture · Batteries · Chemicals, plastics & rubber

The mapping lives in [`data/seed/target_committees.yaml`](data/seed/target_committees.yaml) and is **self-verifying**: each group lists known-important IS numbers, and ingestion fails loudly if a group's own committees don't contain them.

That check earned its keep. It caught, among others:

- BIS files motorcycle helmets (IS 4151, IS 2925) under **CED 22 "Fire Fighting"** — no committee whose name suggests PPE.
- Electric toys (IS 15644) sit under **ETD 32 Electrical Appliances**, not the Toys committee.
- Solar water-pumping standards (IS 17018, IS 17429) belong to **MED 20 Pumps**.

### Notes on the BIS API

Undocumented, and there are traps worth recording:

- `getStandardsBySectorId` looks like the catalogue but is a *recent-publications* view, and silently returns 10 rows unless `mode`, `page` and `pageSize` are all supplied.
- `getWebsitePSTechDepartmentWise` takes a `typeSelected` flag. Only **7** returns a committee's full published list — `1` gives a much shorter recent-activity subset (96 vs 174 for cement, missing IS 269 entirely).
- That endpoint caps a page at **100 rows** regardless of the `limit` sent.
- Standard numbers are inconsistently cased — the catalogue holds both `IS 2347:2023` and `Is 2347:2023`, so comparisons must be case-insensitive.
- Department and committee ids are encrypted blobs; treat them as opaque tokens.

Two useful finds: the catalogue carries **official Hindi titles**, and there are per-standard endpoints for **recognised testing labs** and **ISI licence holders**.

Requests are throttled to 1/sec and cached on disk, so a re-run costs nothing and a crash mid-ingest loses no work.

---

## Getting started

**Requirements:** Python 3.11+. No Docker, no GPU, no model downloads — the whole stack is hosted APIs.

```bash
python -m venv .venv && .venv/Scripts/activate   # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Add your Groq API key to `.env` (get one at [console.groq.com/keys](https://console.groq.com/keys)):

```
GROQ_API_KEY=gsk_...
```

You also need a **Gemini** key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) for embeddings, and **Supabase** credentials for the vector store.

Apply the schema once by pasting [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) into the Supabase SQL Editor. It creates the tables, the pgvector and full-text indexes, and the `match_chunks` / `match_standards` hybrid-search functions.

### Ingest the catalogue

```bash
python -m bis.ingest.scrape_catalogue --check-mapping   # validate config first
python -m bis.ingest.scrape_catalogue                   # ~6,200 standards
python -m bis.ingest.scrape_catalogue --stats
```

### Run the API

```bash
uvicorn bis.api.main:app --reload
```

`GET /health` reports on Groq, Qdrant and the embedding model. Interactive docs at `/docs`.

### Tests

```bash
pytest
```

---

## Layout

```
src/bis/
├── config.py           # settings (pydantic-settings)
├── llm.py              # Groq: chat, JSON mode, streaming, fallback
├── ingest/
│   ├── bis_api.py      # BIS portal API client (throttled, cached)
│   ├── scrape_catalogue.py
│   └── chunk.py        # section-aware chunking, never splits a clause
├── store/
│   ├── db.py           # SQLAlchemy models (ingestion staging)
│   └── supabase_store.py  # pgvector + FTS hybrid search over REST
├── retrieval/
│   ├── embed.py        # Gemini embeddings (1536d, task-typed)
│   ├── rerank.py       # LLM reranking + abstention threshold
│   └── fusion.py       # client-side RRF across result sets
├── guardrails/
│   └── citations.py    # marker validation, clause-claim grounding
└── api/main.py
data/seed/              # committee mapping, curated CSVs
tests/
```

Two files carry most of the design weight:

- **`ingest/chunk.py`** — whatever metadata is stamped here is the ceiling on citation quality. Chunks never span a clause boundary, because a passage starting mid-clause cannot honestly be cited as that clause.
- **`supabase/migrations/0001_init.sql`** — dense and lexical results are fused with Reciprocal Rank Fusion inside Postgres, rather than a weighted score sum: cosine distance and `ts_rank_cd` aren't on a comparable scale, so any weighting would be arbitrary.

---

## Roadmap

- [x] Project skeleton, schema, health checks
- [x] Catalogue ingestion — 6,209 standards, per-group verification
- [ ] Public scheme / QCO / hallmarking PDF ingestion
- [x] Cloud retrieval stack — Gemini embeddings, Supabase pgvector, LLM reranking
- [x] Catalogue uploaded to Supabase — 6,209 standards, hybrid search live
- [x] Intent router, tools, cited answers, chat endpoints
- [ ] Generate embeddings (needs GEMINI_API_KEY)
- [ ] Multilingual (Hindi first, using BIS's own Hindi titles)
- [ ] Evaluation harness — recall@k, citation precision, refusal rate
- [ ] Frontend

## Data & licence

All data is retrieved from public BIS endpoints; `robots.txt` permits the catalogue paths. **No paywalled standard texts are included or redistributed.** This is an independent hackathon project and is not affiliated with or endorsed by the Bureau of Indian Standards.
