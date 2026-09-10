"use client";

/**
 * The BIS laboratory directory.
 *
 * Real rows now, from the Group 1 and Group 2 lists BIS publishes, replacing
 * the ten fixtures that used to sit here under the heading "BIS directory"
 * with invented phone numbers.
 *
 * Two consequences of using the real lists, both visible in this screen:
 *
 * There is no scope filter any more, because BIS does not publish test scopes
 * in these lists. Searching by product would have quietly returned nothing.
 * The search runs over name, city and state, and the panel points at the LIMS
 * portal for the standards-wise question this screen cannot answer.
 *
 * Recognition is a state, not a fact. A laboratory can be suspended or its
 * recognition can lapse, and both are in the data, so both are on the card.
 * Suspended entries are shown rather than hidden - someone holding a report
 * from one needs to be able to find out - but they sort last and say so.
 */

import { useEffect, useMemo, useState } from "react";
import { findLabs } from "@/lib/api";
import type { Lab } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import Reveal from "@/components/motion/Reveal";

const LIMS_SCOPE_SEARCH = "https://lims.bis.gov.in/home/search_is_number/";
const ALL_STATES = "All locations";
const ALL_KINDS = "All laboratories";
const RECOGNISED = "BIS recognised only";

function isRecognised(lab: Lab): boolean {
  return (lab.schemes ?? "").startsWith("BIS recognised");
}

function hasLapsed(lab: Lab): boolean {
  return Boolean(lab.valid_to) && new Date(lab.valid_to as string) < new Date();
}

export default function LabFinder() {
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState(ALL_STATES);
  const [kind, setKind] = useState(ALL_KINDS);

  useEffect(() => {
    let live = true;
    findLabs()
      .then((response) => live && setLabs(response.results))
      .catch(() => live && setError("Could not load the laboratory directory."));
    return () => {
      live = false;
    };
  }, []);

  const states = useMemo(() => {
    const found = new Set((labs ?? []).map((lab) => lab.state).filter(Boolean) as string[]);
    return [ALL_STATES, ...Array.from(found).sort()];
  }, [labs]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (labs ?? []).filter((lab) => {
      const searchable = [lab.name, lab.city, lab.state, lab.osl_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (state !== ALL_STATES && lab.state !== state) return false;
      if (kind === RECOGNISED && !isRecognised(lab)) return false;
      return true;
    });
  }, [labs, query, state, kind]);

  return (
    <div className="space-y-5">
      <Reveal as="section" className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
              BIS laboratory directory
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">Find a testing laboratory</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">
              Search the laboratories BIS publishes, by name, city or state.
            </p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-gray-500">
              BIS does not publish what each laboratory can test. To find one for a particular
              standard, use the{" "}
              <a
                href={LIMS_SCOPE_SEARCH}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--color-navy)] hover:underline"
              >
                LIMS standards-wise search
              </a>
              .
            </p>
          </div>
          <span className="whitespace-nowrap text-sm text-gray-500">
            <strong className="text-gray-900">{results.length}</strong>{" "}
            {labs === null ? "loading" : "matches"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_190px_190px]">
          <label className="relative">
            <span className="sr-only">Search laboratories</span>
            <svg className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, city or OSL code..."
              className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
            />
          </label>

          <label>
            <span className="sr-only">Filter by state</span>
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
            >
              {states.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filter by recognition</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
            >
              <option>{ALL_KINDS}</option>
              <option>{RECOGNISED}</option>
            </select>
          </label>
        </div>
      </Reveal>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {labs === null && !error && (
        <p className="text-sm text-gray-500">Loading the directory…</p>
      )}

      {labs !== null && results.length === 0 && (
        <EmptyState
          title="No laboratories match"
          description="Try a different state, or search by the laboratory's name."
        />
      )}

      <Reveal as="section" delayIndex={1} className="grid gap-4 md:grid-cols-2" aria-live="polite">
        {results.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </Reveal>
    </div>
  );
}

function LabCard({ lab }: { lab: Lab }) {
  const recognised = isRecognised(lab);
  const lapsed = hasLapsed(lab);
  const suspended = lab.operative === false;

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-gray-900">{lab.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            recognised ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {recognised ? "BIS recognised" : "Used by BIS"}
        </span>
      </div>

      <p className="mt-1 text-sm text-gray-600">
        {[lab.city, lab.state].filter(Boolean).join(", ") || "Location not published"}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        {lab.osl_code && (
          <div className="flex gap-1.5">
            <dt>OSL</dt>
            <dd className="font-mono text-gray-700">{lab.osl_code}</dd>
          </div>
        )}
        {lab.category && (
          <div className="flex gap-1.5">
            <dt>Type</dt>
            <dd className="text-gray-700">{lab.category}</dd>
          </div>
        )}
        {lab.valid_to && (
          <div className="flex gap-1.5">
            <dt>{lapsed ? "Lapsed" : "Valid to"}</dt>
            <dd className={lapsed ? "font-semibold text-amber-700" : "text-gray-700"}>
              {new Date(lab.valid_to).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        )}
      </dl>

      {/* Both of these are reasons not to rely on the entry, so neither is
          buried: a suspended lab is still listed, but never silently. */}
      {suspended && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          <strong>Currently suspended.</strong> {lab.remarks}
        </p>
      )}
      {!suspended && lab.remarks && (
        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{lab.remarks}</p>
      )}
    </article>
  );
}
