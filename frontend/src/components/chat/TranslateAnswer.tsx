"use client";

/**
 * Read this answer in another language.
 *
 * Translation is offered on a finished answer rather than asked for up front,
 * and that ordering is the point: the answer was composed in English against
 * an English corpus and its citations were validated there. Translating
 * afterwards keeps that check on the text it was written for, and keeps the
 * English one tap away - so if a translation reads oddly, the original it came
 * from is still right here to compare against.
 *
 * When the backend refuses a translation - which it does when the translation
 * has shed its citation markers - the English is shown with the reason, rather
 * than a fluent answer that can no longer be checked.
 */

import { useEffect, useRef, useState } from "react";
import { translateAnswer } from "@/lib/api";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** Endonyms: a speaker looks for their language written the way they write it. */
const LANGUAGES: { code: string; name: string; english: string }[] = [
  { code: "hi", name: "हिन्दी", english: "Hindi" },
  { code: "bn", name: "বাংলা", english: "Bengali" },
  { code: "ta", name: "தமிழ்", english: "Tamil" },
  { code: "te", name: "తెలుగు", english: "Telugu" },
  { code: "mr", name: "मराठी", english: "Marathi" },
  { code: "gu", name: "ગુજરાતી", english: "Gujarati" },
  { code: "kn", name: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", name: "മലയാളം", english: "Malayalam" },
];

interface TranslateAnswerProps {
  /** The English answer, exactly as validated. */
  source: string;
  /** Called with the text to display: a translation, or null for the original. */
  onShow: (text: string | null, language: string | null) => void;
  /** Language currently on screen, or null when showing the original. */
  active: string | null;
  /**
   * Translate without being asked, when the interface itself is in another
   * language. Set only on the newest answer: doing it for every message in a
   * long history would fire a model call per bubble on the first render.
   */
  auto?: boolean;
}

export default function TranslateAnswer({ source, onShow, active, auto = false }: TranslateAnswerProps) {
  const { language: uiLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Translations are kept per answer, so switching back and forth is instant
  // and does not spend another model call on text already translated.
  const [cache, setCache] = useState<Record<string, string>>({});

  async function choose(code: string) {
    setOpen(false);
    setNotice(null);

    const cached = cache[code];
    if (cached) {
      onShow(cached, code);
      return;
    }

    setBusy(code);
    try {
      const result = await translateAnswer(source, code);
      if (result.translated) {
        setCache((current) => ({ ...current, [code]: result.text }));
        onShow(result.text, code);
      } else {
        // Refused. Keep the English on screen and say why.
        onShow(null, null);
        setNotice(result.warning ?? "This answer could not be translated.");
      }
    } catch {
      setNotice(t("chat.translateUnavailable"));
    } finally {
      setBusy(null);
    }
  }

  // Translate once, without being asked, when the interface is in another
  // language. Guarded by a ref rather than by state so a re-render mid-flight
  // cannot start a second request for the same answer.
  const autoTried = useRef<string | null>(null);
  useEffect(() => {
    if (!auto || uiLanguage === "en" || active !== null) return;
    if (autoTried.current === uiLanguage) return;
    autoTried.current = uiLanguage;
    void choose(uiLanguage);
    // `choose` is recreated every render; re-running on that would defeat the
    // ref guard's purpose without changing what happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, uiLanguage, active]);

  const activeLanguage = LANGUAGES.find((language) => language.code === active);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:text-[var(--color-navy)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.5 48.5 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138q.897.06 1.786.15m-1.786-.15L11.28 9.517M9 17.25a41 41 0 0 1-2.077-2.045" />
          </svg>
          {activeLanguage ? activeLanguage.name : t("chat.translate")}
          {busy && <span className="text-gray-400">…</span>}
        </button>

        {activeLanguage && (
          <button
            type="button"
            onClick={() => onShow(null, null)}
            className="text-[11px] font-semibold text-gray-500 underline-offset-2 hover:text-[var(--color-navy)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
          >
            {t("chat.showEnglish")}
          </button>
        )}
      </div>

      {open && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("chat.translateInto")}>
          {LANGUAGES.map((language) => (
            <li key={language.code}>
              <button
                type="button"
                onClick={() => void choose(language.code)}
                disabled={busy !== null}
                lang={language.code}
                title={language.english}
                className={`rounded-lg border px-2.5 py-1 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] disabled:opacity-50 ${
                  active === language.code
                    ? "border-[var(--color-navy)] bg-[var(--color-navy-lighter)] font-semibold text-[var(--color-navy)]"
                    : "border-[var(--color-border)] bg-white text-gray-700 hover:border-[var(--color-navy)]"
                }`}
              >
                {language.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          {notice}
        </p>
      )}

      {activeLanguage && (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          {t("chat.translatedNote")}
        </p>
      )}
    </div>
  );
}
