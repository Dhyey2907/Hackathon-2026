/**
 * Shared TypeScript types for BIS Sahayak.
 * Shapes mirror the backend API contract in docs/FRONTEND_PROMPT.md.
 */

// ---------------------------------------------------------------------------
// Source citation (one per [S1], [S2] marker)
// ---------------------------------------------------------------------------

export type DocType =
  | "catalogue"
  | "scheme_guideline"
  | "qco"
  | "act_rules"
  | "faq"
  | "consumer"
  | "hallmarking";

export interface Source {
  /** Matches the marker in answer text, e.g. "S1" */
  marker: string;
  chunk_uid: string;
  title: string | null;
  doc_type: DocType | null;
  url: string | null;
  /** Human-readable locator, e.g. "clause 4.2.1, p. 12" */
  locator: string | null;
  is_number: string | null;
}

// ---------------------------------------------------------------------------
// Intent (what the router classified the query as)
// ---------------------------------------------------------------------------

export type Intent =
  | "recommend_standards"
  | "standard_lookup"
  | "passage_search"
  | "find_labs"
  | "unknown";

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  /** Plain text or markdown content (with inline [S1] markers for assistant) */
  content: string;
  sources?: Source[];
  /** True when the backend abstained from answering */
  abstained?: boolean;
  intent?: Intent;
  /** Round-trip latency in ms (assistant only) */
  latency_ms?: number;
  /** ISO timestamp */
  timestamp: string;
  navigation?: ChatNavigation;
}

export interface ChatNavigation {
  label: string;
  href: string;
  sources: Source[];
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

export interface ChatRequest {
  message: string;
  /** Existing session UUID, or null to start a new session */
  session_id: string | null;
  /** "auto" | "en" | "hi" */
  language: string;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  session_id: string;
  abstained: boolean;
  intent: Intent;
  latency_ms: number;
}

// ---------------------------------------------------------------------------
// SSE event stream shapes  (POST /chat/stream)
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { event: "intent"; intent: Intent; language: string }
  | { event: "token"; text: string }
  | { event: "sources"; sources: Source[] }
  | { event: "done"; session_id: string; abstained: boolean; latency_ms: number }
  | { event: "error"; message: string };

// ---------------------------------------------------------------------------
// Standards catalogue
// ---------------------------------------------------------------------------

export interface Standard {
  is_number: string;
  title: string;
  committee: string | null;
  year: number | null;
  source_url: string | null;
}

export interface StandardsSearchResponse {
  results: Standard[];
  total: number;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: "ok" | "degraded";
  groq: { ok: boolean; model?: string; detail?: string };
  qdrant: {
    ok: boolean;
    url?: string;
    collection?: string;
    collection_exists?: boolean;
    points?: number;
    detail?: string;
  };
  embeddings: { ok: boolean; detail?: string };
  models: {
    router: string;
    answer: string;
    fallback: string;
    embed: string;
    rerank: string;
  };
}
