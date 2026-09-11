/**
 * Formatting that depends on the interface language.
 *
 * Kept apart from the dictionary: these turn values into text (dates, a
 * sentence with a number in it) rather than looking text up.
 */

import type { Language } from "./strings";

/**
 * Put values into a translated template: fill("{n} records", { n: 4 }).
 *
 * Templates rather than string concatenation, because word order differs:
 * English says "Expires 5 Sept" and Hindi "5 सित॰ को समाप्त", so the sentence
 * has to own where the value goes.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

const LOCALES: Record<Language, string> = { en: "en-IN", hi: "hi-IN" };

/** "5 Sept 2026" in English, "5 सित॰ 2026" in Hindi. */
export function formatDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], { hour: "2-digit", minute: "2-digit" }).format(
    new Date(date),
  );
}

/** Dictionary key for the time-of-day greeting. */
export function greetingKey(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "home.greeting.morning";
  if (hour < 17) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

const CATEGORY_KEYS: Record<string, string> = {
  License: "upload.category.License",
  "Test Report": "upload.category.TestReport",
  Certificate: "upload.category.Certificate",
  Other: "upload.category.Other",
};

/**
 * Dictionary key for a document category. Categories are stored in English -
 * they are data, and a document saved in Hindi must still file under the same
 * category - and only their label is translated.
 */
export function categoryKey(category: string): string {
  return CATEGORY_KEYS[category] ?? category;
}
