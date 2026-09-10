/**
 * Shared chat state for the whole app.
 *
 * The full /chat page (ChatWindow) and the docked AssistantSidePanel both read
 * from this provider, so the conversation survives navigating between tabs —
 * ask something on /chat, switch to /wizard, and the assistant is still there
 * with the same history.
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
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

interface ChatContextValue {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  sendMessage: (text: string) => Promise<void>;
  resetChatHistory: () => Promise<void>;
  retryLast: () => void;
  hasConversation: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function now(): string {
  return new Date().toISOString();
}

async function persistMessageToSupabase(
  userId: string,
  role: "user" | "assistant",
  content: string,
  sources: any[] = [],
  sessionId: string | null = null
) {
  if (!supabase || !hasSupabaseConfig) return;

  const payload = {
    user_id: userId,
    role,
    content,
    sources: sources ?? [],
    session_id: sessionId,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("chat_messages").insert(payload);
  if (error) console.error("Supabase chat insert failed:", error.message);
}

async function loadChatHistoryFromSupabase(userId: string): Promise<Message[]> {
  if (!supabase || !hasSupabaseConfig) return INITIAL_MESSAGES;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, sources, created_at, session_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) return INITIAL_MESSAGES;

  return data.map((row: any) => ({
    id: String(row.id),
    role: row.role,
    content: row.content,
    sources: Array.isArray(row.sources) ? row.sources : [],
    timestamp: row.created_at ?? now(),
  }));
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      if (!user?.id) {
        setMessages(INITIAL_MESSAGES);
        return;
      }

      const history = await loadChatHistoryFromSupabase(user.id);
      setMessages(history.length ? history : INITIAL_MESSAGES);
    };

    void hydrate();
  }, [user?.id]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setInput("");

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: now(),
      };

      setMessages((prev) => [...prev, userMsg]);

      if (user?.id && supabase) {
        void persistMessageToSupabase(user.id, "user", trimmed, [], sessionId);
      }

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

        if (user?.id && supabase) {
          void persistMessageToSupabase(
            user.id,
            "assistant",
            response.answer,
            response.sources ?? [],
            response.session_id ?? sessionId
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId, user?.id]
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

  const retryLast = useCallback(() => {
    setError(null);
    const last = messages.findLast((m) => m.role === "user");
    if (last) void sendMessage(last.content);
  }, [messages, sendMessage]);

  const resetChatHistory = useCallback(async () => {
    if (isLoading) return;

    setError(null);

    if (user?.id && supabase && hasSupabaseConfig) {
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        setError(`Could not reset chat history: ${deleteError.message}`);
        return;
      }
    }

    setMessages(INITIAL_MESSAGES);
    setSessionId(null);
    setInput("");
  }, [isLoading, user?.id]);

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      input,
      setInput,
      isLoading,
      error,
      clearError: () => setError(null),
      sendMessage,
      resetChatHistory,
      retryLast,
      hasConversation: messages.length > 1,
    }),
    [error, input, isLoading, messages, resetChatHistory, retryLast, sendMessage]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
