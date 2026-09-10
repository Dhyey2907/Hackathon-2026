"use client";

/**
 * The shell every context card shares: a title, an optional badge, and a body
 * that is either content or a plain sentence saying what would fill it.
 *
 * All four cards are always on screen, including before anything has been
 * asked. A panel whose cards appear and vanish as the conversation moves reads
 * as broken; one that says "sources for the current answer will appear here"
 * reads as ready. The awaiting state is the card doing its job, not a gap.
 */

import type { ReactNode } from "react";

interface ContextCardProps {
  title: string;
  /** Small qualifier beside the title, e.g. "Sample data". */
  badge?: string;
  badgeTone?: "neutral" | "warning";
  /** Shown instead of children when there is nothing real to display yet. */
  awaiting?: string;
  children?: ReactNode;
}

export default function ContextCard({
  title,
  badge,
  badgeTone = "neutral",
  awaiting,
  children,
}: ContextCardProps) {
  const showAwaiting = awaiting !== undefined && !children;

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              badgeTone === "warning"
                ? "bg-amber-100 text-amber-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {badge}
          </span>
        )}
      </header>

      {showAwaiting ? (
        <p className="text-sm leading-relaxed text-gray-500">{awaiting}</p>
      ) : (
        children
      )}
    </section>
  );
}
