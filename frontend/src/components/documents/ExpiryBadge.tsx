"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { fill } from "@/lib/i18n/format";
import { getExpiryStatus } from "./DocumentProvider";

type ExpiryBadgeProps = {
  expiryDate?: string;
  /** "sm" for compact use (document cards), "md" for detail pages */
  size?: "sm" | "md";
};

/**
 * Renders a coloured pill badge based on document expiry proximity.
 * Returns null for valid (>30 days) or no-expiry documents — no noise when everything is fine.
 */
export default function ExpiryBadge({ expiryDate, size = "md" }: ExpiryBadgeProps) {
  const { status, daysLeft } = getExpiryStatus(expiryDate);
  const { t } = useLanguage();

  if (status === "none" || status === "valid") return null;

  const base = "inline-flex items-center gap-1 rounded-full font-semibold";
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  if (status === "expired") {
    return (
      <span className={`${base} ${sizeClass} bg-red-100 text-red-700`}>
        {size === "md" && (
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        )}
        {t("expiry.expired")}
      </span>
    );
  }

  // expiring-soon
  return (
    <span className={`${base} ${sizeClass} bg-amber-100 text-amber-700`}>
      {size === "md" && (
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
        </svg>
      )}
      {size === "sm"
        ? fill(t("expiry.dLeft"), { n: daysLeft ?? 0 })
        : fill(t("expiry.soon"), { left: daysLeft === 1 ? t("expiry.dayLeft") : fill(t("expiry.daysLeft"), { n: daysLeft ?? 0 }) })}
    </span>
  );
}
