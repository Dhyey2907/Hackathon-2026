"use client";

import Link from "next/link";
import ComplianceDashboard from "@/components/dashboard/ComplianceDashboard";
import ScrollOverHero from "@/components/ScrollOverHero";

const FEATURES = [
  {
    title: "Chat Assistant",
    description: "Ask questions about standards, licensing, and hallmarking in plain language.",
    href: "/chat",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    title: "Product Wizard",
    description: "Find the applicable Indian Standards and certification requirements for your product.",
    href: "/wizard",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 00-1.022-.547l-2.387-.477a6 6 00-3.86.517l-.318.158a6 6 01-3.86.517L6.05 15.21a2 2 00-1.806.547M8 4h8l-1 1v5.172a2 2 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    title: "Standards Lookup",
    description: "Search the BIS catalogue to find standard codes, titles, and scopes.",
    href: "/standards",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: "Lab Finder",
    description: "Locate BIS-recognised testing laboratories by product scope and location.",
    href: "/labs",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Verify License",
    description: "Check the validity of an ISI license number or HUID hallmark.",
    href: "/verify",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content">
      {/* ── Atmospheric hero — home starts sharp (0px blur), hero is purely aesthetic */}
      <ScrollOverHero
        eyebrow="Your Compliance Command Center"
        title="BIS Sahayak"
        subtitle="Certifications, standards, and regulatory health — all in one place."
        startBlur={0}
        endBlur={0}
      />

      <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
        {/* Compliance dashboard widget — renders for logged-in users via client-side auth check */}
        <ComplianceDashboard />

        {/* Feature grid */}
        <div className="mt-10">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Tools &amp; Features</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-[var(--color-navy)] mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 flex-1">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
