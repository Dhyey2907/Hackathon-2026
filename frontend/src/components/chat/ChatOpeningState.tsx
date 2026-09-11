"use client";

/**
 * The opening state of the chat: an invitation, not a gate.
 *
 * Two variants, chosen by whether the backend could infer a business from the
 * user's own history:
 *
 *   new         one question - what do you work with?
 *   returning   what we think they work with, and useful next steps
 *
 * Neither blocks anything. The composer stays live underneath, so a user who
 * would rather ask "what is BIS certification?" can simply type it and never
 * answer the question. That is the difference between onboarding and a form.
 *
 * Nothing here is hardcoded BIS knowledge: the suggestions arrive from the
 * backend, generated from this user's context and their actual questions.
 */

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { fill } from "@/lib/i18n/format";
import { useState } from "react";
import { useChat } from "./ChatProvider";

export default function ChatOpeningState() {
  const { businessContext, isNewUser, suggestions, sendMessage, isLoading } = useChat();
  const [draft, setDraft] = useState("");
  const { t } = useLanguage();

  const headline = businessContext?.headline ?? null;

  function submitBusiness(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    void sendMessage(text);
  }

  // --------------------------------------------------------- returning user

  if (!isNewUser && headline) {
    return (
      <section
        aria-labelledby="chat-welcome"
        className="rounded-xl border border-[var(--color-border)] bg-white/70 px-5 py-4 dark:bg-white/[0.03]"
      >
        <h2 id="chat-welcome" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("auth.welcome")}
        </h2>
        {/*
          The wording comes pre-hedged from the backend - "you're working with"
          only when the user said so, "you've been asking about" when it was
          inferred - so the interface cannot accidentally assert something the
          user never told us.
        */}
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {fill(t("open.basedOn"), { headline })}
        </p>

        {suggestions.length > 0 && (
          <>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-400">
              {t("open.howHelp")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void sendMessage(suggestion)}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:border-[var(--color-navy)] hover:text-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/30 disabled:opacity-50 dark:bg-white/[0.04] dark:text-gray-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mt-4 text-xs text-gray-400">
          {t("open.orAsk")}
        </p>
      </section>
    );
  }

  // --------------------------------------------------------------- new user

  return (
    <section
      aria-labelledby="chat-onboarding"
      className="rounded-xl border border-[var(--color-border)] bg-white/70 px-5 py-4 dark:bg-white/[0.03]"
    >
      <h2 id="chat-onboarding" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t("open.start")}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {t("open.whatBusiness")}
      </p>

      <form onSubmit={submitBusiness} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">{t("open.describe")}</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("open.ph")}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
          />
        </label>
        <button
          type="submit"
          disabled={!draft.trim() || isLoading}
          className="h-10 shrink-0 rounded-lg bg-[var(--color-navy)] px-4 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/40 disabled:opacity-40"
        >
          {t("common.continue")}
        </button>
      </form>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t("open.tell")}
      </p>
    </section>
  );
}
