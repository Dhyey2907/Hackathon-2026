"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChatNavigation } from "@/lib/types";
import { consumeChatNavigationContext } from "@/lib/chat-navigation";

export default function AnsweredFromChatBanner() {
  const pathname = usePathname();
  const [navigation, setNavigation] = useState<ChatNavigation | null>(null);

  useEffect(() => {
    const contextTimer = window.setTimeout(() => {
      setNavigation(consumeChatNavigationContext(pathname));
    }, 0);
    return () => window.clearTimeout(contextTimer);
  }, [pathname]);

  if (!navigation) return null;
  return <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"><div className="mt-0.5 shrink-0 font-bold text-[var(--color-navy)]" aria-hidden="true">i</div><div className="min-w-0 flex-1"><p className="font-semibold">Answered from chat</p><p className="mt-0.5 text-xs text-blue-800">Sources: {navigation.sources.map((source) => source.is_number || source.title || source.marker).join("; ")}</p></div><button type="button" onClick={() => setNavigation(null)} className="rounded px-1 text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Dismiss chat source context">×</button></div>;
}