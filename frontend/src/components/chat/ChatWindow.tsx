/**
 * Main stateful chat window (the /chat route).
 *
 * Message state, sending and the recents deep-link now live in ChatProvider so
 * the same conversation is shared with the docked AssistantSidePanel. This
 * component owns the presentation:
 * - Message list rendering
 * - Typing indicator
 * - The reading-first scroll rule (see below)
 * - Example question quick-starters
 * - AI Ambient Intelligence blur (Idle: 8px, Thinking: 14px, Answered: 0px)
 *
 * Scroll behaviour: the view never moves on its own. It used to jump to the
 * bottom on every change to `messages` or `isLoading` - about three times per
 * send - which meant a long answer dropped you at its last line, past
 * everything you had not read. Now an answer that arrives off-screen raises a
 * "New answer" pill instead, and the pill scrolls to the *start* of that
 * answer, so reading always begins at the beginning.
 */

"use client";

import { useRef, useEffect, useId, useState } from "react";
import { useChat } from "./ChatProvider";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatOpeningState from "./ChatOpeningState";
import FollowUpSuggestions from "./FollowUpSuggestions";
import ChatInput, { type ComposerAttachment } from "./ChatInput";
import { extractDocument } from "@/lib/api";
import { useDocuments } from "@/components/documents/DocumentProvider";
import ChatContextPanel from "./ChatContextPanel";
import { useLanguage } from "@/components/i18n/LanguageProvider";

// ---------------------------------------------------------------------------
// AI Ambient Intelligence blur constants
// ---------------------------------------------------------------------------

/** Background is atmospheric and blurred while chat is idle / before first message. */
const BLUR_IDLE = 8;
/** Blur increases to "deep search" mode while the AI is thinking. */
const BLUR_THINKING = 14;
/** Background snaps to crystal clarity when the AI delivers its answer. */
const BLUR_ANSWERED = 0;

/** Breathing room above the answer the pill jumps to. */
const TOP_GUTTER_PX = 12;

/** Matches the backend's limit, so an oversized file fails before upload. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Example questions (shown on empty state, always 4-5 per spec)
// ---------------------------------------------------------------------------

// Dictionary keys: the examples are offered, and sent, in the interface language.
const EXAMPLE_QUESTIONS = ["chat.ex1", "chat.ex2", "chat.ex3", "chat.ex4"] as const;

// ---------------------------------------------------------------------------
// ChatWindow
// ---------------------------------------------------------------------------

export default function ChatWindow() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    sendMessage,
    resetChatHistory,
    conversations,
    startNewChat,
    retryLast,
    hasConversation,
  } = useChat();

  const { t } = useLanguage();
  const { addDocument } = useDocuments();
  const bottomRef = useRef<HTMLDivElement>(null);

  // A document waiting to go with the next message, and its extracted text.
  // Reset asks in the page rather than through the browser's confirm dialog, which some
  // embedded browsers suppress - the click then did nothing at all.
  const [confirmingReset, setConfirmingReset] = useState(false);

  const [attachment, setAttachment] = useState<(ComposerAttachment & { text?: string }) | null>(null);
  // Bumped on every attach and removal, so a slow read that finishes after the
  // user removed the file - or picked another - cannot bring it back.
  const attachToken = useRef(0);

  async function attach(file: File) {
    const token = ++attachToken.current;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment({ name: file.name, status: "error", message: t("attach.tooLarge") });
      return;
    }
    setAttachment({ name: file.name, status: "reading" });
    // Kept in the document vault as well, so it can be found after the chat
    // has moved on.
    addDocument(file, "Other");
    try {
      const result = await extractDocument(file);
      if (token !== attachToken.current) return;
      setAttachment(
        result.readable
          ? { name: file.name, status: "ready", text: result.text, truncated: result.truncated }
          : { name: file.name, status: "error", message: result.message ?? t("attach.failed") }
      );
    } catch {
      if (token === attachToken.current) {
        setAttachment({ name: file.name, status: "error", message: t("attach.failed") });
      }
    }
  }

  function removeAttachment() {
    attachToken.current += 1;
    setAttachment(null);
  }

  function send() {
    const ready =
      attachment?.status === "ready" && attachment.text
        ? { name: attachment.name, text: attachment.text }
        : undefined;
    const question = input.trim() || (ready ? t("attach.defaultQuestion") : "");
    if (!question) return;
    void sendMessage(question, ready);
    removeAttachment();
  }
  const messageListRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const listLabelId = useId();

  // Which element actually scrolls depends on the breakpoint: from lg up the
  // conversation and the context panel are side-by-side and each scrolls
  // itself; below that the whole thing is one column in a single scroller.
  const [isWide, setIsWide] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  /** The newest answer the reader has already been shown the end of. */
  const [seenId, setSeenId] = useState<string | null>(null);

  const lastMessage = messages[messages.length - 1];
  const latestAnswerId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  // Read by the observer callback, which outlives the render that created it.
  // Synced in an effect rather than written during render, which the React
  // Compiler rightly rejects.
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    lastIdRef.current = lastMessage?.id ?? null;
  }, [lastMessage?.id]);

  // Derived, not stored: an answer is unread when it is the latest message,
  // the reader is not at the end, and they have not dismissed it. Deriving it
  // means scrolling to the bottom retires the pill on its own, with no effect
  // watching state to correct other state.
  const hasUnread =
    !atBottom && lastMessage?.role === "assistant" && lastMessage.id !== seenId;

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWide(wide.matches);
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  // Watch the end-of-list sentinel to know whether the reader is at the
  // bottom. This replaces the old auto-scroll: nothing moves the view, we
  // only observe where it already is.
  useEffect(() => {
    const sentinel = bottomRef.current;
    const root = isWide ? messageListRef.current : outerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setAtBottom(entry.isIntersecting);
        // Reaching the end is itself an acknowledgement.
        if (entry.isIntersecting) setSeenId(lastIdRef.current);
      },
      { root, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isWide]);

  function goToUnread() {
    if (!lastMessage) return;
    const target = document.getElementById(`msg-${lastMessage.id}`);
    const scroller = isWide ? messageListRef.current : outerRef.current;
    setSeenId(lastMessage.id);
    if (!target || !scroller) return;

    // Scroll the container explicitly rather than letting scrollIntoView walk
    // the ancestors. Which element scrolls changes with the breakpoint here,
    // and letting the browser decide made the jump silently do nothing.
    const offset =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      TOP_GUTTER_PX;

    // Reduced motion has to be checked here, not left to CSS: the global
    // `scroll-behavior: auto !important` rule does not apply to a behavior
    // passed as a JS argument, which would still animate.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The answer's first line, not its last: the point is to start reading.
    scroller.scrollTo({ top: offset, behavior: reduced ? "auto" : "smooth" });
  }

  // ---------------------------------------------------------------------------
  // AI Ambient Intelligence blur
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let blur: number;
    if (isLoading) {
      blur = BLUR_THINKING; // AI is thinking → deep search atmosphere
    } else if (hasConversation) {
      blur = BLUR_ANSWERED; // Answer delivered → crystal clarity
    } else {
      blur = BLUR_IDLE; // Idle / no messages yet → atmospheric
    }

    document.documentElement.style.setProperty("--current-blur", `${blur}px`);
  }, [hasConversation, isLoading]);

  // Reset blur to route default when leaving this component
  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--current-blur", "8px");
    };
  }, []);

  const handleExampleClick = (question: string) => {
    setInput(question);
    sendMessage(question);
  };

  // Show example starters only when there's just the initial greeting
  const showExamples = messages.length === 1 && !isLoading;

  // Derive blur state label for the ambient indicator
  const blurStateLabel = isLoading
    ? "thinking"
    : hasConversation
    ? "focused"
    : "ambient";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Below lg this is the one scroller and the panel stacks under the
          conversation; from lg up it becomes two columns that scroll
          independently. The composer sits outside it either way, so it stays
          pinned to the bottom of the screen. */}
      <div
        ref={outerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none] lg:flex-row lg:overflow-hidden"
      >
        {/* Conversation column */}
        <div className="relative flex min-w-0 flex-1 flex-col lg:h-full lg:min-h-0">
      {/* ── Ambient Intelligence state indicator ─────────────────────────────
          A subtle pill that signals the current blur/intelligence state.
          Fades out once a conversation is in progress.                       */}
      {!hasConversation && (
        <div
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 transition-all duration-500"
          aria-hidden="true"
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-all duration-500 ${
              blurStateLabel === "thinking"
                ? "bg-[var(--color-powder-blue-light)] text-[var(--color-powder-blue)]"
                : "bg-[var(--color-navy-lighter)] text-[var(--color-text-muted)]"
            }`}
          >
            {/* Animated dot */}
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                blurStateLabel === "thinking"
                  ? "animate-ping bg-[var(--color-powder-blue)]"
                  : "bg-[var(--color-text-muted)]"
              }`}
            />
            {blurStateLabel === "thinking" ? t("chat.deepSearch") : t("chat.ambient")}
          </span>
        </div>
      )}

      {(hasConversation || conversations.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 pt-2 sm:px-6">
          {confirmingReset ? (
            <div
              role="alertdialog"
              aria-label={t("chat.reset")}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs"
            >
              <span className="text-[var(--color-text-primary)]">{t("chat.resetConfirm")}</span>
              <button
                type="button"
                onClick={async () => {
                  await resetChatHistory();
                  setConfirmingReset(false);
                }}
                disabled={isLoading}
                className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("chat.resetYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="rounded-md px-2 py-1 font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
              >
                {t("chat.cancel")}
              </button>
            </div>
          ) : (
            <>
              {hasConversation && (
                <button
                  type="button"
                  onClick={startNewChat}
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-navy)] transition-colors hover:bg-[var(--color-navy-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
                >
                  + {t("chat.newChat")}
                </button>
              )}
              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  disabled={isLoading}
                  className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("chat.reset")}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Message list ────────────────────────────────────────────────── */}
      {/* overflow-anchor:none - the ambient pill and the examples block both
          unmount mid-conversation, and Chrome's scroll anchoring would nudge
          scrollTop to compensate. Frozen has to mean frozen. */}
      <div
        ref={messageListRef}
        className="flex-1 px-4 py-6 [overflow-anchor:none] sm:px-6 lg:min-h-0 lg:overflow-y-auto"
        aria-label={t("chat.conversation")}
        aria-labelledby={listLabelId}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <span id={listLabelId} className="sr-only">
          {t("chat.messages")}
        </span>

        <div className="mx-auto max-w-2xl space-y-6">
          {/*
            Sits above the greeting rather than replacing the composer: the
            user can answer it, ignore it, or ask something else entirely.
          */}
          {!hasConversation && <ChatOpeningState />}

          {messages.map((msg) => (
            <div key={msg.id} id={`msg-${msg.id}`} className="scroll-mt-4">
              {/* Only the newest answer translates itself: doing it for every
                  bubble would fire a model call per message on first render. */}
              <MessageBubble message={msg} autoTranslate={msg.id === latestAnswerId} />
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

          {/* Where the conversation could go next, from this user's context. */}
          <FollowUpSuggestions />

          {/* Example questions */}
          {showExamples && (
            <div className="mt-2">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                {t("chat.tryAsking")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXAMPLE_QUESTIONS.map((key) => t(key)).map((q) => (
                  <button
                    key={q}
                    onClick={() => handleExampleClick(q)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error banner with retry */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              <div className="flex-1">
                <p className="font-medium">{t("chat.requestFailed")}</p>
                <p className="text-red-700">{error}</p>
              </div>
              <button
                onClick={retryLast}
                className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {t("chat.retry")}
              </button>
            </div>
          )}

          {/* Sentinel: tells us whether the reader is at the end.
              h-px is load-bearing - IntersectionObserver never fires for a
              target with an empty box, so a zero-height sentinel silently
              reports nothing and the unread pill never appears. */}
          <div ref={bottomRef} aria-hidden="true" className="h-px" />
        </div>
      </div>

      {/* Raised only when an answer landed off-screen. Scrolls to the
          answer's first line, never to the end of it. */}
      {hasUnread && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <button
            type="button"
            onClick={goToUnread}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[var(--color-navy)] px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[var(--color-navy-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] focus-visible:ring-offset-2"
          >
            {t("chat.newAnswer")}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
          </button>
        </div>
      )}

        </div>

        {/* Context cards. One instance: stacked beneath the conversation on
            narrow screens, docked beside it from lg up with its own scroller
            so reading the cards never moves the conversation. */}
        <aside
          aria-label={t("panel.label")}
          className="shrink-0 border-t border-[var(--color-border)] px-4 pb-8 pt-6 lg:h-full lg:w-[360px] lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[380px]"
        >
          <ChatContextPanel />
        </aside>
      </div>

      {/* ── Input bar. Outside both scrollers, so it never scrolls away. ─── */}
      <div className="mx-auto w-full max-w-2xl px-0 sm:px-0">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          disabled={isLoading}
          attachment={attachment}
          onAttach={(file) => void attach(file)}
          onRemoveAttachment={removeAttachment}
        />
      </div>
    </div>
  );
}
