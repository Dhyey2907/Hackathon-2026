"use client";

/**
 * Switch the interface between English and Hindi.
 *
 * Both options are always shown rather than one button that toggles, because
 * a single button has to be labelled in one language or the other and is then
 * unreadable to exactly the person who needs it. "हिन्दी" sitting beside
 * "English" needs no reading at all.
 */

import { LANGUAGE_LABELS, type Language } from "@/lib/i18n/strings";
import { useLanguage } from "./LanguageProvider";

const OPTIONS: Language[] = ["en", "hi"];

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={`inline-flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] p-0.5 ${className}`.trim()}
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          aria-pressed={language === option}
          lang={option}
          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] ${
            language === option
              ? "bg-[var(--color-navy)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-navy)]"
          }`}
        >
          {LANGUAGE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
