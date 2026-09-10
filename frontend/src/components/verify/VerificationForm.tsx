"use client";

import Image from "next/image";
import { useState } from "react";
import { getExpiryStatus } from "@/components/documents/DocumentProvider";
import QrScanner from "./QrScanner";

type Mode = "license" | "huid";
type InputMethod = "manual" | "scan";

/** Verification status badge type — deliberately separate from document expiry */
type VerifyStatus = "verified-compliant" | "expired" | "expiring-soon";

type VerifyRecord = {
  /** The lookup key shown in the input (license number or HUID) */
  value: string;
  holder: string;
  product: string;
  issued: string;
  /** ISO date string used for expiry badge logic, e.g. "2024-04-11" */
  validUntilIso: string;
  /** Human-readable validity shown in the grid */
  validUntilLabel: string;
  location: string;
  // ── new fields ──────────────────────────────────────────
  certificateName: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: string;
  applicableStandard: string;
  productCategory: string;
  status: VerifyStatus;
  sourceUrl: string;
};

const RESULTS: Record<Mode, VerifyRecord> = {
  license: {
    value: "CM/L-1234567890",
    certificateName: "BIS Certificate — IS 9573",
    certificateNumber: "BIS/CM/L/2024/GJ/987654",
    issuingAuthority: "Bureau of Indian Standards (BIS)",
    holder: "Lumina Electricals Pvt. Ltd.",
    product: "Self-ballasted LED lamps and luminaires",
    productCategory: "Electrical / Lighting Equipment",
    applicableStandard: "IS 9573:2021 (Adapters & Power Units for LED Lighting)",
    location: "Ahmedabad, Gujarat",
    issueDate: "12 April 2024",
    issued: "12 April 2024",
    // Set to ~18 days from 2026-09-09 → "Expiring Soon" (amber)
    validUntilIso: "2026-09-27",
    validUntilLabel: "27 September 2026",
    status: "expiring-soon",
    sourceUrl: "https://www.bis.gov.in/index.php/public-portal/isi-mark",
  },
  huid: {
    value: "A1B2C3",
    certificateName: "BIS Hallmarking Certificate — HUID",
    certificateNumber: "BIS/HM/JW/2025/RJ/551100",
    issuingAuthority: "Bureau of Indian Standards (BIS) — Hallmarking Division",
    holder: "Shree Kalyan Jewellers",
    product: "22K gold necklace (Hallmark record active)",
    productCategory: "Jewellery / Precious Metals",
    applicableStandard: "IS 1417:2016 (Grades of Gold & Gold Alloys — Hallmarking)",
    location: "Jaipur, Rajasthan",
    issueDate: "08 February 2025",
    issued: "08 February 2025",
    // Set to 2024-12-31 → already past → "Expired" (red)
    validUntilIso: "2024-12-31",
    validUntilLabel: "31 December 2024",
    status: "expired",
    sourceUrl: "https://www.bis.gov.in/index.php/public-portal/hallmark",
  },
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ record }: { record: VerifyRecord }) {
  // Derive live status from the ISO date (so it stays accurate over time)
  const { status, daysLeft } = getExpiryStatus(record.validUntilIso);

  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        Expired
      </span>
    );
  }

  if (status === "expiring-soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
        </svg>
        Expiring Soon — {daysLeft} day{daysLeft === 1 ? "" : "s"} left
      </span>
    );
  }

  // valid or none
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      Verified Compliant
    </span>
  );
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function VerifyResultCard({ result, mode }: { result: VerifyRecord; mode: Mode }) {
  return (
    <section
      className="mt-5 rounded-xl border border-green-200 bg-white p-5 shadow-sm sm:p-7"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-green-800">Record verified</h2>
          <p className="mt-1 text-sm text-gray-600">
            The details below match the BIS verification record.
          </p>
        </div>
      </div>

      {/* Status Badge — prominent, below header */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Status:</span>
        <StatusBadge record={result} />
      </div>

      {/* Two-column key-value grid */}
      <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
        {/* Row 1 */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {mode === "license" ? "License Number" : "HUID"}
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-gray-900">{result.value}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Certificate Number</dt>
          <dd className="mt-1 font-mono text-sm font-medium text-gray-900">{result.certificateNumber}</dd>
        </div>

        {/* Row 2 */}
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Certificate Name</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">{result.certificateName}</dd>
        </div>

        {/* Row 3 */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Holder</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">{result.holder}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Issuing Authority</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.issuingAuthority}</dd>
        </div>

        {/* Row 4 */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.product}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product Category</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.productCategory}</dd>
        </div>

        {/* Row 5 */}
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Applicable Standard</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.applicableStandard}</dd>
        </div>

        {/* Row 6 */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Issue Date</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.issueDate}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valid Until</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.validUntilLabel}</dd>
        </div>

        {/* Row 7 */}
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Location</dt>
          <dd className="mt-1 text-sm text-gray-700">{result.location}</dd>
        </div>
      </dl>

      {/* View Source link */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <a
          href={result.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-[var(--color-navy)] transition hover:bg-[var(--color-navy)] hover:text-white"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          View Source / Official Government Registry
        </a>
      </div>
    </section>
  );
}

// ─── Not Found Card ──────────────────────────────────────────────────────────

function NotFoundCard() {
  return (
    <section
      className="mt-5 rounded-xl border border-red-200 bg-white p-5 shadow-sm sm:p-7"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-red-800">No matching record found</h2>
          <p className="mt-1 text-sm text-gray-600">
            Check the number and try again. This demo only includes selected sample records.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Main Form ───────────────────────────────────────────────────────────────

export default function VerificationForm() {
  const [mode, setMode] = useState<Mode>("license");
  const [inputMethod, setInputMethod] = useState<InputMethod>("manual");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<VerifyRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const placeholder = mode === "license" ? "e.g. CM/L-1234567890" : "e.g. A1B2C3";

  function runLookup(input: string) {
    setChecked(true);
    const normalized = input.trim().toUpperCase();
    const record = RESULTS[mode];
    setResult(normalized === record.value.toUpperCase() ? record : null);
  }

  function verify() {
    runLookup(value);
  }

  function handleScanDecoded(decodedValue: string) {
    setValue(decodedValue);
    setScanMessage("QR code captured. Checking the identifier...");
    window.setTimeout(() => {
      setScanMessage("");
      runLookup(decodedValue);
    }, 700);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setValue("");
    setResult(null);
    setChecked(false);
    setScanMessage("");
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Input card */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-7">
        {/* Manual / Scan tabs */}
        <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Verification method">
          <button
            type="button"
            role="tab"
            aria-selected={inputMethod === "manual"}
            onClick={() => setInputMethod("manual")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              inputMethod === "manual"
                ? "bg-white text-[var(--color-navy)] shadow-sm"
                : "text-gray-500"
            }`}
          >
            Manual Entry
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inputMethod === "scan"}
            onClick={() => {
              setInputMethod("scan");
              setChecked(false);
              setResult(null);
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              inputMethod === "scan"
                ? "bg-white text-[var(--color-navy)] shadow-sm"
                : "text-gray-500"
            }`}
          >
            Scan QR Code
          </button>
        </div>

        {/* ISI License / HUID sub-tabs */}
        <div className="mt-6 flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => switchMode("license")}
            className={`-mb-px flex-1 border-b-2 px-3 pb-3 text-sm font-semibold ${
              mode === "license"
                ? "border-[var(--color-navy)] text-[var(--color-navy)]"
                : "border-transparent text-gray-500"
            }`}
          >
            ISI License
          </button>
          <button
            type="button"
            onClick={() => switchMode("huid")}
            className={`-mb-px flex-1 border-b-2 px-3 pb-3 text-sm font-semibold ${
              mode === "huid"
                ? "border-[var(--color-navy)] text-[var(--color-navy)]"
                : "border-transparent text-gray-500"
            }`}
          >
            HUID
          </button>
        </div>

        {/* Manual entry panel */}
        {inputMethod === "manual" ? (
          <div className="pt-6">
            <label htmlFor="verification-value" className="text-sm font-semibold text-gray-900">
              {mode === "license" ? "ISI license number" : "Hallmark Unique ID"}
            </label>
            <p className="mt-1 text-sm text-gray-600">
              Enter the number exactly as shown on the product or certificate.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="verification-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") verify();
                }}
                placeholder={placeholder}
                className="h-11 flex-1 rounded-lg border border-gray-300 px-3 font-mono text-sm uppercase shadow-sm placeholder:normal-case placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
              />
              <button
                type="button"
                onClick={verify}
                disabled={!value.trim()}
                className="h-11 rounded-lg bg-[var(--color-navy)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-navy-light)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Verify
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Demo lookup: try{" "}
              {mode === "license" ? (
                <code className="font-mono">CM/L-1234567890</code>
              ) : (
                <code className="font-mono">A1B2C3</code>
              )}
              .
            </p>
          </div>
        ) : (
          /* QR scan panel */
          <div>
            <QrScanner onDecoded={handleScanDecoded} />
            {scanMessage && (
              <p
                className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-800"
                role="status"
              >
                {scanMessage}
              </p>
            )}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Demo QR codes</p>
              <p className="mt-1 text-xs text-gray-600">
                Scan one of these with the camera to test the local lookup.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(
                  [
                    ["License", "CM/L-1234567890", "/demo-qr/license.svg"],
                    ["HUID", "A1B2C3", "/demo-qr/huid.svg"],
                    ["Invalid", "INVALID-DEMO-ID", "/demo-qr/license-alt.svg"],
                  ] as const
                ).map(([label, id, src]) => (
                  <div key={id} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center">
                    <Image
                      src={src}
                      alt={`${label} demo QR code`}
                      width={220}
                      height={220}
                      className="mx-auto aspect-square w-full max-w-32"
                    />
                    <p className="mt-1 text-xs font-semibold text-gray-800">{label}</p>
                    <p className="truncate font-mono text-[10px] text-gray-500">{id}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Result card */}
      {checked && (result ? <VerifyResultCard result={result} mode={mode} /> : <NotFoundCard />)}
    </div>
  );
}