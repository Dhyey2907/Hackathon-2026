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
  | "certification"
  | "hallmarking"
  | "labs"
  | "consumer"
  | "smalltalk";

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
  /** Tool output behind the answer: standards, labs. Empty for prose answers. */
  structured?: Record<string, unknown>;
  /** Backend health notes, e.g. "answer cites no sources despite evidence". */
  warnings?: string[];
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

export interface BusinessContext {
  products: string[];
  role: "manufacturer" | "seller" | "service_provider" | "unknown";
  industry: string | null;
  business_type: string | null;
  /** Only "high" and "medium" may be shown to the user as context. */
  confidence: "high" | "medium" | "low" | "none";
  /** The user's own words supporting the above, if any. */
  evidence: string | null;
  topics: string[];
  is_usable: boolean;
  /**
   * Pre-hedged phrasing from the backend: "you're working with X" when they
   * said so, "you've been asking about X" when it was inferred. The wording
   * lives server-side so the confidence rule has exactly one home.
   */
  headline: string | null;
}

export interface ContextResponse {
  /** True whenever there is nothing trustworthy to personalise with. */
  is_new_user: boolean;
  business_context: BusinessContext;
  suggestions: string[];
}

export interface ChatRequest {
  message: string;
  /** Existing session UUID, or null to start a new session */
  session_id: string | null;
  /** "auto" | "en" | "hi" */
  language: string;
  /**
   * What the user works with. Shapes how the question is read - it resolves
   * "my product" - but is never treated as evidence for a factual claim.
   */
  user_context?: string | null;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  session_id: string;
  abstained: boolean;
  intent: Intent;
  latency_ms: number;
  /** Structured payload for intents that return rows (labs, standards). */
  structured?: Record<string, unknown>;
  /**
   * Guardrail notices. Non-empty means the answer is degraded in a way worth
   * showing: a citation was stripped, a clause was claimed that no source
   * supports, or the model cited nothing at all despite having evidence.
   */
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// SSE event stream shapes  (POST /chat/stream)
// ---------------------------------------------------------------------------

export type StreamEvent =
  | {
      event: "intent";
      intent: Intent;
      product: string | null;
      is_numbers: string[];
    }
  | { event: "token"; text: string }
  | { event: "structured"; data: Record<string, unknown> }
  | { event: "sources"; sources: Source[] }
  | {
      event: "done";
      session_id: string;
      abstained: boolean;
      latency_ms: number;
      /** Markers the model invented; already stripped from the text. */
      dropped_markers?: string[];
      /** True when the answer cited nothing despite evidence being retrieved. */
      uncited?: boolean;
    }
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
  /** BIS technical department code: CED, ETD, LITD, ... */
  division?: string | null;
  /** Hybrid-search relevance; present on search results only. */
  score?: number;
}

export interface Lab {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  /**
   * Always null today. BIS does not publish test scopes in the recognised-lab
   * lists; scope lives in the LIMS portal, searchable one standard at a time.
   */
  scope: string | null;
  /** "BIS recognised (Group 1)" or "Facility used by BIS, not recognised (Group 2)". */
  schemes: string | null;
  /** Always null. The published lists carry no phone, e-mail or address. */
  contact: string | null;
  source_url: string | null;
  /** BIS's own identifier for the laboratory. */
  osl_code?: string | null;
  /** Private / Govt. / Autonomous, as published. */
  category?: string | null;
  /** ISO date recognition lapses. Group 2 entries have none. */
  valid_to?: string | null;
  /** False when the newest dated event in `remarks` is a suspension. */
  operative?: boolean;
  /** BIS's raw suspension/revocation audit trail, kept verbatim. */
  remarks?: string | null;
}

/** One announcement from the BIS What's New feed. */
export interface BisUpdate {
  id: number;
  update_uid: string;
  title: string;
  url: string | null;
  /** Derived from the title, not published by BIS. */
  category: "amendment" | "qco" | "hallmarking" | "licence" | "standard" | "recruitment" | "event" | "news";
  media_type: string | null;
  size: string | null;
  /** ISO date on the notice. Null for the few archive rows BIS left undated. */
  published_on: string | null;
  is_number: string | null;
  source_page: string | null;
}

export interface UpdatesResponse {
  results: BisUpdate[];
  total: number;
  since: string | null;
  by_category: Record<string, number>;
  source: string;
}

export interface LabsResponse {
  results: Lab[];
  total: number;
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
  supabase: {
    ok: boolean;
    url?: string;
    rows?: { standards: number; chunks: number; labs: number };
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
