"use client";

/**
 * The most recent assistant message, or null before one exists.
 *
 * The context cards describe the answer currently on screen, so they all need
 * the same message. Deriving it in one place keeps them from disagreeing about
 * which answer they are describing - a sources card showing one turn while the
 * certification card shows another would be worse than either being empty.
 */

import { useMemo } from "react";
import type { Message } from "@/lib/types";
import { useChat } from "../ChatProvider";

export function useLatestAnswer(): Message | null {
  const { messages } = useChat();

  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);
}
