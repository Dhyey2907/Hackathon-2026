"use client";

import { useState } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import AssistantSidePanel from "@/components/chat/AssistantSidePanel";
import { useAuth } from "@/components/auth/AuthProvider";

const ASSISTANT_OPEN_KEY = "bis-sahayak-assistant-open";

// Tiny external store so the persisted open/closed state can be read without a
// setState-in-effect, and stays server-safe (closed during SSR/hydration).
const assistantStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    assistantStore.listeners.add(listener);
    return () => assistantStore.listeners.delete(listener);
  },
  getSnapshot() {
    return localStorage.getItem(ASSISTANT_OPEN_KEY) === "true";
  },
  getServerSnapshot() {
    return false;
  },
  set(open: boolean) {
    localStorage.setItem(ASSISTANT_OPEN_KEY, String(open));
    assistantStore.listeners.forEach((listener) => listener());
  },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const assistantOpen = useSyncExternalStore(
    assistantStore.subscribe,
    assistantStore.getSnapshot,
    assistantStore.getServerSnapshot
  );
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isOnboardingRoute = pathname === "/onboarding";
  // On /chat the assistant *is* the page, so the side rail stands down.
  const showAssistant = !isAuthRoute && !isOnboardingRoute && pathname !== "/chat";

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isAuthRoute) router.replace("/login");
    if (user && isAuthRoute) router.replace("/chat");
    if (user?.isNewUser && !isOnboardingRoute) router.replace("/onboarding");
    if (user && !user.isNewUser && isOnboardingRoute) router.replace("/chat");
  }, [isAuthRoute, isLoading, isOnboardingRoute, router, user]);

  function toggleAssistant() {
    assistantStore.set(!assistantOpen);
  }

  if (isLoading || (!user && !isAuthRoute) || (user && isAuthRoute) || (user?.isNewUser && !isOnboardingRoute) || (user && !user.isNewUser && isOnboardingRoute)) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]"><span className="text-sm text-[var(--color-text-muted)]">Loading BIS Sahayak...</span></div>;
  }

  if (isAuthRoute) return <>{children}</>;
  if (isOnboardingRoute) return <>{children}</>;

  const assistantDocked = showAssistant && assistantOpen;

  return (
    <div className="flex min-h-0 flex-1">
      <Navigation collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />
      <div
        className={`min-w-0 flex-1 transition-[margin] duration-200 ${collapsed ? "ml-[72px]" : "ml-64"} ${assistantDocked ? "lg:mr-[380px]" : ""}`}
      >
        {children}
      </div>
      {showAssistant && <AssistantSidePanel open={assistantOpen} onToggle={toggleAssistant} />}
    </div>
  );
}
