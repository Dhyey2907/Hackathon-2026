# BIS Sahayak — an assistant for Indian Standards

An AI assistant that answers questions about **Indian Standards and BIS services** — certification schemes, licensing, hallmarking, testing laboratories and consumer queries — in plain language, with **citations back to the source**.

Built for Smart India Hackathon problem statement **26107** (Bureau of Indian Standards).

> **Status: working end to end — backend and web app.** 6,209 standards, 790 document chunks and 790 testing laboratories are indexed in Supabase with hybrid dense + lexical search. The Next.js app talks to the live API for chat, search, labs, BIS updates, translation and document reading. A few screens still run on demo data; they are listed under [What is live and what is demo](#what-is-live-and-what-is-demo).

---

## The problem

BIS publishes thousands of Indian Standards and runs a dozen services across several portals and PDFs. An MSME asking a simple question — *"I manufacture LED bulbs, which standards apply and what licence do I need?"* — has to search a catalogue, a scheme portal, a QCO notification and a lab directory separately. Students and consumers fare worse.

This project answers that question in one turn, shows its sources, and then tells the user what to do next.

## What makes this different from a generic chatbot

**Every claim is traceable.** The model cites evidence as inline `[S1]` markers; a validator parses the output and **strips any marker that does not resolve to a passage that was actually retrieved**. If the retrieved evidence is too weak, the assistant abstains and points to the right BIS page instead of guessing.

That matters here more than in most RAG projects: a confidently wrong answer about a *legal certification requirement* can cost a small manufacturer real money. Abstention is treated as a feature, not a failure.

**What the user says is never evidence.** Three things reach the model besides BIS sources — the user's business context inferred from their conversation, a document they attached, and their question. The first two are labelled and kept **outside** the `SOURCES` block, so they can shape an answer but can never come back wearing an `[S1]` as if BIS had said them.

**The corpus scope is honest.** Full IS standard texts are paywalled and are **not** in this system. What is here:

- **Catalogue metadata** for 6,209 standards — number, title, committee, publication year — which is enough to answer *"which standard applies to my product?"*
- **Full text of public documents** — scheme guidelines, QCOs, licensing procedures, hallmarking and consumer material — which is where genuine clause-level citation comes from.

The assistant will describe what a standard covers and link to its BIS page; it will not invent clause text for a standard it only has metadata for.

---

## Features

### Chat assistant
- **Cited answers** with a source card per citation (title, clause/page locator, link), and an explicit abstention when the evidence is weak.
- **Attach a document** with the paperclip — PDF, Word (.docx) or text, up to 10 MB. The assistant reads it alongside your question (*"does this test report meet the standard?"*). Scanned PDFs and photos are refused with a reason rather than read as empty, since OCR is not wired in yet.
- **Personalised from your own conversation.** `POST /context` infers what you make and what you care about; that shapes later answers, clearly labelled as your context.
- **Follow-up suggestions** after each answer.
- **Context panel** beside the chat — four cards: *your business*, *certification documents behind the answer*, *sources*, and *nearby testing labs* (sorted by distance once you share your location; the map slot is ready for a Google Maps key).
- **Translate any answer** into Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada or Malayalam. Translation runs on the finished, already-validated English answer; if a citation marker does not survive translation, the translation is refused.
- **The scroll stays where you are reading** when an answer arrives; a *New answer ↓* pill takes you to it.
- **Chat history** is saved to Supabase for signed-in users, with row-level security confining each account to its own messages.
- **Fast repeats**: an answer cache and a verbatim FAQ fast path (223 BIS FAQs) skip the model entirely for questions BIS has already answered.

### Compliance Roadmap
Asks what business you are building — product, where it is made, what kind of product — then lays out the certification route step by step. Five tracks: **Scheme-I (ISI mark)**, **Scheme-II (CRS registration)**, **Scheme-X**, **FMCS** for factories outside India, and **jeweller registration for hallmarking**. Each step links to the BIS page it comes from and can be ticked off; progress is kept in the browser. The roadmap can start from your last chat or from signup.

### BIS Updates
Amendments, QCOs, licence notices and announcements pulled from the Bureau's own *What's New* page, grouped by the week they were published and filterable by category.

### Testing labs
BIS's published directory — 790 laboratories from the Group 1 (recognised) and Group 2 (used by BIS) lists, with OSL codes, recognition validity and suspension status. Search by state, city or scope.

### Documents
A document vault for licences, test reports and certificates, with expiry dates and warnings before they lapse. Files are stored in the browser (IndexedDB) and survive a reload; they are not uploaded anywhere unless you attach one in the chat. Documents can also be added during signup.

### Home dashboard
A compliance score that counts up to its value, missing requirements, expiring documents, and a quick upload box.

### Interface
- **English / हिन्दी toggle** for the navigation, chat, roadmap, labs, updates and upload screens.
- Light and dark themes, and subtle scroll-reveal animation that respects *reduced motion*.
- Signup with onboarding for consumers, running businesses and new businesses.

### What is live and what is demo

| Area | Data |
|---|---|
| Chat, sources, translation, document reading | **Live** — backend + Supabase |
| Standards search | **Live** catalogue search |
| Standard detail pages (`/standards/[slug]`) | Demo catalogue |
| Testing labs | **Live** — BIS directory |
| BIS Updates | **Live** — BIS What's New feed, refreshed by re-running the ingest |
| Compliance Roadmap | **Live** logic; steps link to BIS pages |
| Product wizard questions | Demo questions |
| Licence verification | Demo — only selected sample records |
| Dashboard amendments list | Demo list; the score is a formula over missing requirements and expiring documents |
| Document vault | Your files, plus four clearly marked samples |

---

## Architecture

```
ingestion (offline)          retrieval (online)              generation
─────────────────            ──────────────────              ──────────
BIS portal API ─┐            query → detect language
BIS documents   ├→ chunks →  → hybrid search (dense+lexical) → Groq LLM
seed CSVs       ┘  + metadata → RRF fuse → rerank            → cited answer
                      ↓                  ↑                        ↓
             Supabase pgvector     structured lookup          citation
              + Postgres FTS        (catalogue, labs)         validator
                                                                  ↓
                             Next.js app ← /chat, /context, /translate, /extract
```

Answering is an **intent-routed agent**, not one RAG chain — the eight required capabilities need different retrieval strategies:

| Intent | Tool | Source |
|---|---|---|
| Which standard applies to my product? | `recommend_standards` | catalogue vectors + committee taxonomy |
| What does standard X cover? | `standard_lookup` | Supabase catalogue |
| Certification scheme / licensing | `passage_search` | scheme documents |
| Hallmarking (HUID, purity, registration) | `passage_search` | hallmarking documents |
| Find a testing lab | `find_labs` | BIS lab directory |
| Consumer rights / complaints | `passage_search` | consumer documents |

With a document attached, the answer cache and FAQ shortcut are skipped (both key on the question alone), and if BIS retrieval finds nothing the assistant answers from the document only — with a warning, and with any `[S]` marker it invents stripped.

### Model choices

| Role | Model | Why |
|---|---|---|
| Answering | `openai/gpt-oss-120b` (Groq) | strongest available, 131k context |
| Fallback | `qwen/qwen3.8-27b` (Groq) | different family, so one provider-side fault can't take out both; strong Hindi |
| Routing | `openai/gpt-oss-20b` (Groq) | ~0.4 s intent classification, clean JSON |
| Translation | Groq answer model | runs on the validated English answer; markers must survive |
| Embeddings | `jina-embeddings-v3` (Jina, 1024d) | multilingual — a Hindi question matches English source text; free tier covers the corpus |
| Reranking | `openai/gpt-oss-20b` (Groq) | no hosted reranker in the stack; one call scores the whole candidate list |
| Document reading | PyMuPDF, python-docx | local parsing, no model call |

Everything runs on hosted APIs — **no model weights are downloaded**. Things worth knowing before changing providers:

- **Groq's free tier limits tokens per minute.** Two long answers in quick succession can hit it; the API then returns **503** with a reason, and the chat offers Retry.
- **Groq has no embeddings endpoint** — verified, not assumed: 14 models, none of them embedding, and `/v1/embeddings` returns 404. That is why embeddings come from elsewhere.
- **Groq no longer serves the Llama chat models.** Any tutorial referencing `llama-3.3-70b-versatile` or `llama-3.1-8b-instant` will 404 — only the prompt-guard Llama variants remain. Check `client.models.list()` rather than trusting documentation.
- **Gemini's free tier is unusable for bulk embedding.** The binding limit is `EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier = 1000` — a thousand embedded items *per day*, so this 6,209-row corpus would take a week. There is also a 100/minute cap that counts each item in a batch as a request, which is the one you hit first and which distracts from the real problem. Jina's free tier (~1M tokens) does the whole corpus in ~16 minutes.
- **Embeddings are 1024-dimensional.** pgvector's HNSW index caps at 2000 dimensions, so any provider must be truncated below that; vectors are re-normalised afterwards, since Matryoshka truncation does not preserve unit length.
- **Never mix embedding providers in one column.** Vectors from different models are not comparable, so a half-migrated table returns confident nonsense with no error. Switching provider means re-embedding everything and resizing the column — `EMBED_PROVIDER` exists to make that switch deliberate.
- **Embeddings are asymmetric.** Passages and queries use different task types (`retrieval.passage` / `retrieval.query` on Jina). Using one for both returns plausible vectors and quietly worse retrieval.

Reranking by LLM is a real trade-off: a trained cross-encoder would be better and cheaper per candidate. This buys a stack with no local weights.

Avoid `qwen/qwen3.6-27b`: it emits `<think>` reasoning blocks that would need stripping before display.

---

## Corpus

| Data | Size | Source |
|---|---|---|
| Standards catalogue | 6,209 standards | BIS portal API, 25 product groups / 82 committees |
| Scheme, QCO and FAQ documents | 220 chunks | public BIS documents in [`FaQs/`](FaQs) |
| Hallmarking and HUID | 570 chunks from 26 sources | FAQs, the 2018 Regulations, the mandatory-hallmarking order and its amendments, the district list |
| Testing laboratories | 790 labs | BIS Group 1 (438 recognised) and Group 2 (352) lists |
| BIS updates | weekly, from *What's New* | re-run the ingest to refresh |

Rather than all ~15,000 published standards, the catalogue targets **25 priority product groups** — the QCO-heavy consumer and industrial categories where BIS questions actually cluster — mapped onto **82 BIS sectional committees**.

Household electrical · Electronics & IT · Wires & cables · Cement · Steel & construction · Drinking water · Automobiles & tyres · Helmets & PPE · Cookers & utensils · LPG appliances · Toys · Hallmarking · Food · Pipes & plumbing · Plywood · Fire safety · Solar · EV charging · Furniture · Footwear · Textiles · Pumps & motors · Agriculture · Batteries · Chemicals, plastics & rubber

The mapping lives in [`data/seed/target_committees.yaml`](data/seed/target_committees.yaml) and is **self-verifying**: each group lists known-important IS numbers, and ingestion fails loudly if a group's own committees don't contain them.

That check earned its keep. It caught, among others:

- BIS files motorcycle helmets (IS 4151, IS 2925) under **CED 22 "Fire Fighting"** — no committee whose name suggests PPE.
- Electric toys (IS 15644) sit under **ETD 32 Electrical Appliances**, not the Toys committee.
- Solar water-pumping standards (IS 17018, IS 17429) belong to **MED 20 Pumps**.

### Notes on the BIS sources

Undocumented, and there are traps worth recording:

- `getStandardsBySectorId` looks like the catalogue but is a *recent-publications* view, and silently returns 10 rows unless `mode`, `page` and `pageSize` are all supplied.
- `getWebsitePSTechDepartmentWise` takes a `typeSelected` flag. Only **7** returns a committee's full published list — `1` gives a much shorter recent-activity subset (96 vs 174 for cement, missing IS 269 entirely).
- That endpoint caps a page at **100 rows** regardless of the `limit` sent.
- Standard numbers are inconsistently cased — the catalogue holds both `IS 2347:2023` and `Is 2347:2023`, so comparisons must be case-insensitive.
- Department and committee ids are encrypted blobs; treat them as opaque tokens.
- Some document links on bis.gov.in redirect to the homepage instead of a PDF, the *What's New* date filters are ignored, and the lab lists contain state-name typos — the ingesters check for each of these rather than trusting the response.

Two useful finds: the catalogue carries **official Hindi titles**, and there are per-standard endpoints for **recognised testing labs** and **ISI licence holders**.

Requests are throttled to 1/sec and cached on disk, so a re-run costs nothing and a crash mid-ingest loses no work.

---

## Getting started

**Requirements:** Python 3.11+ and Node.js 20+. No Docker, no GPU, no model downloads — the whole stack is hosted APIs.

### Backend

```bash
python -m venv .venv && .venv/Scripts/activate   # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Fill in `.env`:

```
GROQ_API_KEY=gsk_...                   # https://console.groq.com/keys
JINA_API_KEY=jina_...                  # https://jina.ai/embeddings
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=sb_publishable_...        # reads
SUPABASE_SERVICE_KEY=...               # ingestion writes only
```

Apply the schema by running the files in [`supabase/migrations/`](supabase/migrations) in order in the Supabase SQL Editor. `0001_init.sql` creates the tables, the pgvector and full-text indexes, and the `match_chunks` / `match_standards` hybrid-search functions; the later files add chat history, lab recognition fields and the BIS updates table. Auth setup for the app is in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

Run the API:

```bash
uvicorn bis.api.main:app --reload
```

`GET /health` reports on Groq, Supabase, the embedding provider and the caches. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                            # http://localhost:3000
```

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # never the service key — it ships to the browser
# NEXT_PUBLIC_USE_MOCK=true                        # develop against fixtures, no backend
```

Without Supabase settings the app still runs, with a local account kept in the browser and no saved chat history.

On Windows, [`Start BIS Sahayak.bat`](Start%20BIS%20Sahayak.bat) starts both servers and opens the browser — set `PROJECT_ROOT` at the top of the file to where you cloned the repo.

### Ingest

Only needed to rebuild the data; the hosted Supabase project already holds it.

```bash
# 1. catalogue: BIS portal -> local SQLite staging
python -m bis.ingest.scrape_catalogue --check-mapping   # validate the mapping first
python -m bis.ingest.scrape_catalogue                   # ~6,200 standards

# 2. push to Supabase and embed
python -m bis.ingest.index_supabase --upload --embed

# 3. parse, upload and embed the FaQs documents
python -m bis.ingest.index_supabase --chunks

# 4. fetch, parse and upload the public hallmarking corpus
python -m bis.ingest.hallmarking --upload
python -m bis.ingest.index_supabase --embed

# 5. build the testing-laboratory directory
python -m bis.ingest.labs --upload

# 6. pull the BIS What's New feed (re-run to pick up new notices)
python -m bis.ingest.updates --upload --refresh
```

Both embedding steps resume: they select rows where `embedding IS NULL`, so an interrupted run costs nothing and re-running picks up exactly where it stopped.

### API

| Endpoint | Purpose |
|---|---|
| `POST /chat` | one-shot answer — `answer, sources, intent, abstained, warnings, structured, latency_ms, session_id`. Optional `user_context` and `attachment {name, text}` |
| `POST /chat/stream` | same, as SSE: `intent` → `token`* → `sources` → `done` |
| `POST /context` | business context and follow-up suggestions inferred from the conversation the client sends |
| `POST /extract` | read the text of an uploaded PDF, .docx or text file (base64 JSON, ≤ 10 MB); nothing is stored |
| `POST /translate` | translate a finished answer, citations preserved or the translation is refused |
| `GET /languages` | the eight languages `/translate` supports |
| `GET /standards/search?q=` | hybrid search over the catalogue |
| `GET /standards/{is_number}` | one standard plus siblings from its committee |
| `GET /labs?state=&q=&recognised_only=` | testing laboratories, from BIS's Group 1 and Group 2 lists |
| `GET /updates?category=&weeks=` | BIS announcements from the What's New feed, newest first |
| `GET /health` | dependency and cache status |

Each entry in `sources` carries `marker, title, url, locator, is_number, doc_type, chunk_uid` — `locator` being the `clause 4.2.1, p. 12` string a citation displays. The full contract, including the streaming events, is in [`docs/FRONTEND_PROMPT.md`](docs/FRONTEND_PROMPT.md).

### Tests

```bash
pytest          # 250 tests, all offline
cd frontend && npx tsc --noEmit && npm run lint
```

---

## Layout

```
src/bis/
├── config.py              # settings (pydantic-settings)
├── llm.py                 # Groq: chat, JSON mode, streaming, fallback
├── ingest/
│   ├── bis_api.py         # BIS portal API client (throttled, cached)
│   ├── scrape_catalogue.py
│   ├── parse_docs.py      # FaQs PDFs/DOCX -> citable sections
│   ├── chunk.py           # section-aware chunking, never splits a clause
│   ├── index_supabase.py  # upload + resumable embedding backfill
│   ├── hallmarking.py     # public hallmarking / HUID corpus
│   ├── labs.py            # Group 1 + Group 2 laboratory lists
│   └── updates.py         # What's New feed
├── store/
│   ├── db.py              # SQLAlchemy models (ingestion staging)
│   └── supabase_store.py  # pgvector + FTS hybrid search over REST
├── retrieval/
│   ├── embed.py           # embeddings (Jina 1024d default, task-typed)
│   ├── rerank.py          # LLM reranking + abstention threshold
│   └── fusion.py          # client-side RRF across result sets
├── guardrails/
│   └── citations.py       # marker validation, clause-claim grounding
├── agent/
│   ├── router.py          # intent + entity extraction
│   ├── tools.py           # one retrieval strategy per intent
│   ├── prompts.py         # the citation contract
│   ├── answer.py          # orchestration, abstention, validation, attachments
│   ├── answer_cache.py    # replay clean answers to repeated questions
│   ├── faq_cache.py       # verbatim FAQ fast path
│   └── business_context.py  # what the user makes, from their own messages
├── documents/
│   └── extract.py         # read uploaded PDF / DOCX / text in memory
├── i18n/
│   └── translate.py       # answer translation with marker preservation
└── api/
    ├── main.py
    ├── routes_chat.py
    ├── routes_context.py
    ├── routes_extract.py
    ├── routes_search.py   # standards + labs
    ├── routes_translate.py
    └── routes_updates.py
frontend/                  # Next.js 16, React 19, Tailwind v4
├── src/app/               # chat, roadmap, updates, labs, standards, documents, wizard, verify, …
├── src/components/        # chat, roadmap, documents, i18n, motion, …
└── src/lib/               # API client, roadmap tracks, i18n strings, types
FaQs/                      # public BIS scheme and FAQ documents
data/seed/                 # committee mapping
supabase/migrations/       # schema + hybrid search functions
docs/                      # API contract, Supabase setup, design system
workflow/                  # a small visual-workflow export that calls POST /chat
tests/
```

`docker-compose.yml` (Qdrant) is left over from an earlier local-vector-store design and is not used; Supabase is the store.

Two files carry most of the design weight:

- **`ingest/chunk.py`** — whatever metadata is stamped here is the ceiling on citation quality. Chunks never span a clause boundary, because a passage starting mid-clause cannot honestly be cited as that clause.
- **`supabase/migrations/0001_init.sql`** — dense and lexical results are fused with Reciprocal Rank Fusion inside Postgres, rather than a weighted score sum: cosine distance and `ts_rank_cd` aren't on a comparable scale, so any weighting would be arbitrary.

---

## Roadmap

- [x] Project skeleton, schema, health checks
- [x] Catalogue ingestion — 6,209 standards, per-group verification
- [x] Cloud retrieval stack — Jina embeddings, Supabase pgvector, LLM reranking
- [x] Intent router, tools, cited answers, chat + streaming endpoints
- [x] Scheme / QCO / FAQ documents — 220 chunks with clause locators
- [x] Hallmarking and HUID documents — 570 chunks from 26 public BIS sources
- [x] Testing-laboratory directory — 790 labs with recognition validity and suspension status
- [x] BIS Updates feed — grouped by publication week
- [x] Web app — chat, sources, context panel, follow-ups, chat history
- [x] Answer cache and FAQ fast path
- [x] Personalisation from the user's own conversation
- [x] Answer translation into eight Indian languages; Hindi interface
- [x] Compliance Roadmap with five certification tracks and progress tracking
- [x] Document upload — read by the assistant in chat, stored in the vault, added at signup
- [ ] OCR for scanned documents and photos
- [ ] Live data for the product wizard, licence verification and standard detail pages
- [ ] Hindi for the remaining screens (wizard, verification, documents, profile, settings, onboarding)
- [ ] Map view for nearby labs (needs a Google Maps key)
- [ ] Consumer-complaint data
- [ ] Evaluation harness — recall@k, citation precision, refusal rate

## Data & licence

All data is retrieved from public BIS endpoints; `robots.txt` permits the catalogue paths. **No paywalled standard texts are included or redistributed.** Documents users upload are read in memory to answer their question and are not stored by the backend. This is an independent hackathon project and is not affiliated with or endorsed by the Bureau of Indian Standards.
