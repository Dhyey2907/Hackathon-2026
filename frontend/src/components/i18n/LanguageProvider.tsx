"use client";

/**
 * Which language the interface is in.
 *
 * Persisted in localStorage and read through a small external store rather
 * than an effect that calls setState. Reading storage during render would give
 * the server-rendered HTML one language and the first client render another;
 * reading it in an effect works but sets state on every mount. `getServerSnapshot`
 * returns English, so the server and the first client paint always agree and
 * React swaps to the saved language on its own.
 *
 * This mirrors the assistant-panel store in AppShell.tsx, which solves the
 * same problem the same way.
 *
 * `lang` is also set on <html>, so the browser hyphenates and picks fonts for
 * the right language and screen readers announce Devanagari as Hindi rather
 * than mispronouncing it as English.
 */

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { type Language, lookup } from "@/lib/i18n/strings";

const STORAGE_KEY = "bis-sahayak-language";

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "hi";
}

const languageStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    languageStore.listeners.add(listener);
    return () => languageStore.listeners.delete(listener);
  },
  getSnapshot(): Language {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return isLanguage(saved) ? saved : "en";
    } catch {
      // Private windows and blocked site data throw on access. English is a
      // perfectly good answer to not knowing.
      return "en";
    }
  },
  getServerSnapshot(): Language {
    return "en";
  },
  set(next: Language) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session.
    }
    languageStore.listeners.forEach((listener) => listener());
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (next: Language) => void;
  /** Translate one interface string. */
  t: (key: string) => string;
  /** True when the interface is in a language other than English. */
  isTranslated: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.getSnapshot,
    languageStore.getServerSnapshot
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => languageStore.set(next), []);
  const t = useCallback((key: string) => lookup(language, key), [language]);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, isTranslated: language !== "en" }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    // A component outside the provider should still render readable English
    // rather than crash the page.
    return {
      language: "en",
      setLanguage: () => {},
      t: (key: string) => lookup("en", key),
      isTranslated: false,
    };
  }
  return value;
}
