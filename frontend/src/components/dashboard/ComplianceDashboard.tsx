"use client";

import Reveal from "@/components/motion/Reveal";
import { useCountUp } from "@/components/motion/useCountUp";
import QuickUpload from "@/components/documents/QuickUpload";
import { useRoadmapProgress } from "@/components/roadmap/useRoadmapProgress";
import { progressPercent } from "@/lib/roadmap";

import Link from "next/link";
import { useAuth, UserType } from "@/components/auth/AuthProvider";
import { getExpiryStatus, useDocuments } from "@/components/documents/DocumentProvider";

// ─── Mock data keyed by user type ────────────────────────────────────────────

type RequirementItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  isUrgent?: boolean;
};

type AmendmentItem = {
  id: string;
  code: string;
  title: string;
  change: string;
  effectiveDate: string;
  href: string;
};

const MISSING_REQUIREMENTS: Record<UserType, RequirementItem[]> = {
  existing_business: [
    {
      id: "mr-1",
      title: "BIS ISI License — IS 9000 (Electronics)",
      description: "Mandatory ISI certification for electrical goods under the Electronics & IT Goods Quality Control Order.",
      href: "/wizard",
      isUrgent: true,
    },
    {
      id: "mr-2",
      title: "Factory Inspection Report (Annual)",
      description: "Annual factory inspection report required for license renewal under Schedule IV.",
      href: "/documents",
      isUrgent: true,
    },
    {
      id: "mr-3",
      title: "Test Report — IS 616 (Lamps)",
      description: "Third-party lab test report from a BIS-recognized laboratory for LED lamp compliance.",
      href: "/labs",
    },
  ],
  new_business: [
    {
      id: "mr-4",
      title: "BIS Registration — Compulsory Registration Scheme (CRS)",
      description: "CRS registration is required before import or sale of most IT and electronics products.",
      href: "/wizard",
      isUrgent: true,
    },
    {
      id: "mr-5",
      title: "FSSAI License (if food/packaging sector)",
      description: "Food businesses must obtain FSSAI registration before commencing operations.",
      href: "/standards",
      isUrgent: true,
    },
    {
      id: "mr-6",
      title: "ISO 9001 Quality Management System Certification",
      description: "Recommended pre-requisite for BIS license applications to streamline approval.",
      href: "/standards",
    },
    {
      id: "mr-7",
      title: "Test Accreditation from NABL Lab",
      description: "Product testing must be performed at an NABL-accredited laboratory for BIS scheme entry.",
      href: "/labs",
    },
  ],
  consumer: [
    {
      id: "mr-8",
      title: "Verify Product ISI/FSSAI Mark Before Purchase",
      description: "Use the Verify tool to check whether a product's BIS mark number is authentic.",
      href: "/verify",
    },
    {
      id: "mr-9",
      title: "Register Consumer Complaint (if applicable)",
      description: "Products without a valid ISI mark can be reported to BIS Consumer Affairs.",
      href: "/standards",
    },
  ],
};

const AMENDMENTS: AmendmentItem[] = [
  {
    id: "am-1",
    code: "IS 616:2024 Amd.2",
    title: "LED Lamps — Photometric Requirements Update",
    change: "Revised minimum luminous efficacy thresholds for self-ballasted LED lamps above 10W.",
    effectiveDate: "01 October 2026",
    href: "/standards",
  },
  {
    id: "am-2",
    code: "IS 13252:2023 Amd.1",
    title: "IT Equipment Safety — Revised Marking Clause",
    change: "Updated marking and labelling clauses to align with IEC 62368-1:2018 harmonisation.",
    effectiveDate: "15 September 2026",
    href: "/standards",
  },
  {
    id: "am-3",
    code: "QCO 2026 — Steel Products",
    title: "Steel Quality Control Order — Expanded Scope",
    change: "Structural steel and bars now covered under mandatory BIS certification from Nov 2026.",
    effectiveDate: "01 November 2026",
    href: "/standards",
  },
];

// ─── Greeting helper ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Radial Score ─────────────────────────────────────────────────────────────

function RadialScore({ score }: { score: number }) {
  // Both the ring and the digits climb from zero, so the figure reads as a
  // measurement on a scale rather than a label stamped on the page.
  const shown = useCountUp(score);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (shown / 100);
  const gap = circumference - filled;

  // Keyed to the settled score, not the animating one - otherwise every score
  // flashes red then amber on its way up, which reads as a verdict changing.
  const color =
    score >= 80
      ? "#22c55e" // green-500
      : score >= 55
      ? "#f59e0b" // amber-500
      : "#ef4444"; // red-500

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width={100} height={100} viewBox="0 0 100 100" className="-rotate-90">
        {/* Track */}
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={10}
        />
        {/* Progress */}
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)] leading-none">{shown}</span>
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">/ 100</span>
      </div>
    </div>
  );
}

// ─── Score Card ──────────────────────────────────────────────────────────────

function ScoreCard({
  score,
  missingCount,
  expiringCount,
}: {
  score: number;
  missingCount: number;
  expiringCount: number;
}) {
  const label =
    score >= 80
      ? "Satisfactory Health"
      : score >= 55
      ? "Needs Attention"
      : "Critical — Action Required";

  const criticalPatches = missingCount + expiringCount;

  return (
    <Link
      href="/documents"
      id="dashboard-score-card"
      className="group relative flex flex-col items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-cream-card)] p-6 text-center shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)] focus:ring-offset-2 sm:col-span-2 lg:col-span-1"
      aria-label={`Compliance Score: ${score} out of 100. ${label}. ${criticalPatches} critical patches needed.`}
    >
      <div className="flex flex-col items-center gap-3 w-full">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Compliance Score
        </p>
        <RadialScore score={score} />
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
          {criticalPatches > 0 && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {criticalPatches} critical patch{criticalPatches !== 1 ? "es" : ""} needed
            </p>
          )}
        </div>
      </div>
      <span className="text-xs font-semibold text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
        View full overview →
      </span>
    </Link>
  );
}

// ─── Stat Card (light) ────────────────────────────────────────────────────────

type StatCardProps = {
  id: string;
  href: string;
  label: string;
  value: number | string;
  valueColor?: "green" | "amber" | "red" | "navy" | "default";
  subtitle: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
};

function StatCard({ id, href, label, value, valueColor = "default", subtitle, icon, badge }: StatCardProps) {
  const valueColorClass = {
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
    navy: "text-[var(--color-navy)]",
    default: "text-gray-900",
  }[valueColor];

  return (
    <Link
      href={href}
      id={id}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-[var(--color-navy)]">
          {icon}
        </div>
        {badge}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`mt-1 text-3xl font-bold leading-none ${valueColorClass}`}>{value}</p>
        <p className="mt-1.5 text-xs text-gray-500 leading-snug">{subtitle}</p>
      </div>
      <span className="mt-auto text-xs font-semibold text-[var(--color-navy)] opacity-0 group-hover:opacity-100 transition-opacity">
        View details →
      </span>
    </Link>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function ComplianceDashboard() {
  const { user } = useAuth();
  const { documents } = useDocuments();

  if (!user) return null;

  // ── Derive real counts from document state ─────────────────────────────────
  const activeCount = documents.filter((doc) => {
    const { status } = getExpiryStatus(doc.expiryDate);
    return status === "valid" || status === "none";
  }).length;

  const expiringDocs = documents.filter((doc) => {
    const { status } = getExpiryStatus(doc.expiryDate);
    return status === "expired" || status === "expiring-soon";
  });
  const expiringCount = expiringDocs.length;

  // Nearest expiry for subtitle
  const nearestDaysLeft = expiringDocs.reduce<number | null>((min, doc) => {
    const { daysLeft } = getExpiryStatus(doc.expiryDate);
    if (daysLeft === null) return min;
    if (min === null) return daysLeft;
    return daysLeft < min ? daysLeft : min;
  }, null);

  // ── Mock data per user type ────────────────────────────────────────────────
  const userType: UserType = user.userType ?? "existing_business";
  const missingItems = MISSING_REQUIREMENTS[userType];
  const missingCount = missingItems.length;
  const urgentMissingCount = missingItems.filter((i) => i.isUrgent).length;

  // ── Compliance score (derived formula) ────────────────────────────────────
  const rawScore = 100 - missingCount * 12 - expiringCount * 6;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // ── Display name ──────────────────────────────────────────────────────────
  const displayName = user.name || user.identifier;

  return (
    <section
      className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6"
      aria-label="Compliance health dashboard"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-navy)]">
            Compliance Health
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            {getGreeting()}, {displayName}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Here is your regulatory and certification compliance health.
          </p>
        </div>
        <QuickUpload />
      </div>

      {/* ── Five-card grid ─────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1 — Compliance Score (dark, spans wider on small screens) */}
        <Reveal className="h-full [&>*]:h-full">
          <ScoreCard score={score} missingCount={missingCount} expiringCount={expiringCount} />
        </Reveal>

        {/* 2 — Active Certifications */}
        <Reveal delayIndex={1} className="h-full [&>*]:h-full">
          <StatCard
            id="dashboard-active-card"
            href="/documents?filter=valid"
            label="Active Certifications"
            value={activeCount}
            valueColor={activeCount > 0 ? "green" : "default"}
            subtitle={activeCount > 0 ? "All compliant" : "No active documents"}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            }
          />
        </Reveal>

        {/* 3 — Expiring Soon */}
        <Reveal delayIndex={2} className="h-full [&>*]:h-full">
          <StatCard
            id="dashboard-expiring-card"
            href="/documents?filter=expiring"
            label="Expiring Soon"
            value={expiringCount}
            valueColor={expiringCount > 0 ? (expiringCount >= 2 ? "red" : "amber") : "green"}
            subtitle={
              nearestDaysLeft !== null && nearestDaysLeft >= 0
                ? `Renewal in ${nearestDaysLeft} day${nearestDaysLeft !== 1 ? "s" : ""}`
                : expiringCount > 0
                ? "Some already expired"
                : "Nothing expiring"
            }
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
              </svg>
            }
            badge={
              expiringCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Action needed
                </span>
              ) : undefined
            }
          />
        </Reveal>

        {/* 4 — Missing Requirements */}
        <Reveal delayIndex={3} className="h-full [&>*]:h-full">
          <StatCard
            id="dashboard-missing-card"
            href="/missing-requirements"
            label="Missing Requirements"
            value={missingCount}
            valueColor={missingCount === 0 ? "green" : "red"}
            subtitle={urgentMissingCount > 0 ? `${urgentMissingCount} urgent — needs action now` : "Review recommended"}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            }
            badge={
              urgentMissingCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  {urgentMissingCount} urgent
                </span>
              ) : undefined
            }
          />
        </Reveal>

        {/* 5 — New Amendments */}
        <Reveal delayIndex={4} className="h-full [&>*]:h-full">
          <StatCard
            id="dashboard-amendments-card"
            href="/updates"
            label="New Amendments"
            value={AMENDMENTS.length}
            valueColor="navy"
            subtitle="Applicable to Sector"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
              </svg>
            }
            badge={
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                New
              </span>
            }
          />
        </Reveal>
      </div>
    </section>
  );
}
