"use client";

/**
 * What BIS has published lately.
 *
 * Every row comes from the Bureau's own What's New feed, carrying the date BIS
 * put on it and a link to the notice. This replaces a page of four hand-written
 * amendments with invented IS numbers.
 *
 * Grouped by week because that is the rhythm the feed actually has - a handful
 * of notices, a quiet fortnight, then several in a day. Grouping by week makes
 * the quiet stretches visible instead of compressing them away, and the week
 * boundaries come from the backend so every reader sees the same ones.
 *
 * The category chips are ours, derived from each title, not something BIS
 * publishes - so the filter says "grouped by us" rather than implying the
 * Bureau files its announcements this way.
 */

import { useEffect, useMemo, useState } from "react";
import { fetchUpdates } from "@/lib/api";
import type { BisUpdate } from "@/lib/types";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import Reveal from "@/components/motion/Reveal";
import EmptyState from "@/components/EmptyState";

const ALL = "__all__";

const CATEGORY_STYLE: Record<string, string> = {
  amendment: "bg-amber-100 text-amber-800",
  qco: "bg-amber-100 text-amber-800",
  hallmarking: "bg-yellow-100 text-yellow-800",
  licence: "bg-emerald-100 text-emerald-800",
  standard: "bg-blue-100 text-blue-800",
  recruitment: "bg-gray-100 text-gray-600",
  event: "bg-purple-100 text-purple-800",
  news: "bg-gray-100 text-gray-600",
};

/** Monday of the week a date falls in, as an ISO day string. */
function weekStart(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  // getDay() is 0 for Sunday; shift so weeks run Monday to Sunday.
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

function formatDay(iso: string, locale: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Group {
  key: string;
  items: BisUpdate[];
}

export default function UpdatesFeed() {
  const { t, language } = useLanguage();
  const locale = language === "hi" ? "hi-IN" : "en-IN";

  const [updates, setUpdates] = useState<BisUpdate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);

  useEffect(() => {
    let live = true;
    fetchUpdates()
      .then((response) => live && setUpdates(response.results))
      .catch(() => live && setError(t("updates.unreachable")));
    return () => {
      live = false;
    };
    // `t` changes with the language; refetching on that would be pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const item of updates ?? []) {
      tally[item.category] = (tally[item.category] ?? 0) + 1;
    }
    return tally;
  }, [updates]);

  const visible = useMemo(
    () => (updates ?? []).filter((item) => category === ALL || item.category === category),
    [updates, category]
  );

  /** Newest week first, undated items collected at the end. */
  const groups = useMemo<Group[]>(() => {
    const byWeek = new Map<string, BisUpdate[]>();
    for (const item of visible) {
      const key = item.published_on ? weekStart(item.published_on) : "";
      byWeek.set(key, [...(byWeek.get(key) ?? []), item]);
    }
    return [...byWeek.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({ key, items }));
  }, [visible]);

  const thisWeek = weekStart(new Date().toISOString().slice(0, 10));

  function weekLabel(key: string): string {
    if (!key) return t("updates.undated");
    if (key === thisWeek) return t("updates.thisWeek");
    const previous = new Date(`${thisWeek}T00:00:00`);
    previous.setDate(previous.getDate() - 7);
    if (key === previous.toISOString().slice(0, 10)) return t("updates.lastWeek");
    return `${t("updates.weekOf")} ${formatDay(key, locale)}`;
  }

  return (
    <div className="space-y-5">
      <Reveal as="section" className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
          {t("updates.eyebrow")}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-gray-900">{t("updates.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">{t("updates.subtitle")}</p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-500">
          {t("updates.sourceNote")}{" "}
          <a
            href="https://www.bis.gov.in/whats-new/?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--color-navy)] hover:underline"
          >
            bis.gov.in
          </a>
          .
        </p>

        {updates && updates.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label={t("updates.filter")}>
            <FilterChip
              label={t("updates.all")}
              count={updates.length}
              active={category === ALL}
              onClick={() => setCategory(ALL)}
            />
            {Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <FilterChip
                  key={name}
                  label={t(`updates.category.${name}`)}
                  count={count}
                  active={category === name}
                  onClick={() => setCategory(name)}
                />
              ))}
          </div>
        )}
      </Reveal>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {updates === null && !error && <p className="text-sm text-gray-500">{t("updates.loading")}</p>}

      {updates !== null && visible.length === 0 && !error && (
        <EmptyState title={t("updates.noneTitle")} description={t("updates.noneBody")} />
      )}

      {groups.map((group, index) => (
        <Reveal key={group.key || "undated"} delayIndex={index} as="section">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {weekLabel(group.key)}
            <span className="ml-2 font-normal normal-case text-gray-300">
              {group.items.length}
            </span>
          </h3>
          <ol className="space-y-3">
            {group.items.map((item) => (
              <li key={item.update_uid}>
                <UpdateCard item={item} locale={locale} />
              </li>
            ))}
          </ol>
        </Reveal>
      ))}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] ${
        active
          ? "border-[var(--color-navy)] bg-[var(--color-navy-lighter)] font-semibold text-[var(--color-navy)]"
          : "border-[var(--color-border)] bg-white text-gray-600 hover:border-[var(--color-navy)]"
      }`}
    >
      {label} <span className="tabular-nums text-gray-400">{count}</span>
    </button>
  );
}

function UpdateCard({ item, locale }: { item: BisUpdate; locale: string }) {
  const { t } = useLanguage();
  const style = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.news;

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style}`}>
          {t(`updates.category.${item.category}`)}
        </span>
        {item.is_number && (
          <code className="rounded bg-[var(--color-navy-lighter)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-navy)]">
            {item.is_number}
          </code>
        )}
        {item.published_on && (
          <span className="ml-auto text-[11px] tabular-nums text-gray-400">
            {formatDay(item.published_on, locale)}
          </span>
        )}
      </div>

      <h4 className="mt-2 text-sm font-medium leading-relaxed text-gray-900">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h4>

      {(item.media_type || item.size) && (
        <p className="mt-1.5 text-[11px] uppercase tracking-wide text-gray-400">
          {[item.media_type, item.size].filter(Boolean).join(" · ")}
        </p>
      )}
    </article>
  );
}
