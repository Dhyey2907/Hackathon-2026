/**
 * Backend client for BIS Sahayak.
 *
 * One typed layer for every call, so the shapes live in exactly one place. The
 * types in ./types.ts mirror what the FastAPI service actually returns - they
 * were verified against a running backend, not against the design doc, because
 * the two had already drifted (the router's intent names changed, and /health
 * reports supabase where the doc still said qdrant).
 *
 * Mock mode: set NEXT_PUBLIC_USE_MOCK=true, or simply leave NEXT_PUBLIC_API_URL
 * unset. Components fall back to the fixtures in ./mock*.ts so the UI stays
 * developable with no backend running.
 */

import type {
  ChatRequest,
  ChatResponse,
  ContextResponse,
  HealthResponse,
  Lab,
  LabsResponse,
  Standard,
  StandardsSearchResponse,
  StreamEvent,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** True when components should use fixtures instead of the backend. */
export const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
  !process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (cause) {
    // A network-level failure is almost always "the backend isn't running",
    // which is worth saying plainly rather than surfacing "Failed to fetch".
    throw new ApiError(
      `Cannot reach the assistant backend at ${API_URL}. Is it running?`,
      0,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(
      body.slice(0, 300) || `Request failed with ${res.status}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

// --------------------------------------------------------------------- chat

export function sendMessage(body: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Stream an answer as Server-Sent Events.
 *
 * Uses fetch rather than EventSource because the endpoint is a POST with a JSON
 * body, which EventSource cannot do. Events are parsed out of the byte stream
 * by hand: an SSE frame ends at a blank line, and a chunk boundary can fall
 * mid-frame, so the trailing partial line is carried over to the next read.
 *
 * `onEvent` receives every event including `done` and `error`. Pass an
 * AbortSignal to cancel a request in flight.
 */
export async function streamMessage(
  body: ChatRequest,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      text.slice(0, 300) || `Stream failed with ${res.status}`,
      res.status,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    // The last element is whatever came after the final blank line: either an
    // empty string or an incomplete frame. Either way it waits for more bytes.
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          onEvent(JSON.parse(line.slice(6)) as StreamEvent);
        } catch {
          // A malformed frame should not kill an otherwise good stream.
          console.warn("skipping unparseable SSE frame", line.slice(0, 120));
        }
      }
    }
  }
}

/**
 * Infer what the user works with, and what they might usefully ask next.
 *
 * The conversation is sent from here rather than read on the server. The
 * history lives in Supabase under row-level security, so the browser can only
 * ever read this account's messages - which means the backend cannot be
 * tricked into summarising somebody else's conversation, because it never
 * queries the table.
 */
export function getContext(
  messages: { role: string; content: string }[],
  lastQuestion?: string,
): Promise<ContextResponse> {
  return request<ContextResponse>("/context", {
    method: "POST",
    body: JSON.stringify({
      // Recent turns are what describe a business; older ones add tokens
      // without adding signal.
      messages: messages.slice(-60),
      last_question: lastQuestion ?? null,
    }),
  });
}

// ---------------------------------------------------------------- catalogue

export function searchStandards(
  q: string,
  limit = 20,
): Promise<StandardsSearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return request<StandardsSearchResponse>(`/standards/search?${params}`);
}

export function getStandard(
  isNumber: string,
): Promise<{ standard: Standard | null; related?: Standard[]; matches?: Standard[] }> {
  return request(`/standards/${encodeURIComponent(isNumber)}`);
}

// --------------------------------------------------------------------- labs

export function findLabs(
  opts: {
    state?: string;
    scope?: string;
    q?: string;
    recognisedOnly?: boolean;
    limit?: number;
  } = {},
): Promise<LabsResponse> {
  const params = new URLSearchParams();
  if (opts.state) params.set("state", opts.state);
  if (opts.scope) params.set("scope", opts.scope);
  if (opts.q) params.set("q", opts.q);
  if (opts.recognisedOnly) params.set("recognised_only", "true");
  // The directory is ~790 rows. Fetching it once and filtering in the browser
  // beats a round trip per keystroke.
  params.set("limit", String(opts.limit ?? 1000));
  return request<LabsResponse>(`/labs?${params}`);
}

// ------------------------------------------------------------------- health

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export type { Lab, Standard };
