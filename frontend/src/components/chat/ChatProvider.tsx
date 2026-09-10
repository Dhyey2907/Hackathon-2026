/**
 * Shared chat state for the whole app.
 *
 * The full /chat page (ChatWindow) and the docked AssistantSidePanel both read
 * from this provider, so the conversation survives navigating between tabs —
 * ask something on /chat, switch to /wizard, and the assistant is still there
 * with the same history.
 *
 * Networking behaviour is unchanged: same mock/real switch, same /chat endpoint.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Message } from "@/lib/types";
import { INITIAL_MESSAGES, mockSendMessage } from "@/lib/mock";
import { getMockChatNavigation } from "@/lib/chat-navigation";
import { consumeRecentChat, RECENT_CHAT_EVENT } from "@/lib/recents";

interface ChatContextValue {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  sendMessage: (text: string) => Promise<void>;
  retryLast: () => void;
  /** True once the user has exchanged at least one message. */
  hasConversation: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function now(): string {
  return new Date().toISOString();
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Recents deep-link: a chat picked from the sidebar is replayed here, so it
  // works from any route now — not only while /chat is mounted.
  useEffect(() => {
    const loadRecentChat = () => {
      const prompt = consumeRecentChat();
      if (prompt) window.setTimeout(() => void sendMessage(prompt), 0);
    };
    loadRecentChat();
    window.addEventListener(RECENT_CHAT_EVENT, loadRecentChat);
    return () => window.removeEventListener(RECENT_CHAT_EVENT, loadRecentChat);
  }, [sendMessage]);

  const retryLast = useCallback(() => {
    setError(null);
    const last = messages.findLast((m) => m.role === "user");
    if (last) void sendMessage(last.content);
  }, [messages, sendMessage]);

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      input,
      setInput,
      isLoading,
      error,
      clearError: () => setError(null),
      sendMessage,
      retryLast,
      hasConversation: messages.length > 1,
    }),
    [error, input, isLoading, messages, retryLast, sendMessage]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
