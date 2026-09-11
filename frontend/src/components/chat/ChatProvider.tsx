/**
 * Shared chat state for the whole app.
 *
 * The full /chat page (ChatWindow) and the docked AssistantSidePanel both read
 * from this provider, so the conversation survives navigating between tabs —
 * ask something on /chat, switch to /wizard, and the assistant is still there
 * with the same history.
 *
 * Conversations. Every message is saved with the id of the conversation it
 * belongs to (`session_id`), generated here when a chat starts. It used to be
 * taken from the backend's reply, which arrived after the first message had
 * already been saved without one - so chats could not be told apart, and the
 * sidebar had to show a list of invented examples. Recents is now built from
 * what is actually stored, and kept live by Supabase Realtime.
 */

"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Message, ChatAttachment, BusinessContext } from "@/lib/types";
import { INITIAL_MESSAGES, mockSendMessage } from "@/lib/mock";
import { getMockChatNavigation } from "@/lib/chat-navigation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getContext } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

/** One conversation, as listed under Recents. */
export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatContextValue {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  /** `attachment` is text read from a document; sent once, with this message. */
  sendMessage: (text: string, attachment?: ChatAttachment) => Promise<void>;
  /** What the assistant has gathered about the user's business, or null. */
  businessContext: BusinessContext | null;
  /** True until we know enough to personalise; drives the onboarding state. */
  isNewUser: boolean;
  /** Next actions, regenerated after each answer. */
  suggestions: string[];
  /** Delete every conversation this user has. */
  resetChatHistory: () => Promise<void>;
  retryLast: () => void;
  hasConversation: boolean;
  /** The user's conversations, most recent first. */
  conversations: Conversation[];
  activeConversationId: string;
  startNewChat: () => void;
  openConversation: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Messages saved before conversations had ids, which could not be matched to
 * one, are grouped under this id. Continuing it keeps saving without an id, so
 * it stays one conversation.
 */
const LEGACY_CONVERSATION = "legacy";

/** Other tabs of this browser hear about a reset here. */
const BROADCAST = "bis-sahayak-chat";

type Row = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  sources: unknown;
  created_at: string;
  session_id: string | null;
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${generateId()}`;
}

function now(): string {
  return new Date().toISOString();
}

function titleFrom(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

function rowToMessage(row: Row): Message {
  return {
    id: `db-${row.id}`,
    role: row.role,
    content: row.content,
    sources: (Array.isArray(row.sources) ? row.sources : []) as Message["sources"],
    timestamp: row.created_at ?? now(),
  };
}

/** Add a message to the conversation list, keeping it newest first. */
function touchConversation(
  list: Conversation[],
  id: string,
  role: Message["role"],
  content: string,
  at: string,
): Conversation[] {
  const existing = list.find((c) => c.id === id);
  const updated: Conversation = existing
    ? {
        ...existing,
        updatedAt: at > existing.updatedAt ? at : existing.updatedAt,
        messageCount: existing.messageCount + 1,
        title: existing.title || (role === "user" ? titleFrom(content) : ""),
      }
    : { id, title: role === "user" ? titleFrom(content) : "", updatedAt: at, messageCount: 1 };
  return [updated, ...list.filter((c) => c.id !== id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Group stored rows into conversations.
 *
 * Rows saved before this change follow one pattern: the opening question has no
 * id and the answer carries the id the backend made up for it. Such a question
 * is joined to the conversation of the answer that follows it, so old chats
 * appear whole rather than as a question and an answer in separate entries.
 */
function groupConversations(rows: Row[]) {
  const bySession = new Map<string, Message[]>();
  let list: Conversation[] = [];

  rows.forEach((row, index) => {
    let id = row.session_id;
    if (!id && row.role === "user") {
      const next = rows[index + 1];
      if (next?.role === "assistant" && next.session_id) id = next.session_id;
    }
    const key = id ?? LEGACY_CONVERSATION;
    bySession.set(key, [...(bySession.get(key) ?? []), rowToMessage(row)]);
    list = touchConversation(list, key, row.role, row.content, row.created_at);
  });

  list = list.map((c) => ({ ...c, title: c.title || "Conversation" }));
  return { list, bySession };
}

async function loadRows(userId: string): Promise<Row[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, sources, created_at, session_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as Row[];
}

/**
 * Flatten the structured context into the short string the backend accepts.
 *
 * Only usable context is sent. A low-confidence guess would make the assistant
 * answer as though it knew something about the user that it does not.
 */
function businessContextToPrompt(context: BusinessContext | null): string | null {
  if (!context?.is_usable) return null;
  const parts: string[] = [];
  if (context.products.length) parts.push(`works with: ${context.products.join(", ")}`);
  if (context.role !== "unknown") parts.push(`role: ${context.role}`);
  if (context.industry) parts.push(`industry: ${context.industry}`);
  return parts.join("; ") || null;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  // Local accounts ("local-<email>") have no Supabase identity to save under.
  const accountId =
    supabase && hasSupabaseConfig && user?.id && !user.id.startsWith("local-") ? user.id : null;

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => newConversationId());

  // Read by callbacks that must not be rebuilt whenever the active chat
  // changes - the realtime handler above all. Written only in event handlers.
  const activeRef = useRef(activeConversationId);
  // Every loaded conversation's messages, so opening one needs no request.
  const cache = useRef(new Map<string, Message[]>());
  // Messages this tab wrote, so their realtime echo is not added twice.
  const ownWrites = useRef(new Set<string>());
  const broadcast = useRef<BroadcastChannel | null>(null);
  // The document sent with the latest message, kept for Retry.
  const lastAttachment = useRef<ChatAttachment | undefined>(undefined);
  // The language suggestions are asked for in. A ref, so refreshContext - and
  // every load that depends on it - does not change when the language does.
  const languageRef = useRef(language);

  /**
   * Ask the backend what it can tell about this user from their own history.
   *
   * Deliberately never throws: personalisation is an enhancement, and a user
   * whose context cannot be inferred simply sees the opening question instead
   * of a broken screen.
   */
  const refreshContext = useCallback(async (history: Message[], lastQuestion?: string) => {
    if (!process.env.NEXT_PUBLIC_API_URL) return;
    try {
      const result = await getContext(
        history.map((m) => ({ role: m.role, content: m.content })),
        lastQuestion,
        languageRef.current,
      );
      setBusinessContext(result.business_context);
      setIsNewUser(result.is_new_user);
      setSuggestions(result.suggestions);
    } catch {
      // Leave the onboarding state as it is.
    }
  }, []);

  // Suggestions and the business headline come back in the interface
  // language, so ask again when it changes - without reloading the
  // conversation the user is reading.
  useEffect(() => {
    if (languageRef.current === language) return;
    languageRef.current = language;
    void refreshContext(cache.current.get(activeRef.current) ?? []);
  }, [language, refreshContext]);

  const activate = useCallback((id: string, shown: Message[]) => {
    activeRef.current = id;
    setActiveConversationId(id);
    setMessages(shown.length ? shown : INITIAL_MESSAGES);
  }, []);

  const startNewChat = useCallback(() => {
    activate(newConversationId(), []);
    setInput("");
    setError(null);
    setSuggestions([]);
    lastAttachment.current = undefined;
  }, [activate]);

  const openConversation = useCallback(
    (id: string) => {
      activate(id, cache.current.get(id) ?? []);
      setInput("");
      setError(null);
      setSuggestions([]);
      lastAttachment.current = undefined;
    },
    [activate],
  );

  /** Replace everything from storage. Keeps the open chat unless it is gone. */
  const applyRows = useCallback(
    (rows: Row[], mode: "initial" | "resync") => {
      const { list, bySession } = groupConversations(rows);
      const hadActive = cache.current.has(activeRef.current);
      cache.current = bySession;
      setConversations(list);

      if (mode === "initial") {
        // Pick up where the user left off: their most recent conversation.
        const latest = list[0];
        if (latest) activate(latest.id, bySession.get(latest.id) ?? []);
        else activate(newConversationId(), []);
        const all = rows.map(rowToMessage).slice(-200);
        void refreshContext(all);
        return;
      }

      const active = bySession.get(activeRef.current);
      if (active) setMessages(active);
      else if (hadActive) activate(newConversationId(), []); // deleted elsewhere
    },
    [activate, refreshContext],
  );

  // Load this user's conversations.
  useEffect(() => {
    let live = true;
    (async () => {
      let rows: Row[] = [];
      if (accountId) {
        try {
          rows = await loadRows(accountId);
        } catch (err) {
          console.error("Could not load chat history:", err);
        }
      }
      if (live) applyRows(rows, "initial");
    })();
    return () => {
      live = false;
    };
  }, [accountId, applyRows]);

  /** A stored message this tab did not write: another tab, or another device. */
  const receive = useCallback((row: Row) => {
    const id = row.session_id ?? LEGACY_CONVERSATION;
    const key = `${id}|${row.role}|${row.content}`;
    if (ownWrites.current.delete(key)) return;
    const message = rowToMessage(row);
    cache.current.set(id, [...(cache.current.get(id) ?? []), message]);
    setConversations((list) => touchConversation(list, id, row.role, row.content, row.created_at));
    if (id === activeRef.current) setMessages((current) => [...current, message]);
  }, []);

  // Live updates from other tabs and devices. Row-level security applies to the
  // stream too, so only this user's messages arrive.
  useEffect(() => {
    if (!accountId || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`chat-messages-${accountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${accountId}` },
        (payload) => receive(payload.new as Row),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [accountId, receive]);

  // Realtime carries inserts, not deletions, so a reset made on another device
  // is picked up by re-reading when this tab comes back into view.
  useEffect(() => {
    if (!accountId) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadRows(accountId)
        .then((rows) => applyRows(rows, "resync"))
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [accountId, applyRows]);

  // A reset in another tab of this browser clears this one straight away.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(BROADCAST);
    broadcast.current = channel;
    const owner = accountId ?? "local";
    channel.onmessage = (event: MessageEvent<{ type?: string; owner?: string }>) => {
      if (event.data?.type !== "reset" || event.data.owner !== owner) return;
      cache.current = new Map();
      setConversations([]);
      startNewChat();
    };
    return () => {
      channel.close();
      broadcast.current = null;
    };
  }, [accountId, startNewChat]);

  /** Show a message in its conversation and save it. */
  const record = useCallback(
    (conversationId: string, message: Message) => {
      cache.current.set(conversationId, [...(cache.current.get(conversationId) ?? []), message]);
      setConversations((list) =>
        touchConversation(list, conversationId, message.role, message.content, message.timestamp),
      );
      if (!accountId || !supabase) return;

      const key = `${conversationId}|${message.role}|${message.content}`;
      ownWrites.current.add(key);
      void supabase
        .from("chat_messages")
        .insert({
          user_id: accountId,
          role: message.role,
          content: message.content,
          sources: message.sources ?? [],
          session_id: conversationId === LEGACY_CONVERSATION ? null : conversationId,
          created_at: message.timestamp,
        })
        .then(({ error: insertError }) => {
          if (insertError) {
            ownWrites.current.delete(key);
            console.error("Supabase chat insert failed:", insertError.message);
          }
        });
    },
    [accountId],
  );

  const sendMessage = useCallback(
    async (text: string, attachment?: ChatAttachment) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      // The conversation this question belongs to. If the user opens another
      // chat while it is being answered, the answer still lands here.
      const conversationId = activeRef.current;

      setError(null);
      setInput("");

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        ...(attachment ? { attachmentName: attachment.name } : {}),
        timestamp: now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      record(conversationId, userMsg);
      lastAttachment.current = attachment;

      setIsLoading(true);

      try {
        const useMock =
          process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
          !process.env.NEXT_PUBLIC_API_URL;

        let response;

        if (useMock) {
          response = await mockSendMessage({
            message: trimmed,
            session_id: conversationId,
            language: "auto",
          });
        } else {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(`${apiUrl}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              session_id: conversationId,
              language: "auto",
              // Lets the assistant read "my product" without the user having
              // to restate their business every turn. The backend treats this
              // as context for interpreting the question, never as evidence.
              user_context: businessContextToPrompt(businessContext),
              // Read as the user's own material, never cited as a source.
              attachment: attachment ?? null,
            }),
          });
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`${res.status}: ${body.slice(0, 200)}`);
          }
          response = await res.json();
        }

        const assistantMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: response.answer,
          sources: response.sources ?? [],
          abstained: response.abstained ?? false,
          intent: response.intent,
          latency_ms: response.latency_ms,
          // Carried through rather than dropped: the context cards read these,
          // and a warning the backend already computed is worth surfacing.
          structured: response.structured,
          warnings: response.warnings,
          timestamp: now(),
          navigation: getMockChatNavigation(response.sources ?? []),
        };

        record(conversationId, assistantMsg);
        if (activeRef.current === conversationId) {
          setMessages((prev) => [...prev, assistantMsg]);
          // Re-read context from the conversation including this turn, so a
          // business mentioned just now takes effect immediately and a
          // correction ("I only sell them") is picked up straight away.
          void refreshContext(cache.current.get(conversationId) ?? [], trimmed);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [businessContext, isLoading, record, refreshContext],
  );

  const retryLast = useCallback(() => {
    setError(null);
    const last = messages.findLast((m) => m.role === "user");
    // The composer clears the attachment on send, so a retry after a failed
    // request would otherwise re-ask the question without the document.
    if (last) void sendMessage(last.content, last.attachmentName ? lastAttachment.current : undefined);
  }, [messages, sendMessage]);

  const resetChatHistory = useCallback(async () => {
    if (isLoading) return;
    setError(null);

    if (accountId && supabase) {
      const { error: deleteError } = await supabase.from("chat_messages").delete().eq("user_id", accountId);
      if (deleteError) {
        setError(`Could not reset chat history: ${deleteError.message}`);
        return;
      }
    }

    cache.current = new Map();
    setConversations([]);
    startNewChat();
    broadcast.current?.postMessage({ type: "reset", owner: accountId ?? "local" });
  }, [accountId, isLoading, startNewChat]);

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
      businessContext,
      isNewUser,
      suggestions,
      conversations,
      activeConversationId,
      startNewChat,
      openConversation,
    }),
    [
      activeConversationId,
      businessContext,
      conversations,
      error,
      input,
      isLoading,
      isNewUser,
      messages,
      openConversation,
      resetChatHistory,
      retryLast,
      sendMessage,
      startNewChat,
      suggestions,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
