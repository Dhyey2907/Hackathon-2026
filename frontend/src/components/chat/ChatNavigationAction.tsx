"use client";

import { useRouter } from "next/navigation";
import type { ChatNavigation } from "@/lib/types";
import { saveChatNavigationContext } from "@/lib/chat-navigation";

export default function ChatNavigationAction({ navigation }: { navigation: ChatNavigation }) {
  const router = useRouter();
  function navigate() {
    saveChatNavigationContext(navigation);
    router.push(navigation.href);
  }
  return <button type="button" onClick={navigate} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-navy)]/20 bg-[var(--color-navy-lighter)] px-3 py-2 text-xs font-semibold text-[var(--color-navy)] transition-colors hover:bg-[var(--color-navy)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-1">{navigation.label}<span aria-hidden="true">→</span></button>;
}