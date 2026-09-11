"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getExpiryStatus, useDocuments } from "@/components/documents/DocumentProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import LanguageToggle from "@/components/i18n/LanguageToggle";

const NAV_LINKS = [
  { href: "/", labelKey: "nav.home", icon: "home" },
  { href: "/chat", labelKey: "nav.chat", icon: "chat" },
  { href: "/wizard", labelKey: "nav.wizard", icon: "wizard" },
  { href: "/standards", labelKey: "nav.standards", icon: "standards" },
  { href: "/updates", labelKey: "nav.updates", icon: "standards" },
  { href: "/labs", labelKey: "nav.labs", icon: "labs" },
  { href: "/verify", labelKey: "nav.verify", icon: "verify" },
  { href: "/roadmap", labelKey: "nav.roadmap", icon: "roadmap" },
  { href: "/documents", labelKey: "nav.documents", icon: "documents" },
] as const;

type NavigationProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};
type IconName = (typeof NAV_LINKS)[number]["icon"];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-4-.9L4 20l1.5-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    wizard: <><path d="M8 4h8l-1 1v5.2a2 2 0 0 0 .6 1.4l4.8 4.8a2 2 0 0 1-1.4 3.4H4.8a2 2 0 0 1-1.4-3.4l4.8-4.8a2 2 0 0 0 .6-1.4V5L8 4Z" /><path d="M7 16h10" /></>,
    standards: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /></>,
    labs: <><path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" /><path d="M8 15h8" /></>,
    verify: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    documents: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4" /><path d="M9 12h6M9 16h4" /></>,
    roadmap: <><path d="m3 6 2 2 3-3" /><path d="m3 13 2 2 3-3" /><path d="m3 20 2 2 3-3" /><path d="M12 6h9M12 14h9M12 21h6" /></>,
  };
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/** Small colored dot shown next to document names in the sidebar Recents section. */
function ExpiryDot({ expiryDate }: { expiryDate?: string }) {
  const { status } = getExpiryStatus(expiryDate);
  if (status === "expired") {
    return <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-500" title="Expired" aria-label="Expired" />;
  }
  if (status === "expiring-soon") {
    return <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Expiring soon" aria-label="Expiring soon" />;
  }
  return null;
}

export default function Navigation({ collapsed, onToggle, mobileOpen, onMobileClose }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { documents } = useDocuments();
  const { conversations, activeConversationId, startNewChat, openConversation } = useChat();
  const [showAllChats, setShowAllChats] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const { t } = useLanguage();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-[#071018]/45 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-[transform,width] duration-200 lg:z-40 ${
          collapsed ? "w-[72px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
      {/* Logo / brand */}
      <div
        className={`flex h-20 shrink-0 items-center border-b border-[var(--color-border)] ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <Link
          href="/"
          className={`flex min-w-0 items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${collapsed ? "justify-center" : ""}`}
          aria-label="BIS Sahayak home"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-navy)] text-white shadow-sm"
            aria-hidden="true"
          >
            <span className="text-[10px] font-bold tracking-tight">BIS</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight text-[var(--color-text-primary)]">{t("app.name")}</h1>
              <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-muted)]">{t("app.tagline")}</p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5 4 12l7 7M4 12h16" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)] lg:hidden"
          aria-label="Close navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* Primary nav + recents */}
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Primary navigation">
        <ul className="space-y-1.5">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? t(link.labelKey) : undefined}
                  onClick={onMobileClose}
                  className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:shadow-[0_4px_16px_rgba(123,169,194,0.25)] focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)] ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-[rgba(176,196,222,0.32)] text-[#3D2B1F] font-semibold shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[rgba(176,196,222,0.18)] hover:text-[#3D2B1F]"
                  }`}
                >
                  {/* Active vertical espresso-brown bar indicator */}
                  {isActive && (
                    <span
                      className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-dusty-rose)]"
                      aria-hidden="true"
                    />
                  )}
                  <NavIcon name={link.icon} />
                  {!collapsed && <span>{t(link.labelKey)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Language switch — above Recents so it is reachable without
            scrolling, and hidden when the rail is collapsed to icons. */}
        {!collapsed && (
          <div className="mt-4 px-2">
            <LanguageToggle className="w-full justify-center" />
          </div>
        )}

        {/* Recents section — hidden when sidebar is collapsed */}
        {!collapsed && (
          <section className="mt-6 border-t border-[var(--color-border)] pt-4" aria-label="Recents">
            <button
              type="button"
              onClick={() => setRecentsOpen((open) => !open)}
              aria-expanded={recentsOpen}
              className="flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
            >
              <span>{t("nav.recents")}</span>
              <svg
                className={`h-4 w-4 transition-transform ${recentsOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {recentsOpen && (
              <div className="mt-3 space-y-4">
                {/* Recent Chats - the user's own conversations, newest first */}
                <div>
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("nav.recentChats")}</p>
                    <button
                      type="button"
                      onClick={() => { startNewChat(); if (pathname !== "/chat") router.push("/chat"); }}
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-navy-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
                    >
                      + {t("chat.newChat")}
                    </button>
                  </div>
                  {conversations.length === 0 ? (
                    <p className="mt-1 px-2 py-1.5 text-xs text-[var(--color-text-muted)]">{t("nav.noChats")}</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {(showAllChats ? conversations : conversations.slice(0, 5)).map((chat) => {
                        const active = pathname === "/chat" && chat.id === activeConversationId;
                        return (
                          <li key={chat.id}>
                            <button
                              type="button"
                              onClick={() => { openConversation(chat.id); if (pathname !== "/chat") router.push("/chat"); }}
                              title={`${chat.title} · ${new Date(chat.updatedAt).toLocaleString()}`}
                              aria-current={active ? "true" : undefined}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${
                                active ? "bg-[var(--color-navy-lighter)] font-medium text-[var(--color-navy)]" : "text-[var(--color-text-secondary)]"
                              }`}
                            >
                              <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-4-.9L4 20l1.5-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
                              </svg>
                              <span className="truncate">{chat.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {conversations.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllChats((open) => !open)}
                      className="mt-1 block px-2 text-[11px] font-medium text-[var(--color-navy)] hover:underline"
                    >
                      {showAllChats ? t("nav.showLess") : `${t("nav.viewAll")} (${conversations.length})`}
                    </button>
                  )}
                </div>

                {/* Recent Documents — with expiry dot indicators */}
                <div>
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("nav.recentDocuments")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {documents.slice(0, 5).map((doc) => (
                      <li key={doc.id}>
                        <Link
                          href={`/documents/${doc.id}`}
                          title={`${doc.name} · ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)]"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M6 3h9l3 3v15H6zM15 3v4h4" />
                          </svg>
                          <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                          {/* Urgency dot: red = expired, amber = expiring soon */}
                          <ExpiryDot expiryDate={doc.expiryDate} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href="/documents" className="mt-1 block px-2 text-[11px] font-medium text-[var(--color-navy)] hover:underline">
                    {t("nav.viewAll")}
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}
      </nav>

      {/* Footer: user info + profile/settings/logout */}
      <div className="border-t border-[var(--color-border)] p-3">
        {!collapsed && (
          <div className="mb-2 truncate px-2 text-[11px] text-[var(--color-text-muted)]" title={user?.identifier}>
            {user?.name || user?.identifier}
          </div>
        )}
        <Link
          href="/profile"
          aria-current={pathname === "/profile" ? "page" : undefined}
          title={collapsed ? "Profile" : undefined}
          className={`mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${
            pathname === "/profile"
              ? "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]"
              : "text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-navy)] dark:hover:bg-gray-800"
          } ${collapsed ? "justify-center" : ""}`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="3" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
          {!collapsed && <span>{t("nav.profile")}</span>}
        </Link>
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          title={collapsed ? "Settings" : undefined}
          className={`mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${
            pathname === "/settings"
              ? "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]"
              : "text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-navy)] dark:hover:bg-gray-800"
          } ${collapsed ? "justify-center" : ""}`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
          {!collapsed && <span>{t("nav.settings")}</span>}
        </Link>
        <div className={`flex ${collapsed ? "justify-center" : "items-center justify-between"}`}>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className={`flex items-center gap-2 rounded-md p-2 text-xs font-medium text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${collapsed ? "justify-center" : ""}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9" />
            </svg>
            {!collapsed && <span>{t("nav.logout")}</span>}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
              <span>Mock Mode</span>
            </div>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mt-2 w-full rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
          >
            <svg className="mx-auto h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m13 5 7 7-7 7M20 12H4" />
            </svg>
          </button>
        )}
      </div>
      </aside>
    </>
  );
}
