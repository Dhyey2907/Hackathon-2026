"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RECENT_CHATS, RECENT_DOCUMENTS, selectRecentChat } from "@/lib/recents";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/chat", label: "Chat Assistant", icon: "chat" },
  { href: "/wizard", label: "Product Wizard", icon: "wizard" },
  { href: "/standards", label: "Standards", icon: "standards" },
  { href: "/labs", label: "Lab Finder", icon: "labs" },
  { href: "/verify", label: "Verify License", icon: "verify" },
] as const;

type NavigationProps = { collapsed: boolean; onToggle: () => void };

function NavIcon({ name }: { name: (typeof NAV_LINKS)[number]["icon"] }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-4-.9L4 20l1.5-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    wizard: <><path d="M8 4h8l-1 1v5.2a2 2 0 0 0 .6 1.4l4.8 4.8a2 2 0 0 1-1.4 3.4H4.8a2 2 0 0 1-1.4-3.4l4.8-4.8a2 2 0 0 0 .6-1.4V5L8 4Z" /><path d="M7 16h10" /></>,
    standards: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /></>,
    labs: <><path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" /><path d="M8 15h8" /></>,
    verify: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  };
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Navigation({ collapsed, onToggle }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [recentsOpen, setRecentsOpen] = useState(true);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-64"}`}>
    <div className={`flex h-20 shrink-0 items-center border-b border-[var(--color-border)] ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
      <Link href="/" className={`flex min-w-0 items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${collapsed ? "justify-center" : ""}`} aria-label="BIS Sahayak home">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-white" aria-hidden="true"><span className="text-[10px] font-bold tracking-tight">BIS</span></div>
        {!collapsed && <div className="min-w-0"><h1 className="truncate text-sm font-semibold leading-tight text-[var(--color-text-primary)]">BIS Sahayak</h1><p className="mt-0.5 truncate text-[10px] text-[var(--color-text-muted)]">Bureau of Indian Standards</p></div>}
      </Link>
      {!collapsed && <button type="button" onClick={onToggle} className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]" aria-label="Collapse sidebar" title="Collapse sidebar"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5 4 12l7 7M4 12h16" /></svg></button>}
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Primary navigation"><ul className="space-y-1">{NAV_LINKS.map((link) => { const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href)); return <li key={link.href}><Link href={link.href} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${collapsed ? "justify-center" : ""} ${isActive ? "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]" : "text-[var(--color-text-secondary)] hover:bg-gray-100 hover:text-[var(--color-navy)] dark:hover:bg-gray-800"}`} aria-current={isActive ? "page" : undefined} title={collapsed ? link.label : undefined}><NavIcon name={link.icon} />{!collapsed && <span>{link.label}</span>}</Link></li>; })}</ul>
      {!collapsed && <section className="mt-6 border-t border-[var(--color-border)] pt-4" aria-label="Recents"><button type="button" onClick={() => setRecentsOpen((open) => !open)} className="flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]" aria-expanded={recentsOpen}><span>Recents</span><svg className={`h-4 w-4 transition-transform ${recentsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" /></svg></button>{recentsOpen && <div className="mt-3 space-y-4"><div><p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Recent Chats</p><ul className="mt-1 space-y-0.5">{RECENT_CHATS.slice(0, 5).map((chat) => <li key={chat.id}><button type="button" onClick={() => { selectRecentChat(chat.prompt); if (pathname !== "/chat") router.push("/chat"); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]" title={chat.title}><svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-4-.9L4 20l1.5-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /></svg><span className="truncate">{chat.title}</span></button></li>)}</ul><Link href="/chat" className="mt-1 block px-2 text-[11px] font-medium text-[var(--color-navy)] hover:underline">View all</Link></div><div><p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Recent Documents</p><ul className="mt-1 space-y-0.5">{RECENT_DOCUMENTS.slice(0, 5).map((document) => <li key={document.id}><Link href={`/documents/${document.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)]" title={`${document.title} · ${document.uploadedAt}`}><svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 3h9l3 3v15H6zM15 3v4h4" /></svg><span className="truncate">{document.title}</span></Link></li>)}</ul><Link href="/documents" className="mt-1 block px-2 text-[11px] font-medium text-[var(--color-navy)] hover:underline">View all</Link></div></div>}</section>}
    </nav>
    <div className="border-t border-[var(--color-border)] p-3">
      {!collapsed && <div className="mb-2 truncate px-2 text-[11px] text-[var(--color-text-muted)]" title={user?.identifier}>{user?.name || user?.identifier}</div>}
      <Link href="/profile" className={`mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${pathname === "/profile" ? "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]" : "text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-navy)] dark:hover:bg-gray-800"} ${collapsed ? "justify-center" : ""}`} aria-current={pathname === "/profile" ? "page" : undefined} title={collapsed ? "Profile" : undefined}><svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>{!collapsed && <span>Profile</span>}</Link>
      <Link href="/settings" className={`mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${pathname === "/settings" ? "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]" : "text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-navy)] dark:hover:bg-gray-800"} ${collapsed ? "justify-center" : ""}`} aria-current={pathname === "/settings" ? "page" : undefined} title={collapsed ? "Settings" : undefined}><svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="3.5" /></svg>{!collapsed && <span>Settings</span>}</Link>
      <div className={`flex ${collapsed ? "justify-center" : "items-center justify-between"}`}>
        <button type="button" onClick={handleLogout} className={`flex items-center gap-2 rounded-md p-2 text-xs font-medium text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] ${collapsed ? "justify-center" : ""}`} aria-label="Log out" title="Log out"><svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 4H5a2 2 0 0 0 2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9" /></svg>{!collapsed && <span>Log out</span>}</button>
        {!collapsed && <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]"><span className="h-2 w-2 rounded-full bg-green-400" aria-hidden="true" /><span>Mock Mode</span></div>}
      </div>
      {collapsed && <button type="button" onClick={onToggle} className="mt-2 w-full rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]" aria-label="Expand sidebar" title="Expand sidebar"><svg className="mx-auto h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m13 5 7 7-7 7M20 12H4" /></svg></button>}
    </div>
  </aside>;
}
