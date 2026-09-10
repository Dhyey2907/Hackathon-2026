export interface RecentChat {
  id: string;
  title: string;
  prompt: string;
}

export interface RecentDocument {
  id: string;
  title: string;
  uploadedAt: string;
  type: string;
}

export const RECENT_CHATS: RecentChat[] = [
  { id: "led-standards", title: "LED bulb standards and licence", prompt: "I manufacture LED bulbs. Which BIS standards apply and what licence do I need?" },
  { id: "huid-guide", title: "HUID hallmarking guide", prompt: "गोल्ड हॉलमार्किंग में HUID क्या है?" },
  { id: "cement-labs", title: "Cement labs near Gujarat", prompt: "Which labs near Gujarat can test cement?" },
  { id: "is-456", title: "IS 456 concrete scope", prompt: "What does IS 456 cover?" },
];

export const RECENT_DOCUMENTS: RecentDocument[] = [
  { id: "isi-license-electronics", title: "ISI License - Electronics.pdf", uploadedAt: "18 May 2026", type: "PDF" },
  { id: "test-report-cement", title: "Test Report - Cement.pdf", uploadedAt: "12 May 2026", type: "PDF" },
  { id: "huid-verification-notes", title: "HUID Verification Notes.pdf", uploadedAt: "04 May 2026", type: "PDF" },
  { id: "led-compliance-checklist", title: "LED Compliance Checklist.pdf", uploadedAt: "27 Apr 2026", type: "PDF" },
];

const RECENT_CHAT_KEY = "bis-sahayak-recent-chat-selection";
const RECENT_CHAT_EVENT = "bis-sahayak-recent-chat-selected";

export function selectRecentChat(prompt: string) {
  window.sessionStorage.setItem(RECENT_CHAT_KEY, JSON.stringify({ prompt }));
  window.dispatchEvent(new Event(RECENT_CHAT_EVENT));
}

export function consumeRecentChat(): string | null {
  const raw = window.sessionStorage.getItem(RECENT_CHAT_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(RECENT_CHAT_KEY);
  try {
    return (JSON.parse(raw) as { prompt?: string }).prompt ?? null;
  } catch {
    return null;
  }
}

export { RECENT_CHAT_EVENT };
