"use client";

import Link from "next/link";
import { useAuth, UserType } from "@/components/auth/AuthProvider";

type RequirementItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  isUrgent?: boolean;
};

const MISSING_REQUIREMENTS: Record<UserType, RequirementItem[]> = {
  existing_business: [
    {
      id: "mr-1",
      title: "BIS ISI License — IS 9000 (Electronics)",
      description:
        "Mandatory ISI certification for electrical goods under the Electronics & IT Goods Quality Control Order (QCO). Products cannot be sold in India without this mark.",
      href: "/wizard",
      hrefLabel: "Use Product Wizard to check requirements",
      isUrgent: true,
    },
    {
      id: "mr-2",
      title: "Annual Factory Inspection Report",
      description:
        "A current factory inspection report (within the last 12 months) is required for BIS license renewal under Schedule IV of the IS Act. Upload it to your Documents vault.",
      href: "/documents",
      hrefLabel: "Upload to Documents",
      isUrgent: true,
    },
    {
      id: "mr-3",
      title: "Test Report — IS 616 (Lamps)",
      description:
        "Third-party lab test report from a BIS-recognized laboratory required as evidence of compliance for LED lamp products. Must be less than 2 years old.",
      href: "/labs",
      hrefLabel: "Find a BIS-recognized lab",
    },
  ],
  new_business: [
    {
      id: "mr-4",
      title: "BIS Registration — Compulsory Registration Scheme (CRS)",
      description:
        "CRS registration is required before importing or selling most IT and electronics products in India. Registration must be obtained from BIS before market entry.",
      href: "/wizard",
      hrefLabel: "Use Product Wizard to check requirements",
      isUrgent: true,
    },
    {
      id: "mr-5",
      title: "FSSAI License (if food / packaging sector)",
      description:
        "Food businesses must obtain FSSAI registration or license before commencing operations. Mandatory for manufacturers, traders, and importers of food products.",
      href: "/standards",
      hrefLabel: "Explore food-related standards",
      isUrgent: true,
    },
    {
      id: "mr-6",
      title: "ISO 9001 Quality Management System Certification",
      description:
        "Recommended pre-requisite for BIS license applications. An ISO 9001-certified QMS significantly streamlines the BIS approval process and demonstrates operational control.",
      href: "/standards",
      hrefLabel: "Explore IS / ISO standards",
    },
    {
      id: "mr-7",
      title: "Test Report from NABL-Accredited Laboratory",
      description:
        "Product testing must be performed at an NABL-accredited laboratory for BIS scheme entry. Find an approved lab near your manufacturing location.",
      href: "/labs",
      hrefLabel: "Find a BIS-recognized lab",
    },
  ],
  consumer: [
    {
      id: "mr-8",
      title: "Verify Product ISI / FSSAI Mark Before Purchase",
      description:
        "Use the Verify tool to check whether a product's BIS mark or HUID hallmark number is authentic and currently valid before you purchase.",
      href: "/verify",
      hrefLabel: "Go to Verify BIS Mark",
    },
    {
      id: "mr-9",
      title: "Register Consumer Complaint (if applicable)",
      description:
        "Products sold without a valid ISI mark can be reported to BIS Consumer Affairs. This action protects other consumers and ensures market compliance.",
      href: "/standards",
      hrefLabel: "Learn about consumer rights",
    },
  ],
};

const SECTOR_LABELS: Record<UserType, string> = {
  existing_business: "Running a Business",
  new_business: "Starting a Business",
  consumer: "Consumer",
};

export default function MissingRequirementsPage() {
  const { user } = useAuth();
  const userType: UserType = user?.userType ?? "existing_business";
  const items = MISSING_REQUIREMENTS[userType];
  const urgentCount = items.filter((i) => i.isUrgent).length;

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
            Compliance · {SECTOR_LABELS[userType]}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Missing Requirements</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            The following certifications, licenses, or reports are typically required for your business category
            but have not been detected in your document vault.
          </p>
          {urgentCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              {urgentCount} item{urgentCount !== 1 ? "s" : ""} need immediate action
            </div>
          )}
        </div>

        {/* List */}
        <ol className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.id}>
              <article
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  item.isUrgent ? "border-red-200" : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Sequence number / urgency indicator */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      item.isUrgent
                        ? "bg-red-100 text-red-700"
                        : "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">{item.title}</h2>
                      {item.isUrgent && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.description}</p>
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-navy)] hover:underline"
                    >
                      {item.hrefLabel}
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>

        {/* Footer nudge */}
        <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">Not sure which certifications apply to you?</p>
          <p className="mt-1 text-sm text-gray-600">
            Use the Product Wizard to answer a few questions and get a tailored list of applicable Indian
            Standards and certification schemes for your product or sector.
          </p>
          <Link
            href="/wizard"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] transition"
          >
            Launch Product Wizard
          </Link>
        </div>
      </div>
    </main>
  );
}
