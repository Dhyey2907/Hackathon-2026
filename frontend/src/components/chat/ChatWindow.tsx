/**
 * Main stateful chat window.
 *
 * Manages:
 * - Message list state
 * - Input state
 * - Sending (calls mock or real API based on NEXT_PUBLIC_USE_MOCK)
 * - Typing indicator
 * - Auto-scroll to latest message
 * - Example question quick-starters
 */

"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import type { Message } from "@/lib/types";
import { INITIAL_MESSAGES, mockSendMessage } from "@/lib/mock";
import { getMockChatNavigation } from "@/lib/chat-navigation";
import { consumeRecentChat, RECENT_CHAT_EVENT } from "@/lib/recents";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";

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
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// ChatWindow
// ---------------------------------------------------------------------------

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const listLabelId = useId();

  // Auto-scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setInput("");

      // Optimistically add user message
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const useMock =
          process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
          !process.env.NEXT_PUBLIC_API_URL;

        let response;

        if (useMock) {
          response = await mockSendMessage({
            message: trimmed,
            session_id: sessionId,
            language: "auto",
          });
        } else {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(`${apiUrl}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              session_id: sessionId,
              language: "auto",
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`${res.status}: ${text.slice(0, 200)}`);
          }
          response = await res.json();
        }

        if (response.session_id && !sessionId) {
          setSessionId(response.session_id);
        }

        const assistantMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: response.answer,
          sources: response.sources ?? [],
          abstained: response.abstained ?? false,
          intent: response.intent,
          latency_ms: response.latency_ms,
          timestamp: now(),
          navigation: getMockChatNavigation(response.sources ?? []),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(msg);
        // Don't add a fake error message — show a retry banner instead
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId]
  );

  useEffect(() => {
    const loadRecentChat = () => {
      const prompt = consumeRecentChat();
      if (prompt) window.setTimeout(() => void sendMessage(prompt), 0);
    };
    loadRecentChat();
    window.addEventListener(RECENT_CHAT_EVENT, loadRecentChat);
    return () => window.removeEventListener(RECENT_CHAT_EVENT, loadRecentChat);
  }, [sendMessage]);

  const handleExampleClick = (question: string) => {
    setInput(question);
    sendMessage(question);
  };

  // Show example starters only when there's just the initial greeting
  const showExamples = messages.length === 1 && !isLoading;

  return (
    <div className="flex h-full flex-col">
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
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

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
                onClick={() => {
                  setError(null);
                  const last = messages.findLast((m) => m.role === "user");
                  if (last) sendMessage(last.content);
                }}
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
