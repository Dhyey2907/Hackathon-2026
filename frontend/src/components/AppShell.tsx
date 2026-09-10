"use client";

import { useState } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isOnboardingRoute = pathname === "/onboarding";

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isAuthRoute) router.replace("/login");
    if (user && isAuthRoute) router.replace("/chat");
    if (user?.isNewUser && !isOnboardingRoute) router.replace("/onboarding");
    if (user && !user.isNewUser && isOnboardingRoute) router.replace("/chat");
  }, [isAuthRoute, isLoading, isOnboardingRoute, router, user]);

  if (isLoading || (!user && !isAuthRoute) || (user && isAuthRoute) || (user?.isNewUser && !isOnboardingRoute) || (user && !user.isNewUser && isOnboardingRoute)) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]"><span className="text-sm text-[var(--color-text-muted)]">Loading BIS Sahayak...</span></div>;
  }

  if (isAuthRoute) return <>{children}</>;
  if (isOnboardingRoute) return <>{children}</>;
  return <div className="flex min-h-0 flex-1"><Navigation collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} /><div className={`min-w-0 flex-1 transition-[margin] duration-200 ${collapsed ? "ml-[72px]" : "ml-64"}`}>{children}</div></div>;
}
