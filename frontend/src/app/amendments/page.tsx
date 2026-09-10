"use client";

import Link from "next/link";

type AmendmentItem = {
  id: string;
  code: string;
  title: string;
  change: string;
  effectiveDate: string;
  sector: string;
  href: string;
  isNew?: boolean;
};

const AMENDMENTS: AmendmentItem[] = [
  {
    id: "am-1",
    code: "IS 616:2024 Amd.2",
    title: "LED Lamps — Photometric Requirements Update",
    change:
      "Revised minimum luminous efficacy thresholds for self-ballasted LED lamps rated above 10W. Products manufactured after the effective date must meet updated lm/W minimums. Existing BIS licensees have a 90-day transition window to update test reports.",
    effectiveDate: "01 October 2026",
    sector: "Electrical / Lighting",
    href: "/standards",
    isNew: true,
  },
  {
    id: "am-2",
    code: "IS 13252:2023 Amd.1",
    title: "IT Equipment Safety — Revised Marking Clause",
    change:
      "Updated marking and labelling clauses to align with IEC 62368-1:2018 harmonisation. The amendment introduces new requirements for safety symbols, voltage warnings, and recycling marks on IT and AV equipment sold in India.",
    effectiveDate: "15 September 2026",
    sector: "IT / Electronics",
    href: "/standards",
    isNew: true,
  },
  {
    id: "am-3",
    code: "QCO 2026 — Steel Products",
    title: "Steel Quality Control Order — Expanded Scope",
    change:
      "Structural steel bars, plates, and sections are now covered under the mandatory BIS ISI certification scheme from November 2026. This expands the earlier QCO which covered TMT bars only. All manufacturers and importers must obtain BIS license before the effective date.",
    effectiveDate: "01 November 2026",
    sector: "Steel / Construction",
    href: "/standards",
    isNew: true,
  },
  {
    id: "am-4",
    code: "IS 1460:2025 Amd.1",
    title: "Automotive Diesel Fuel — Revised Sulphur Limit",
    change:
      "Sulphur content upper limit revised from 10 ppm to 5 ppm for BS-VI compliance. Affects fuel refiners, blenders, and distributors. Updated test method IS 1448 Pt. 33 must be referenced in all compliance documentation.",
    effectiveDate: "01 April 2027",
    sector: "Petroleum / Automotive",
    href: "/standards",
    isNew: false,
  },
];

export default function AmendmentsPage() {
  const newCount = AMENDMENTS.filter((a) => a.isNew).length;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-7">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-navy)] hover:underline"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to Dashboard
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
            Standards · Recent Updates
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">New Amendments</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            Recent amendments to Indian Standards and Quality Control Orders that may be applicable to your sector.
            Review each to determine if your products or operations are affected.
          </p>
          {newCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
              </svg>
              {newCount} new amendment{newCount !== 1 ? "s" : ""} this quarter
            </div>
          )}
        </div>

        {/* List */}
        <ol className="flex flex-col gap-4">
          {AMENDMENTS.map((item) => (
            <li key={item.id}>
              <article className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="rounded bg-[var(--color-navy-lighter)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--color-navy)]">
                      {item.code}
                    </code>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      {item.sector}
                    </span>
                    {item.isNew && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    Effective {item.effectiveDate}
                  </div>
                </div>

                <h2 className="mt-3 text-sm font-semibold text-gray-900">{item.title}</h2>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.change}</p>

                <Link
                  href={item.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-navy)] hover:underline"
                >
                  View in Standards Lookup
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </article>
            </li>
          ))}
        </ol>

        {/* Footer */}
        <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">Need to look up a specific standard?</p>
          <p className="mt-1 text-sm text-gray-600">
            Search the full BIS Standards catalogue by IS code, title, or product category to find current
            versions, scopes, and related certification schemes.
          </p>
          <Link
            href="/standards"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] transition"
          >
            Open Standards Lookup
          </Link>
        </div>
      </div>
    </main>
  );
}
