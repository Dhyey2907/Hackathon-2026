/**
 * Main stateful chat window (the /chat route).
 *
 * Message state, sending and the recents deep-link now live in ChatProvider so
 * the same conversation is shared with the docked AssistantSidePanel. This
 * component owns the presentation:
 * - Message list rendering
 * - Typing indicator
 * - Auto-scroll to latest message
 * - Example question quick-starters
 * - AI Ambient Intelligence blur (Idle: 8px, Thinking: 14px, Answered: 0px)
 */

"use client";

import { useRef, useEffect, useId } from "react";
import { useChat } from "./ChatProvider";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatOpeningState from "./ChatOpeningState";
import FollowUpSuggestions from "./FollowUpSuggestions";
import ChatInput from "./ChatInput";

// ---------------------------------------------------------------------------
// AI Ambient Intelligence blur constants
// ---------------------------------------------------------------------------

/** Background is atmospheric and blurred while chat is idle / before first message. */
const BLUR_IDLE = 8;
/** Blur increases to "deep search" mode while the AI is thinking. */
const BLUR_THINKING = 14;
/** Background snaps to crystal clarity when the AI delivers its answer. */
const BLUR_ANSWERED = 0;

// ---------------------------------------------------------------------------
// Example questions (shown on empty state, always 4-5 per spec)
// ---------------------------------------------------------------------------

const EXAMPLE_QUESTIONS = [
  "I manufacture LED bulbs. Which BIS standards apply and what licence do I need?",
  "गोल्ड हॉलमार्किंग में HUID क्या है?",
  "Which labs near Gujarat can test cement?",
  "What does IS 456 cover?",
] as const;

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
    retryLast,
    hasConversation,
  } = useChat();

  const bottomRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const listLabelId = useId();

  // Auto-scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
    <div className="flex h-full flex-col">
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
            {blurStateLabel === "thinking" ? "Deep Search" : "Ambient"}
          </span>
        </div>
      )}

      {hasConversation && (
        <div className="flex shrink-0 justify-end px-4 pt-2 sm:px-6">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset this chat history? This cannot be undone.")) {
                void resetChatHistory();
              }
            }}
            disabled={isLoading}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset chat history
          </button>
        </div>
      )}

      {/* ── Message list ────────────────────────────────────────────────── */}
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        aria-label="Conversation"
        aria-labelledby={listLabelId}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <span id={listLabelId} className="sr-only">
          Chat messages
        </span>

        <div className="mx-auto max-w-2xl space-y-6">
          {/*
            Sits above the greeting rather than replacing the composer: the
            user can answer it, ignore it, or ask something else entirely.
          */}
          {!hasConversation && <ChatOpeningState />}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

          {/* Where the conversation could go next, from this user's context. */}
          <FollowUpSuggestions />

          {/* Example questions */}
          {showExamples && (
            <div className="mt-2">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                Try asking
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXAMPLE_QUESTIONS.map((q) => (
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
                <p className="font-medium">Request failed</p>
                <p className="text-red-700">{error}</p>
              </div>
              <button
                onClick={retryLast}
                className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Retry
              </button>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-2xl px-0 sm:px-0">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => sendMessage(input)}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
