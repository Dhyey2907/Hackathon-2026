/**
 * Mock data and fake API functions for development.
 *
 * Activated by default when NEXT_PUBLIC_USE_MOCK=true (or when
 * NEXT_PUBLIC_API_URL is not set). The shapes returned here must match the
 * real backend contract exactly so the swap is a one-line env change.
 */

import type { ChatRequest, ChatResponse, Message, Source } from "./types";

// ---------------------------------------------------------------------------
// Sample sources
// ---------------------------------------------------------------------------

const SOURCE_LED: Source[] = [
  {
    marker: "S1",
    chunk_uid: "mock-001",
    title: "Scheme of Testing and Inspection for LED Luminaires",
    doc_type: "scheme_guideline",
    url: "https://www.bis.gov.in/",
    locator: "clause 4.2.1, p. 12",
    is_number: "IS 16102 (Part 1):2012",
  },
  {
    marker: "S2",
    chunk_uid: "mock-002",
    title: "Quality Control Order for LED Lights and Fixtures",
    doc_type: "qco",
    url: "https://www.bis.gov.in/",
    locator: "para 3, p. 2",
    is_number: null,
  },
  {
    marker: "S3",
    chunk_uid: "mock-003",
    title: "IS 16102: LED Luminaires for General Lighting",
    doc_type: "catalogue",
    url: "https://www.bis.gov.in/standards/detail/IS16102",
    locator: null,
    is_number: "IS 16102:2012",
  },
];

const SOURCE_HALLMARK: Source[] = [
  {
    marker: "S1",
    chunk_uid: "mock-011",
    title: "BIS Hallmarking Scheme for Gold Jewellery",
    doc_type: "hallmarking",
    url: "https://www.bis.gov.in/",
    locator: "clause 7.1, p. 18",
    is_number: null,
  },
];

const SOURCE_CEMENT: Source[] = [
  {
    marker: "S1",
    chunk_uid: "mock-021",
    title: "IS 269: Ordinary Portland Cement — Specification",
    doc_type: "catalogue",
    url: "https://www.bis.gov.in/standards/detail/IS269",
    locator: null,
    is_number: "IS 269:2015",
  },
];

// ---------------------------------------------------------------------------
// Initial seed messages shown when the chat loads
// ---------------------------------------------------------------------------

export const INITIAL_MESSAGES: Message[] = [
  {
    id: "seed-1",
    role: "assistant",
    content:
      "Namaste! I am **BIS Sahayak**, an AI assistant for the Bureau of Indian Standards.\n\nI can help you with:\n- Which Indian Standards apply to your product\n- Certification schemes and licensing requirements\n- Hallmarking rules (HUID, gold purity, registration)\n- Finding BIS-recognised testing laboratories\n- Consumer rights and complaints\n\nWhat would you like to know?",
    sources: [],
    abstained: false,
    intent: "unknown",
    timestamp: new Date(Date.now() - 60_000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Canned responses keyed by rough topic detection
// ---------------------------------------------------------------------------

interface CannedResponse {
  answer: string;
  sources: Source[];
  abstained: boolean;
  intent: ChatResponse["intent"];
}

function pickResponse(message: string): CannedResponse {
  const lc = message.toLowerCase();

  if (lc.includes("led") || lc.includes("bulb") || lc.includes("light")) {
    return {
      intent: "recommend_standards",
      abstained: false,
      sources: SOURCE_LED,
      answer:
        "For LED bulbs manufactured in India, the following standards and requirements apply:\n\n**Applicable Standards**\n- **IS 16102 (Part 1):2012** [S1] — LED Luminaires for General Lighting. This is the primary product standard and covers photometric, electrical safety, and labelling requirements.\n- **IS 16102 (Part 2):2012** — covers particular requirements for luminaires.\n\n**Mandatory Certification**\nLED lights and fixtures are covered under a Quality Control Order (QCO) [S2] which makes BIS certification compulsory. You must obtain an **ISI Mark licence** before selling in India.\n\n**Licence Process**\n1. Apply on the BIS Connect portal with factory and test report details.\n2. BIS inspects the manufacturing unit.\n3. Product samples are tested at a BIS-recognised lab.\n4. Upon approval, an ISI licence is granted (valid 1 year, renewable).\n\nThe standard is available in the BIS catalogue [S3] — the full text is paywalled, but the catalogue entry confirms scope and the owning committee (ETD 28).",
    };
  }

  if (lc.includes("hallmark") || lc.includes("huid") || lc.includes("gold")) {
    return {
      intent: "passage_search",
      abstained: false,
      sources: SOURCE_HALLMARK,
      answer:
        "**HUID (Hallmark Unique ID)** is a 6-character alphanumeric code assigned to each piece of gold jewellery at the time of hallmarking [S1].\n\n**Key facts:**\n- Introduced by BIS in April 2021 as part of mandatory hallmarking.\n- Stamped on the jewellery along with the BIS logo, purity (e.g. 22K), and the Assaying & Hallmarking Centre (AHC) mark.\n- Enables end-to-end traceability — any consumer can verify the hallmark on the BIS portal using the HUID.\n\n**Mandatory hallmarking** applies to gold jewellery and artefacts sold in India. Jewellers must be registered with BIS; unregistered sale is an offence under the BIS Act.",
    };
  }

  if (lc.includes("cement") || lc.includes("is 269") || lc.includes("is269")) {
    return {
      intent: "standard_lookup",
      abstained: false,
      sources: SOURCE_CEMENT,
      answer:
        "**IS 269:2015** [S1] specifies requirements for Ordinary Portland Cement (OPC).\n\n> **Note:** The catalogue entry for IS 269 is available here, but the full standard text is paywalled. The information below is based on the publicly available catalogue metadata.\n\n**Scope:**\nOrdinary Portland Cement used in structural concrete, mortar, and grout. The standard sets requirements for chemical composition, compressive strength, setting time, soundness, and fineness.\n\n**Committee:** CED 2 (Cement and Concrete)\n\n**Status:** Current (2015 edition, reaffirmed 2020)\n\nFor the full text, purchase from [BIS Webstore](https://www.bis.gov.in/).",
    };
  }

  if (lc.includes("lab") || lc.includes("test") || lc.includes("gujarat")) {
    return {
      intent: "find_labs",
      abstained: false,
      sources: [],
      answer:
        "Here are BIS-recognised testing laboratories in **Gujarat** for cement testing:\n\n| Name | City | Scope |\n|---|---|---|\n| National Test House (NTH) Western Region | Vadodara | Cement, Steel, Electrical |\n| Gujarat Engineering Research Institute (GERI) | Vadodara | Civil, Cement, Water |\n| Shree Cement Ltd. Lab | Bharuch | Cement (in-house, not public) |\n\n> These results come from the BIS lab directory. Always verify current recognition status on the BIS portal before commissioning tests.",
    };
  }

  // Abstention: genuinely unanswerable
  if (
    lc.includes("price") ||
    lc.includes("cost") ||
    lc.includes("share") ||
    lc.includes("stock")
  ) {
    return {
      intent: "unknown",
      abstained: true,
      sources: [],
      answer:
        "I don't have reliable information to answer this question. My knowledge is limited to Indian Standards, BIS certification schemes, hallmarking rules, testing laboratories, and related consumer topics.\n\nFor pricing or commercial queries, I'd suggest contacting [BIS directly](https://www.bis.gov.in/contact) or the relevant manufacturer.\n\nIs there something about Indian Standards or BIS services I can help with instead?",
    };
  }

  // Generic fallback
  return {
    intent: "passage_search",
    abstained: false,
    sources: [],
    answer:
      "I've noted your question. Currently, my knowledge covers Indian Standards catalogue metadata, BIS certification and licensing schemes, hallmarking, testing laboratory directories, and consumer rights under the BIS Act.\n\nCould you rephrase or give me more detail? For example, mentioning a product category or an IS number will help me give a precise answer.",
  };
}

// ---------------------------------------------------------------------------
// Public API — drop-in replacement for the real fetch call
// ---------------------------------------------------------------------------

let _sessionId: string | null = null;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Simulates POST /chat with a ~1 second artificial delay.
 * Set NEXT_PUBLIC_USE_MOCK=true to use this instead of the real backend.
 */
export async function mockSendMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  // Simulate network round-trip
  await new Promise((resolve) =>
    setTimeout(resolve, 800 + Math.random() * 400)
  );

  if (!_sessionId) {
    _sessionId = request.session_id ?? generateId();
  }

  const canned = pickResponse(request.message);

  return {
    answer: canned.answer,
    sources: canned.sources,
    session_id: _sessionId,
    abstained: canned.abstained,
    intent: canned.intent,
    latency_ms: 800 + Math.random() * 400,
  };
}
