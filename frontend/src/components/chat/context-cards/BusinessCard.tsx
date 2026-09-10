"use client";

/**
 * What the assistant has worked out about the user's business.
 *
 * Gated on `is_usable`, which the backend sets only for high or medium
 * confidence with an actual product or business type behind it. Below that bar
 * the card asks rather than asserts: telling someone "you manufacture helmets"
 * because they once asked about helmets is the exact failure the confidence
 * levels exist to prevent.
 *
 * `headline` already carries the right hedge for the confidence level - it
 * reads "you're working with X" when the user said so and "you've been asking
 * about X" when we only inferred it - so it is used verbatim rather than
 * rebuilt here.
 */

import { useChat } from "../ChatProvider";
import ContextCard from "./ContextCard";

const ROLE_LABEL: Record<string, string> = {
  manufacturer: "Manufacturer",
  seller: "Seller",
  service_provider: "Service provider",
};

export default function BusinessCard() {
  const { businessContext } = useChat();

  if (!businessContext?.is_usable) {
    return (
      <ContextCard
        title="Your business"
        awaiting="Tell me what you make or sell and I'll tailor answers to it."
      />
    );
  }

  const { headline, products, role, industry, business_type, topics, evidence } = businessContext;
  const roleLabel = ROLE_LABEL[role];
  const facts = [roleLabel, industry, business_type].filter(Boolean) as string[];

  return (
    <ContextCard title="Your business">
      {headline && (
        <p className="text-sm font-medium leading-relaxed text-gray-900 first-letter:uppercase">
          {headline}
        </p>
      )}

      {products.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Products">
          {products.map((product) => (
            <li
              key={product}
              className="rounded-full bg-[var(--color-navy-lighter)] px-2.5 py-1 text-xs font-medium text-[var(--color-navy)]"
            >
              {product}
            </li>
          ))}
        </ul>
      )}

      {facts.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">{facts.join(" · ")}</p>
      )}

      {topics.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            You&apos;ve asked about
          </p>
          <p className="text-xs text-gray-600">{topics.join(", ")}</p>
        </div>
      )}

      {evidence && (
        // Shown so the inference is checkable. The backend only keeps evidence
        // it could match against the user's own words.
        <blockquote className="mt-3 border-l-2 border-[var(--color-border)] pl-3 text-xs italic leading-relaxed text-gray-500">
          You said: &ldquo;{evidence}&rdquo;
        </blockquote>
      )}
    </ContextCard>
  );
}
