"use client";

import { useState } from "react";
import Image from "next/image";
import QrScanner from "./QrScanner";

type Mode = "license" | "huid";
type InputMethod = "manual" | "scan";

const RESULTS = {
  license: { value: "CM/L-1234567890", holder: "Lumina Electricals Pvt. Ltd.", product: "Self-ballasted LED lamps and luminaires", issued: "12 April 2024", validUntil: "11 April 2027", location: "Ahmedabad, Gujarat" },
  huid: { value: "A1B2C3", holder: "Shree Kalyan Jewellers", product: "22K gold necklace", issued: "08 February 2025", validUntil: "Hallmark record active", location: "Jaipur, Rajasthan" },
};

export default function VerificationForm() {
  const [mode, setMode] = useState<Mode>("license");
  const [inputMethod, setInputMethod] = useState<InputMethod>("manual");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<typeof RESULTS.license | null>(null);
  const [checked, setChecked] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const placeholder = mode === "license" ? "e.g. CM/L-1234567890" : "e.g. A1B2C3";
  function runLookup(input: string) {
    setChecked(true);
    const normalized = input.trim().toUpperCase();
    setResult(normalized === RESULTS[mode].value ? RESULTS[mode] : null);
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

  return <div className="mx-auto max-w-2xl"><section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-7"><div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Verification method"><button type="button" role="tab" aria-selected={inputMethod === "manual"} onClick={() => setInputMethod("manual")} className={`rounded-md px-3 py-2 text-sm font-semibold ${inputMethod === "manual" ? "bg-white text-[var(--color-navy)] shadow-sm" : "text-gray-500"}`}>Manual Entry</button><button type="button" role="tab" aria-selected={inputMethod === "scan"} onClick={() => { setInputMethod("scan"); setChecked(false); setResult(null); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${inputMethod === "scan" ? "bg-white text-[var(--color-navy)] shadow-sm" : "text-gray-500"}`}>Scan QR Code</button></div><div className="mt-6 flex border-b border-gray-200"><button type="button" onClick={() => switchMode("license")} className={`-mb-px flex-1 border-b-2 px-3 pb-3 text-sm font-semibold ${mode === "license" ? "border-[var(--color-navy)] text-[var(--color-navy)]" : "border-transparent text-gray-500"}`}>ISI License</button><button type="button" onClick={() => switchMode("huid")} className={`-mb-px flex-1 border-b-2 px-3 pb-3 text-sm font-semibold ${mode === "huid" ? "border-[var(--color-navy)] text-[var(--color-navy)]" : "border-transparent text-gray-500"}`}>HUID</button></div>{inputMethod === "manual" ? <div className="pt-6"><label htmlFor="verification-value" className="text-sm font-semibold text-gray-900">{mode === "license" ? "ISI license number" : "Hallmark Unique ID"}</label><p className="mt-1 text-sm text-gray-600">Enter the number exactly as shown on the product or certificate.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input id="verification-value" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") verify(); }} placeholder={placeholder} className="h-11 flex-1 rounded-lg border border-gray-300 px-3 font-mono text-sm uppercase shadow-sm placeholder:normal-case placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20" /><button type="button" onClick={verify} disabled={!value.trim()} className="h-11 rounded-lg bg-[var(--color-navy)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-navy-light)] disabled:cursor-not-allowed disabled:opacity-40">Verify</button></div><p className="mt-3 text-xs text-gray-500">Demo lookup: try {mode === "license" ? <code className="font-mono">CM/L-1234567890</code> : <code className="font-mono">A1B2C3</code>}.</p></div> : <div><QrScanner onDecoded={handleScanDecoded} />{scanMessage && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-800" role="status">{scanMessage}</p>}<div className="mt-6 border-t border-gray-100 pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Demo QR codes</p><p className="mt-1 text-xs text-gray-600">Scan one of these with the camera to test the local lookup.</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["License", "CM/L-1234567890", "/demo-qr/license.svg"], ["HUID", "A1B2C3", "/demo-qr/huid.svg"], ["Invalid", "INVALID-DEMO-ID", "/demo-qr/license-alt.svg"]].map(([label, id, src]) => <div key={id} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center"><Image src={src} alt={`${label} demo QR code`} width={220} height={220} className="mx-auto aspect-square w-full max-w-32" /><p className="mt-1 text-xs font-semibold text-gray-800">{label}</p><p className="truncate font-mono text-[10px] text-gray-500">{id}</p></div>)}</div></div></div>}</section>{checked && <section className={`mt-5 rounded-xl border bg-white p-5 shadow-sm sm:p-7 ${result ? "border-green-200" : "border-red-200"}`} aria-live="polite"><div className="flex items-start gap-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${result ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{result ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 4 4L19 7" /></svg> : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg>}</div><div><h2 className={`text-lg font-semibold ${result ? "text-green-800" : "text-red-800"}`}>{result ? "Record verified" : "No matching record found"}</h2><p className="mt-1 text-sm text-gray-600">{result ? "The details below match the local BIS verification record." : "Check the number and try again. This demo only includes selected sample records."}</p></div></div>{result && <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-gray-100 pt-5 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{mode === "license" ? "License number" : "HUID"}</dt><dd className="mt-1 font-mono text-sm font-semibold text-gray-900">{result.value}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Holder</dt><dd className="mt-1 text-sm font-medium text-gray-900">{result.holder}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product</dt><dd className="mt-1 text-sm text-gray-700">{result.product}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Location</dt><dd className="mt-1 text-sm text-gray-700">{result.location}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Issued</dt><dd className="mt-1 text-sm text-gray-700">{result.issued}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Validity</dt><dd className="mt-1 text-sm text-gray-700">{result.validUntil}</dd></div></dl>}</section>}</div>;
}