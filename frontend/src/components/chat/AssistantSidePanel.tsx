/**
 * Docked AI assistant panel.
 *
 * Shown on every app route except /chat itself (where the full-width
 * ChatWindow already is the assistant). It reads the same ChatProvider state,
 * so switching tabs — Home, Product Wizard, Standards, Labs — keeps the
 * conversation alive on the side instead of losing it.
 *
 * Collapsed it is a small floating launcher; expanded it is a fixed rail on
 * the right that the page content makes room for (see AppShell).
 */

"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useEffect, useRef } from "react";
import { useChat } from "./ChatProvider";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

/** Width of the expanded rail. Kept in sync with AppShell's content offset. */
export const ASSISTANT_PANEL_WIDTH = 380;

/** Short prompts offered when the side panel has no conversation yet. */
/** Dictionary keys: the prompts are offered, and sent, in the interface language. */
const QUICK_PROMPTS = ["side.q1", "side.q2", "side.q3"] as const;

interface AssistantSidePanelProps {
  open: boolean;
  onToggle: () => void;
}

export default function AssistantSidePanel({
  open,
  onToggle,
}: AssistantSidePanelProps) {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    sendMessage,
    retryLast,
    hasConversation,
  } = useChat();
  const { t } = useLanguage();
  // Same rule as the chat page: only the newest answer translates itself.
  const latestAnswerId = [...messages].reverse().find((m) => m.role === "assistant" && m.id !== "seed-1")?.id;

  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view while the panel is open
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, open]);

  // ── Collapsed: floating launcher ──────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={t("side.open")}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] shadow-lg backdrop-blur transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)]"
      >
        <SparkIcon />
        <span className="hidden sm:inline">{t("side.ask")}</span>
        {isLoading && (
          <span className="h-2 w-2 animate-ping rounded-full bg-[var(--color-powder-blue)]" />
        )}
      </button>
    );
  }

  // ── Expanded: docked rail ─────────────────────────────────────────────
  return (
    <aside
      aria-label={t("side.aria")}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
      style={{ width: ASSISTANT_PANEL_WIDTH }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <SparkIcon />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t("side.title")}</p>
          <p className="truncate text-[11px] text-[var(--color-text-muted)]">
            {isLoading ? t("side.thinking") : t("side.here")}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("side.close")}
          className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-4"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="space-y-4 text-sm">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} autoTranslate={msg.id === latestAnswerId} />
          ))}

          {isLoading && <TypingIndicator />}

          {!hasConversation && !isLoading && (
            <div className="pt-1">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {t("side.quick")}
                </p>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-navy-lighter)] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  FAQ
                </span>
              </div>

              <div className="space-y-2 rounded-[20px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-2">
                {QUICK_PROMPTS.map((key) => t(key)).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="group w-full rounded-[16px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-left transition-all duration-200 hover:border-[var(--color-powder-blue)] hover:bg-[var(--color-navy-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                        {t("side.help")}
                      </span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] text-[var(--color-text-muted)] transition-transform duration-200 group-hover:translate-x-0.5">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14" />
                          <path d="m13 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
                      {q}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              <p className="font-medium">{t("chat.requestFailed")}</p>
              <p className="mt-0.5 break-words text-red-700">{error}</p>
              <button
                type="button"
                onClick={retryLast}
                className="mt-2 rounded border border-red-300 bg-white px-2 py-1 font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {t("chat.retry")}
              </button>
            </div>
          )}

          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </div>

      {/* Compact composer */}
      <div className="shrink-0 p-3">
        <div className="flex items-end gap-2 rounded-[22px] border border-transparent bg-[rgba(255,255,255,0.02)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 focus-within:border-[rgba(176,196,222,0.28)] focus-within:bg-[rgba(255,255,255,0.04)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && input.trim()) sendMessage(input);
              }
            }}
            disabled={isLoading}
            rows={1}
            aria-label={t("side.message")}
            placeholder={t("side.placeholder")}
            className="max-h-24 flex-1 resize-none bg-transparent text-sm leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            aria-label={t("chat.send")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3D2B1F] text-white shadow-[0_8px_20px_rgba(61,43,31,0.18)] transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function SparkIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-[var(--color-powder-blue)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.4 11l2.6 1-2.6 1-1.4 2.5L10.6 13 8 12l2.6-1L12 8.5Z" />
    </svg>
  );
}
