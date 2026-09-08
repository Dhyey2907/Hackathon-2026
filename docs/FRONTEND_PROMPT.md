# Frontend build prompt

Hand the block below to whichever tool is building the UI (a fresh Claude Code session, v0, Lovable, Cursor).

> **The API described here is a contract, not a running service.** Only `GET /health` exists today. Build against the mock described in the prompt; the backend will implement exactly these shapes. If you change a shape, change it in this file too, or the two halves will drift.

---

## The prompt

Build the frontend for **BIS Sahayak**, an AI assistant that answers questions about Indian Standards and Bureau of Indian Standards (BIS) services — certification schemes, licensing, hallmarking, testing laboratories, and consumer queries. It is a Smart India Hackathon project (problem statement 26107). The Python backend already exists and holds a catalogue of 6,209 Indian Standards.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS. No component library beyond Radix primitives or shadcn/ui. No state library — React state and the streaming hook are enough.

### Who uses this

An MSME owner who wants to know which standards apply to the product they manufacture and what licence they need. A jeweller checking hallmarking rules. A student researching a standard. A consumer who bought something with a fake ISI mark. Most are on mid-range Android phones, many are more comfortable in Hindi than English, and few know BIS vocabulary. **Design mobile-first.** Assume the user does not know what "QCO", "CRS" or "conformity assessment" mean.

### The one thing that makes this UI different

Every answer is **source-backed**, and the interface has to make that visible rather than burying it. The assistant emits inline citation markers `[S1]`, `[S2]` that map to a `sources` array. Do not strip them and do not render them as raw text.

- Render each marker as a **small superscript pill** inline in the prose. Clicking or tapping it opens that source.
- Below the answer, show a **Sources** section: numbered cards with document title, the locator (`clause 4.2.1, p. 12`) when present, the IS number when present, and a link out to the BIS page. Collapsed to the first 3 on mobile.
- Hovering a marker on desktop shows a preview of the cited passage.

Treat citations as a primary feature of the design, not a footnote. They are the reason to trust the answer.

### States you must handle

These are not edge cases. They will appear in the demo.

1. **Abstention.** When retrieved evidence is too weak, the backend deliberately refuses rather than guessing, and returns `"abstained": true` with an empty or short `sources` array. Render this as a calm, helpful state — an explanation plus links to the right BIS page — **not** as an error. A wrong answer about a legal certification requirement is worse than no answer, so this state should look like considered judgement, not failure.
2. **Metadata-only answers.** The corpus holds catalogue metadata for most standards but not their paywalled full text. Answers about such standards describe coverage and link out instead of quoting clauses. When `sources[].doc_type` is `catalogue`, label the card so the user understands they are getting the standard's identity and scope, not its text.
3. **Streaming.** Tokens arrive over SSE. Show them as they land, with a typing indicator, and render the sources only once the `sources` event arrives. Never re-render the whole message on each token.
4. **Long answers.** Multi-part answers (standards + licence + labs) are common. Support markdown: headings, lists, tables.
5. **Errors and rate limits.** A failed request should offer a retry, not a dead end.

### API contract

Base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

**`POST /chat/stream`** — Server-Sent Events.

Request:
```json
{
  "message": "I manufacture LED bulbs, which standards apply and what licence do I need?",
  "session_id": "uuid-or-null",
  "language": "auto"
}
```

Event stream — each `data:` line is JSON with an `event` field:
```
data: {"event":"intent","intent":"recommend_standards","language":"en"}
data: {"event":"token","text":"For LED bulbs you would look at "}
data: {"event":"token","text":"IS 16102 "}
data: {"event":"sources","sources":[ ...Source objects... ]}
data: {"event":"done","session_id":"...","abstained":false,"latency_ms":2140}
```
An `{"event":"error","message":"..."}` may arrive at any point and ends the stream.

`Source` object:
```json
{
  "marker": "S1",
  "chunk_uid": "a1b2c3...",
  "title": "Scheme of Testing and Inspection for LED Luminaires",
  "doc_type": "scheme_guideline",
  "url": "https://www.bis.gov.in/...",
  "locator": "clause 4.2.1, p. 12",
  "is_number": "IS 16102 (Part 1):2012"
}
```
`doc_type` is one of `catalogue`, `scheme_guideline`, `qco`, `act_rules`, `faq`, `consumer`, `hallmarking`.

**`POST /chat`** — same request, non-streaming, returns `{answer, sources, session_id, abstained, intent, latency_ms}`. Use as the fallback when EventSource fails.

**`GET /standards/search?q=&limit=`** → `{results: Standard[], total}` where `Standard` is `{is_number, title, committee, year, source_url}`.

**`GET /standards/{is_number}`** → one `Standard` with related standards.

**`GET /labs?state=&scope=`** → `{results: Lab[]}` where `Lab` is `{name, city, state, scope, schemes, contact}`.

**`GET /health`** → `{status, groq, qdrant, embeddings, models}`. **This one is live already** — use it to drive a connection indicator.

Build against a mock module that returns these shapes with a simulated token delay, switched by an env flag, so the UI is testable before the backend lands.

### Screens

1. **Chat** (primary, the landing page). Message list, composer, streaming answers with inline citations and a sources section. Empty state offers 4–5 example questions drawn from the demo scenarios below — this matters, because users do not know what to ask.
2. **Standard detail** — number, title, owning committee, year, related standards, and an "Ask about this standard" button that seeds the chat.
3. **Lab finder** — filter by state and test scope, results as cards.

Keep navigation to a single header. Do not build a dashboard, a landing page with marketing sections, or a settings screen.

### Language

A language switcher in the header: English, हिंदी, and a "detect automatically" default. Send the choice as `language`. The backend answers in the user's language while keeping IS numbers, scheme names and citation markers untranslated — so **do not translate or reformat those strings client-side**. Localise the UI chrome (buttons, labels, empty states) for English and Hindi; leave the other languages for later rather than shipping half-translated screens.

### Design direction

Clean, official, and trustworthy — this is government-adjacent information that people will act on. Restrained palette; a single accent for interactive elements. Generous type and spacing, because much of the content is dense technical text. Support dark mode via a theme token set, not per-component overrides.

Do not use AI-chat clichés: no purple-to-pink gradients, no glassmorphism, no animated sparkle icons. Aim closer to a well-made government service or a documentation site than to a consumer chatbot.

Accessibility is a requirement, not a nice-to-have: keyboard-navigable, visible focus rings, `aria-live` on the streaming region, WCAG AA contrast, and a screen-reader-sensible reading order for citation markers.

### Demo scenarios — make sure these look good

1. `"I manufacture LED bulbs, which BIS standards and licence do I need?"` — a long multi-part answer with many citations.
2. `"गोल्ड हॉलमार्किंग में HUID क्या है?"` — Hindi question, Hindi answer, English IS numbers preserved.
3. `"Which labs near Gujarat can test cement?"` — structured lab results rather than prose.
4. `"What does IS 456 cover?"` — a metadata-only answer that links out instead of quoting clause text.
5. A deliberately unanswerable question — the **abstention** state.

Scenario 5 is the one that usually gets skipped and is the one worth polishing. Being visibly careful about what it does not know is this project's strongest claim.

### Do not

- Do not invent, hardcode or placeholder any BIS content — no fake IS numbers, no sample standards in the UI copy. Everything factual comes from the API. Fabricated regulatory text is the single worst failure mode here.
- Do not hide, reformat or renumber citation markers.
- Do not render an abstention as an error toast.
- Do not add auth, user accounts or analytics.
