"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingData, useAuth, UserType } from "./AuthProvider";
import QuickUpload from "@/components/documents/QuickUpload";

const CATEGORIES = ["Electronics", "Toys", "Food", "Cement", "Helmets & PPE", "Other"];
const ACCOUNT_OPTIONS: { value: UserType; title: string; description: string; icon: string }[] = [
  { value: "consumer", title: "Consumer", description: "I want to check products, verify certifications, or learn about standards", icon: "✓" },
  { value: "existing_business", title: "Running a business", description: "My business is already operating and I need standards/certification guidance", icon: "▣" },
  { value: "new_business", title: "Starting a business", description: "I'm setting up a new business and need to understand what standards apply", icon: "↗" },
];

const inputClass = "mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20";
const labelClass = "text-sm font-semibold text-gray-900";

function Field({ label, id, value, onChange, placeholder = "" }: { label: string; id: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div><label htmlFor={id} className={labelClass}>{label}</label><input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} /></div>;
}

function SelectField({ label, id, value, onChange, options }: { label: string; id: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <div><label htmlFor={id} className={labelClass}>{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">Select an option</option>{options.map((option) => <option key={option}>{option}</option>)}</select></div>;
}

// Files added here land in the document vault, in this browser, where the
// dashboard reads them for expiry tracking. Optional: signup must not stall
// on a missing scan.
function DocumentsField({ label, hint }: { label: string; hint: string }) {
  return <div><p className={labelClass}>{label}</p><p className="mt-1 text-xs text-gray-500">{hint}</p><div className="mt-2"><QuickUpload inline /></div></div>;
}

function FormShell({ title, description, children, onSubmit, submitLabel }: { title: string; description: string; children: React.ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel: string }) {
  return <section className="w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-9"><div className="text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold tracking-tight text-white">BIS</div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-navy)]">A little more detail</p><h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1><p className="mt-2 text-sm text-gray-600">{description}</p></div><form onSubmit={onSubmit} className="mt-8 space-y-5">{children}<button type="submit" className="h-11 w-full rounded-lg bg-[var(--color-navy)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2">{submitLabel}</button></form></section>;
}

export default function Onboarding() {
  const router = useRouter();
  const { saveOnboardingData, completeOnboarding } = useAuth();
  const [selected, setSelected] = useState<UserType | null>(null);
  const [data, setData] = useState<OnboardingData>({});
  const [roadmap, setRoadmap] = useState(false);
  const update = (key: keyof OnboardingData) => (value: string) => setData((current) => ({ ...current, [key]: value }));

  function selectType(userType: UserType) {
    setSelected(userType);
    setData({});
  }

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    completeOnboarding(selected, data);
    router.replace("/chat");
  }

  function buildRoadmap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    saveOnboardingData(selected, data);
    setRoadmap(true);
  }

  function proceedFromRoadmap() {
    if (selected) {
      completeOnboarding(selected, data);
      router.replace("/chat");
    }
  }

  if (!selected) return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><section className="w-full max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-10"><div className="mx-auto max-w-xl text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold tracking-tight text-white">BIS</div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-navy)]">Personalise your experience</p><h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Which of these best describes you?</h1><p className="mt-3 text-sm text-gray-600">Choose one option to help BIS Sahayak tailor the guidance you see.</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{ACCOUNT_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => selectType(option.value)} className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-navy)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-lg font-semibold text-[var(--color-navy)]">{option.icon}</span><span className="mt-5 block text-base font-semibold text-gray-900">{option.title}</span><span className="mt-2 block text-sm leading-6 text-gray-600">{option.description}</span></button>)}</div><p className="mt-7 text-center text-xs text-gray-500">Your answers stay in this mock account profile.</p></section></main>;

  if (roadmap) return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><section className="w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-9"><div className="text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-white">✓</div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-navy)]">Your first roadmap</p><h1 className="mt-2 text-2xl font-bold text-gray-900">Building your BIS starting roadmap</h1><p className="mt-2 text-sm text-gray-600">A mock starting point for {data.productName || "your product"}.</p></div><ol className="mt-8 space-y-4">{[["Product", data.productName || "Your product"], ["Potentially applicable standards", data.productDescription?.toLowerCase().includes("cement") ? "IS 269:2015 · IS 456:2000" : "IS 16102 (Part 1):2012 · IS 302 (Part 1):2008"], ["Certification information", "ISI mark scheme — factory + product testing"], ["Testing information", "Temperature rise, insulation resistance, leakage current"], ["Documents to prepare", "Product drawings, BOM, factory test setup"], ["Next steps", "Apply for BIS licence, submit samples to a recognised lab"]].map(([label, value], index) => <li key={label} className="relative flex gap-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white">{index + 1}</span><div><p className="text-sm font-semibold text-gray-900">{label}</p><p className="mt-1 text-sm leading-6 text-gray-600">{value}</p></div></li>)}</ol><button type="button" onClick={proceedFromRoadmap} className="mt-8 h-11 w-full rounded-lg bg-[var(--color-navy)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2">Proceed to chat</button></section></main>;

  if (selected === "consumer") return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><FormShell title="Tell us what you're looking for" description="This helps us make your first BIS Sahayak conversation more useful." onSubmit={finish} submitLabel="Continue"><Field label="Name" id="consumer-name" value={data.businessName ?? ""} onChange={update("businessName")} placeholder="Your name" /><SelectField label="What are you trying to do?" id="consumer-goal" value={data.consumerGoal ?? ""} onChange={update("consumerGoal")} options={["Verify a product/certificate", "Understand a standard", "Check a business's BIS licence", "General learning/research", "Other"]} /><SelectField label="Product category you're interested in (optional)" id="consumer-category" value={data.consumerCategory ?? ""} onChange={update("consumerCategory")} options={CATEGORIES} /></FormShell></main>;

  if (selected === "existing_business") return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><FormShell title="Let's understand your business" description="Tell us about your current operations and standards needs." onSubmit={finish} submitLabel="Continue"><Field label="Business name" id="business-name" value={data.businessName ?? ""} onChange={update("businessName")} /><SelectField label="Business type" id="business-type" value={data.businessType ?? ""} onChange={update("businessType")} options={["Manufacturer", "Importer", "Retailer", "Testing laboratory", "Other"]} /><Field label="Industry" id="business-industry" value={data.industry ?? ""} onChange={update("industry")} /><Field label="Product categories" id="business-products" value={data.productCategories ?? ""} onChange={update("productCategories")} placeholder="Electronics, cement, toys..." /><Field label="Existing BIS certifications" id="business-certifications" value={data.certifications ?? ""} onChange={update("certifications")} placeholder="ISI licence numbers, if any" /><Field label="Existing standards you follow" id="business-standards" value={data.standards ?? ""} onChange={update("standards")} /><DocumentsField label="Upload your documents (optional)" hint="BIS licences, certificates of conformity, test reports - set an expiry date and the dashboard will warn you before it passes." /></FormShell></main>;

  return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><FormShell title="Tell us about your new business" description="We’ll turn this into a practical starting roadmap." onSubmit={buildRoadmap} submitLabel="Build my roadmap"><Field label="Business name" id="new-business-name" value={data.businessName ?? ""} onChange={update("businessName")} /><Field label="Industry" id="new-industry" value={data.industry ?? ""} onChange={update("industry")} /><Field label="Product name" id="new-product-name" value={data.productName ?? ""} onChange={update("productName")} /><SelectField label="Production status" id="production-status" value={data.productionStatus ?? ""} onChange={update("productionStatus")} options={["Prototype", "Pilot", "Ready to manufacture"]} /><div><label htmlFor="product-description" className={labelClass}>Product description</label><textarea id="product-description" value={data.productDescription ?? ""} onChange={(event) => update("productDescription")(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20" /></div><DocumentsField label="Upload product documents (optional)" hint="Drawings, specifications or any test reports you already have. You can add more later from Documents." /></FormShell></main>;
}
