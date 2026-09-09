# Workflow

`bis-assistant-workflow.json` is a visual-workflow export that calls the BIS
assistant backend. Import it into the workflow tool and point the **BIS Backend**
node at your running API.

```
question → build request → POST /chat → parse → answer + sources + abstained
```

## Why it is this small

An earlier draft rebuilt the entire pipeline inside the graph — intent routing,
an embedded catalogue, a hand-written FAQ, local embedding/Qdrant/reranker
servers, and a second citation validator. It is deliberately not that.

The backend already does routing, hybrid retrieval, reranking, citation
validation and abstention, and has tests around them. Duplicating that in a
second place means two implementations that disagree the moment either changes —
and the workflow copy had no tests and worse data.

Four specific problems in that draft, recorded so they are not reintroduced:

| Problem | Detail |
|---|---|
| Dead models | `groq/llama-3.3-70b-versatile` and `llama-3.1-8b-instant` — Groq has retired the Llama chat models; both 404. |
| Local servers | Required `:8080` embeddings, `:6333` Qdrant, `:8081` reranker. The project runs entirely on hosted APIs. |
| Sample data as the corpus | 6 hardcoded standards standing in for 6,209 — convincing on a rehearsed question, hollow on the next one. |
| Wrong metadata | IS 13252 was labelled LITD 10 (actually **LITD 7**); IS 9873 was PCD 12 (actually **PCD 30**, PCD 12 is Plastics). |

The last one is the important one. Hardcoded incorrect regulatory metadata is
precisely what the citation validator exists to prevent, and it passes straight
through: the validator checks that a marker resolves to *a* source, not that the
source is *true*. A citation can be perfectly well-formed and still wrong.

The draft also cited a hand-written FAQ blob as `[S1]` against a bare
`bis.gov.in` URL — a citation that looks authoritative but points at nothing
specific, which quietly undermines the one guarantee this project makes.

## Contract

`POST /chat` returns:

```json
{
  "answer": "...text with [S1] markers...",
  "sources": [{"marker": "S1", "title": "...", "url": "...", "locator": "clause 4.2.1, p. 12", "is_number": "IS 302 (Part 1):2024", "doc_type": "scheme_guideline"}],
  "session_id": "...",
  "abstained": false,
  "intent": "recommend_standards",
  "latency_ms": 2140,
  "structured": {},
  "warnings": []
}
```

The parse node re-keys `sources` by marker so `[S1]` in the text maps directly to
its card, and treats an unparseable response as **abstained** rather than letting
a transport failure surface as a confident answer.

`abstained: true` is a normal outcome, not an error — the assistant refuses when
retrieved evidence is too weak. Render it as an answer, not a failure toast. See
[`../docs/FRONTEND_PROMPT.md`](../docs/FRONTEND_PROMPT.md) for the full contract
including the streaming variant.
