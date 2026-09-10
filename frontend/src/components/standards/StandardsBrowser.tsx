"use client";

/**
 * Browse the BIS catalogue.
 *
 * Searches the backend rather than filtering a local array. That matters
 * beyond freshness: the fixtures carried invented committee attributions
 * (IS 13252 was labelled "ETD 35 (IT Equipment)" when BIS files it under
 * LITD 7, and IS 16046 was "ETD 42" rather than ETD 11). Wrong regulatory
 * metadata rendered confidently is the failure this project exists to avoid,
 * so the real catalogue is the only acceptable source once a backend exists.
 *
 * Search runs server-side, because hybrid dense + lexical ranking over 6,209
 * standards cannot be reproduced by substring matching in the browser.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchStandards, USE_MOCK, ApiError } from "@/lib/api";
import type { Standard } from "@/lib/types";
import { MOCK_CATALOGUE, standardSlug } from "@/lib/mock-catalogue";
import EmptyState from "@/components/EmptyState";

const PAGE_SIZE = 8;
const DEBOUNCE_MS = 300;

/** BIS technical departments, used as the category filter. */
const DIVISIONS: Record<string, string> = {
  CED: "Civil Engineering",
  ETD: "Electrotechnical",
  LITD: "Electronics & IT",
  MED: "Mechanical Engineering",
  CHD: "Chemical",
  FAD: "Food & Agriculture",
  TXD: "Textiles",
  MTD: "Metallurgical",
  PCD: "Petroleum & Coal",
  TED: "Transport Engineering",
  EED: "Environment & Ecology",
  WRD: "Water Resources",
  MHD: "Medical Equipment",
  PGD: "Production & General",
  SSD: "Service Sector",
  AYD: "AYUSH",
  MSD: "Management Systems",
};

/** A blank query still needs something to rank against. */
const DEFAULT_QUERY = "specification";

export default function StandardsBrowser() {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("All categories");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the most recent search may write to state: a slow earlier request
  // must not overwrite the results of a later one the user is now looking at.
  const requestRef = useRef(0);

  const runSearch = useCallback(async (term: string) => {
    if (USE_MOCK) {
      setResults(MOCK_CATALOGUE as unknown as Standard[]);
      return;
    }
    const id = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      // 50 is the backend's documented maximum for this endpoint.
      const data = await searchStandards(term.trim() || DEFAULT_QUERY, 50);
      if (id === requestRef.current) setResults(data.results);
    } catch (err) {
      if (id !== requestRef.current) return;
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the catalogue. Please try again.",
      );
      setResults([]);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  // Division is applied client-side: it narrows an already-ranked result set,
  // so re-querying the backend for it would only cost a round trip.
  const filtered =
    division === "All categories"
      ? results
      : results.filter((s) => DIVISIONS[s.division ?? ""] === division);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const categories = [
    "All categories",
    ...Array.from(
      new Set(
        results
          .map((s) => DIVISIONS[s.division ?? ""])
          .filter((v): v is string => Boolean(v)),
      ),
    ).sort(),
  ];

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">BIS catalogue</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">Find an Indian Standard</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">Search by IS number, product name, or the committee responsible for the standard.</p>
          </div>
          <span className="text-sm text-gray-500"><strong className="text-gray-900">6,209</strong> standards in catalogue</span>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search standards</span>
            <svg className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
            <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Try “IS 456” or “cement”" className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20" />
          </label>
          <label className="sm:w-56">
            <span className="sr-only">Filter by category</span>
            <select value={division} onChange={(event) => { setDivision(event.target.value); setPage(1); }} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20">
              {categories.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-600">
          {loading
            ? "Searching…"
            : <>Showing <strong className="text-gray-900">{filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> of {filtered.length} matching results</>}
        </p>
        <p className="hidden text-xs text-gray-500 sm:block">{USE_MOCK ? "Sample data — backend not connected" : "Live BIS catalogue"}</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => runSearch(query)} className="ml-3 font-medium underline">Retry</button>
        </div>
      )}

      <section className="space-y-3" aria-live="polite" aria-busy={loading}>
        {visible.map((standard) => (
          <Link key={standard.is_number} href={`/standards/${standardSlug(standard.is_number)}`} className="group block rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition hover:border-[var(--color-navy)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--color-navy)]">{standard.is_number}</span>
                  {standard.division && DIVISIONS[standard.division] && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">{DIVISIONS[standard.division]}</span>
                  )}
                </div>
                <h3 className="mt-2 text-base font-semibold text-gray-900 group-hover:text-[var(--color-navy)]">{standard.title}</h3>
              </div>
              <span className="shrink-0 text-xs text-gray-500">{standard.year}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span>{standard.committee}</span>
              <span className="ml-auto font-medium text-[var(--color-navy)]">View details →</span>
            </div>
          </Link>
        ))}
        {!visible.length && !loading && !error && (
          <EmptyState
            title="No standards found"
            description="We couldn't find any Indian Standards matching your query. Try a broader keyword or clear the category filter."
            actionLabel="Clear search"
            onAction={() => {
              updateQuery("");
              setDivision("All categories");
            }}
          />
        )}
      </section>

      <nav className="flex items-center justify-center gap-2 pb-4" aria-label="Standards pages">
        <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="px-3 text-sm text-gray-600">Page {safePage} of {pageCount}</span>
        <button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </nav>
    </div>
  );
}
