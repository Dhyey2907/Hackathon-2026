/**
 * Renders a single source citation as a compact card.
 *
 * `doc_type === "catalogue"` gets a distinct label so users understand they
 * are reading catalogue metadata, not the paywalled full standard text.
 */

import type { Source, DocType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<DocType, string> = {
  catalogue: "Catalogue entry",
  scheme_guideline: "Scheme guideline",
  qco: "Quality Control Order",
  act_rules: "Act / Rules",
  faq: "FAQ",
  consumer: "Consumer document",
  hallmarking: "Hallmarking scheme",
};

const DOC_TYPE_COLORS: Record<DocType, string> = {
  catalogue: "bg-amber-50 border-amber-200 text-amber-800",
  scheme_guideline: "bg-blue-50 border-blue-200 text-blue-800",
  qco: "bg-indigo-50 border-indigo-200 text-indigo-800",
  act_rules: "bg-purple-50 border-purple-200 text-purple-800",
  faq: "bg-green-50 border-green-200 text-green-800",
  consumer: "bg-teal-50 border-teal-200 text-teal-800",
  hallmarking: "bg-orange-50 border-orange-200 text-orange-800",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SourceCardProps {
  source: Source;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  const docType = source.doc_type ?? "catalogue";
  const label = DOC_TYPE_LABELS[docType as DocType] ?? docType;
  const colorClass =
    DOC_TYPE_COLORS[docType as DocType] ??
    "bg-gray-50 border-gray-200 text-gray-700";

  return (
    <div className="flex gap-3 text-sm">
      {/* Marker badge */}
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-600 text-[10px] font-semibold text-white"
        style={{ backgroundColor: "#1e3a5f" }}
        aria-label={`Source ${index + 1}`}
      >
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        {/* Title */}
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-900 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
          >
            {source.title ?? "Untitled document"}
          </a>
        ) : (
          <span className="font-medium text-gray-900">
            {source.title ?? "Untitled document"}
          </span>
        )}

        {/* Meta row */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {/* IS number tag */}
          {source.is_number && (
            <span className="inline-flex items-center rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-700">
              {source.is_number}
            </span>
          )}

          {/* Doc type badge */}
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${colorClass}`}
          >
            {label}
          </span>

          {/* Locator */}
          {source.locator && (
            <span className="text-[11px] text-gray-500">{source.locator}</span>
          )}
        </div>

        {/* Catalogue-only notice */}
        {docType === "catalogue" && (
          <p className="mt-1 text-[11px] text-amber-700">
            Catalogue metadata only — full standard text is paywalled.
          </p>
        )}
      </div>
    </div>
  );
}
