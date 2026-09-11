"use client";

import { useLanguage } from "./LanguageProvider";

/**
 * One interface string, for server components.
 *
 * Pages such as /verify stay server components so they can export metadata,
 * which means they cannot call the language hook. They render this instead:
 * the page is still served from the server, and only the text follows the
 * reader's language.
 */
export default function T({ k }: { k: string }) {
  const { t } = useLanguage();
  return <>{t(k)}</>;
}
