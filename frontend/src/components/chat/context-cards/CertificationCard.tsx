"use client";

/**
 * The certification picture behind the current answer.
 *
 * Worth being blunt about what this card is not: the system holds no
 * structured certification record. There is no licence number, no scheme
 * status, no validity date anywhere in the pipeline - the certification intent
 * routes to a plain passage search, so the answer comes back as prose with
 * citations and nothing else. The Wizard and Verify screens that look like they
 * hold such data are hardcoded fixtures.
 *
 * So this card shows two things, and keeps them clearly apart:
 *
 *   what the assistant just cited - the scheme, QCO, rules and hallmarking
 *   documents behind this specific answer, which are real and checkable;
 *
 *   what the user typed about themselves during onboarding, under a heading
 *   that says so. It is free text in this browser's storage, never validated
 *   against BIS, and presenting it as a certification record would invent a
 *   fact about someone's legal standing.
 */

import type { DocType } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import ContextCard from "./ContextCard";
import { useLatestAnswer } from "./useLatestAnswer";

/** Document kinds that actually describe schemes and obligations. */
const SCHEME_DOC_TYPES: DocType[] = ["scheme_guideline", "qco", "act_rules", "hallmarking"];

const DOC_TYPE_LABEL: Partial<Record<DocType, string>> = {
  scheme_guideline: "Scheme guideline",
  qco: "Quality Control Order",
  act_rules: "Act & Rules",
  hallmarking: "Hallmarking",
};

export default function CertificationCard() {
  const answer = useLatestAnswer();
  const { user } = useAuth();

  const schemeSources = (answer?.sources ?? []).filter(
    (source) => source.doc_type && SCHEME_DOC_TYPES.includes(source.doc_type)
  );

  const stated = [
    { label: "Certifications", value: user?.onboardingData?.certifications },
    { label: "Standards", value: user?.onboardingData?.standards },
  ].filter((entry) => entry.value && entry.value.trim().length > 0);

  if (schemeSources.length === 0 && stated.length === 0) {
    return (
      <ContextCard
        title="Certification"
        awaiting="Ask about licensing, a scheme or a QCO and the documents behind the answer land here."
      />
    );
  }

  return (
    <ContextCard title="Certification">
      {schemeSources.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Cited in this answer
          </p>
          <ul className="space-y-2.5">
            {schemeSources.map((source) => (
              <li key={source.chunk_uid}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {source.is_number && (
                    <code className="rounded bg-[var(--color-navy-lighter)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-navy)]">
                      {source.is_number}
                    </code>
                  )}
                  {source.doc_type && (
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      {DOC_TYPE_LABEL[source.doc_type] ?? source.doc_type}
                    </span>
                  )}
                </div>
                {source.title && (
                  <p className="mt-1 text-xs leading-relaxed text-gray-700">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                  </p>
                )}
                {source.locator && (
                  <p className="mt-0.5 text-[11px] text-gray-400">{source.locator}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stated.length > 0 && (
        <div className={schemeSources.length > 0 ? "mt-4 border-t border-gray-100 pt-3" : ""}>
          {/* Deliberately headed "You told us" - this is unverified free text
              from onboarding, not anything BIS has confirmed. */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            You told us
          </p>
          <dl className="space-y-1.5">
            {stated.map((entry) => (
              <div key={entry.label}>
                <dt className="text-[11px] text-gray-400">{entry.label}</dt>
                <dd className="text-xs leading-relaxed text-gray-700">{entry.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            As entered during onboarding. Not checked against BIS records.
          </p>
        </div>
      )}
    </ContextCard>
  );
}
