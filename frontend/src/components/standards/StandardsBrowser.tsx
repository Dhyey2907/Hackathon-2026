"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MOCK_CATALOGUE, standardSlug } from "@/lib/mock-catalogue";

const PAGE_SIZE = 8;

export default function StandardsBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [page, setPage] = useState(1);
  const categories = ["All categories", ...Array.from(new Set(MOCK_CATALOGUE.map((item) => item.category)))];
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return MOCK_CATALOGUE.filter((standard) => {
      const matchesCategory = category === "All categories" || standard.category === category;
      const matchesSearch = !search || [standard.is_number, standard.title, standard.committee, standard.scope].some((value) => value?.toLowerCase().includes(search));
      return matchesCategory && matchesSearch;
    });
  }, [category, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20">
              {categories.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-600">Showing <strong className="text-gray-900">{filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of {filtered.length} matching results</p>
        <p className="hidden text-xs text-gray-500 sm:block">Representative local catalogue</p>
      </div>

      <section className="space-y-3" aria-live="polite">
        {visible.map((standard) => (
          <Link key={`${standard.is_number}-${standard.title}`} href={`/standards/${standardSlug(standard.is_number)}`} className="group block rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition hover:border-[var(--color-navy)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-[var(--color-navy)]">{standard.is_number}</span><span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">{standard.status}</span></div>
                <h3 className="mt-2 text-base font-semibold text-gray-900 group-hover:text-[var(--color-navy)]">{standard.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{standard.scope}</p>
              </div>
              <span className="shrink-0 text-xs text-gray-500">{standard.year}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500"><span>{standard.committee}</span><span className="text-[var(--color-navy)]">{standard.scheme}</span><span className="ml-auto font-medium text-[var(--color-navy)]">View details →</span></div>
          </Link>
        ))}
        {!visible.length && <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center"><h3 className="font-semibold text-gray-900">No standards found</h3><p className="mt-1 text-sm text-gray-600">Try a broader keyword or clear the category filter.</p></div>}
      </section>

      <nav className="flex items-center justify-center gap-2 pb-4" aria-label="Standards pages">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="px-3 text-sm text-gray-600">Page {page} of {pageCount}</span>
        <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </nav>
    </div>
  );
}