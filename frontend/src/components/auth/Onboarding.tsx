"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingData, useAuth, UserType } from "./AuthProvider";
import QuickUpload from "@/components/documents/QuickUpload";
import { useRoadmapProfile } from "@/components/roadmap/useRoadmapProfile";
import { guessKind, type MadeIn } from "@/lib/roadmap";

const CATEGORIES = ["Electronics", "Toys", "Food", "Cement", "Helmets & PPE", "Other"];
const ACCOUNT_OPTIONS: { value: UserType; title: string; description: string; icon: string }[] = [
  { value: "consumer", title: "Consumer", description: "I want to check products, verify certifications, or learn about standards", icon: "✓" },
  { value: "existing_business", title: "Running a business", description: "My business is already operating and I need standards/certification guidance", icon: "▣" },
  { value: "new_business", title: "Starting a business", description: "I'm setting up a new business and need to understand what standards apply", icon: "↗" },
];

/** Hindi labels for the options above; the saved values stay in English. */
const ONBOARDING_OPTIONS_HI: Record<string, string> = {
  "Verify a product/certificate": "किसी उत्पाद/प्रमाणपत्र का सत्यापन",
  "Understand a standard": "किसी मानक को समझना",
  "Check a business's BIS licence": "किसी व्यवसाय का BIS लाइसेंस जाँचना",
  "General learning/research": "सामान्य जानकारी/शोध",
  Other: "अन्य",
  Electronics: "इलेक्ट्रॉनिक्स",
  Toys: "खिलौने",
  Food: "खाद्य",
  Cement: "सीमेंट",
  "Helmets & PPE": "हेलमेट और PPE",
  Manufacturer: "निर्माता",
  Importer: "आयातक",
  Retailer: "खुदरा विक्रेता",
  "Testing laboratory": "परीक्षण प्रयोगशाला",
  Prototype: "प्रोटोटाइप",
  Pilot: "पायलट",
  "Ready to manufacture": "निर्माण के लिए तैयार",
};

const inputClass = "mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20";
const labelClass = "text-sm font-semibold text-gray-900";

function Field({ label, id, value, onChange, placeholder = "", required = false }: { label: string; id: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <div><label htmlFor={id} className={labelClass}>{label}</label><input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className={inputClass} /></div>;
}

function SelectField({ label, id, value, onChange, options, labels }: { label: string; id: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  const { t } = useLanguage();
  // Values stay in English - they are what gets saved - and only the label is translated.
  return <div><label htmlFor={id} className={labelClass}>{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">{t("common.selectOption")}</option>{options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}</select></div>;
}

// Files added here land in the document vault, in this browser, where the
// dashboard reads them for expiry tracking. Optional: signup must not stall
// on a missing scan.
function DocumentsField({ label, hint }: { label: string; hint: string }) {
  return <div><p className={labelClass}>{label}</p><p className="mt-1 text-xs text-gray-500">{hint}</p><div className="mt-2"><QuickUpload inline /></div></div>;
}

function FormShell({ title, description, children, onSubmit, submitLabel }: { title: string; description: string; children: React.ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel: string }) {
  const { t } = useLanguage();
  return <section className="w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-9"><div className="text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold tracking-tight text-white">BIS</div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-navy)]">{t("onb.moreDetail")}</p><h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1><p className="mt-2 text-sm text-gray-600">{description}</p></div><form onSubmit={onSubmit} className="mt-8 space-y-5">{children}<button type="submit" className="h-11 w-full rounded-lg bg-[var(--color-navy)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2">{submitLabel}</button></form></section>;
}

export default function Onboarding() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const { save: saveRoadmapProfile } = useRoadmapProfile();
  const { t, language } = useLanguage();
  const optionLabels = language === "hi" ? ONBOARDING_OPTIONS_HI : undefined;
  const [selected, setSelected] = useState<UserType | null>(null);
  const [data, setData] = useState<OnboardingData>({});
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

  // This used to end on a mock roadmap with hardcoded standards - IS 16102 and
  // IS 302 for anything that was not cement - shown to a new business as if it
  // applied to them. The Compliance Roadmap works out the scheme from what they
  // make and where, and its steps link to BIS's own pages, so hand over to it.
  function buildRoadmap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const product = (data.productName || data.productDescription || "").trim();
    if (!product) return;
    saveRoadmapProfile({
      product,
      madeIn: (data.madeIn === "abroad" ? "abroad" : "india") as MadeIn,
      kind: guessKind([data.productName, data.productDescription, data.industry].filter(Boolean).join(" ")),
    });
    completeOnboarding(selected, data);
    router.replace("/roadmap");
  }

  if (!selected) return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><section className="w-full max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-10"><div className="mx-auto max-w-xl text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold tracking-tight text-white">BIS</div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-navy)]">{t("onb.personalise")}</p><h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{t("onb.whichDescribes")}</h1><p className="mt-3 text-sm text-gray-600">{t("onb.chooseOne")}</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{ACCOUNT_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => selectType(option.value)} className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-navy)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-lg font-semibold text-[var(--color-navy)]">{option.icon}</span><span className="mt-5 block text-base font-semibold text-gray-900">{t(`onb.${option.value}.title`)}</span><span className="mt-2 block text-sm leading-6 text-gray-600">{t(`onb.${option.value}.desc`)}</span></button>)}</div><p className="mt-7 text-center text-xs text-gray-500">{t("onb.stays")}</p></section></main>;

  if (selected === "consumer") return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><FormShell title={t("onb.consumerTitle")} description={t("onb.consumerDesc")} onSubmit={finish} submitLabel={t("common.continue")}><Field label={t("common.name")} id="consumer-name" value={data.businessName ?? ""} onChange={update("businessName")} placeholder={t("onb.yourName")} /><SelectField label={t("onb.goal")} id="consumer-goal" value={data.consumerGoal ?? ""} onChange={update("consumerGoal")} options={["Verify a product/certificate", "Understand a standard", "Check a business's BIS licence", "General learning/research", "Other"]} labels={optionLabels} /><SelectField label={t("onb.category")} id="consumer-category" value={data.consumerCategory ?? ""} onChange={update("consumerCategory")} options={CATEGORIES} labels={optionLabels} /></FormShell></main>;

  if (selected === "existing_business") return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><FormShell title={t("onb.existingTitle")} description={t("onb.existingDesc")} onSubmit={finish} submitLabel={t("common.continue")}><Field label={t("onb.businessName")} id="business-name" value={data.businessName ?? ""} onChange={update("businessName")} /><SelectField label={t("onb.businessType")} id="business-type" value={data.businessType ?? ""} onChange={update("businessType")} options={["Manufacturer", "Importer", "Retailer", "Testing laboratory", "Other"]} labels={optionLabels} /><Field label={t("onb.industry")} id="business-industry" value={data.industry ?? ""} onChange={update("industry")} /><Field label={t("onb.productCategories")} id="business-products" value={data.productCategories ?? ""} onChange={update("productCategories")} placeholder={t("onb.productCategoriesPh")} /><Field label={t("onb.certs")} id="business-certifications" value={data.certifications ?? ""} onChange={update("certifications")} placeholder={t("onb.certsPh")} /><Field label={t("onb.standards")} id="business-standards" value={data.standards ?? ""} onChange={update("standards")} /><DocumentsField label={t("onb.uploadDocs")} hint={t("onb.uploadDocsHint")} /></FormShell></main>;

  return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><FormShell title={t("onb.newTitle")} description={t("onb.newDesc")} onSubmit={buildRoadmap} submitLabel={t("onb.build")}><Field label={t("onb.businessName")} id="new-business-name" value={data.businessName ?? ""} onChange={update("businessName")} /><Field label={t("onb.industry")} id="new-industry" value={data.industry ?? ""} onChange={update("industry")} /><Field label={t("onb.productName")} id="new-product-name" value={data.productName ?? ""} onChange={update("productName")} placeholder={t("onb.productNamePh")} required /><SelectField label={t("onb.productionStatus")} id="production-status" value={data.productionStatus ?? ""} onChange={update("productionStatus")} options={["Prototype", "Pilot", "Ready to manufacture"]} labels={optionLabels} /><div><label htmlFor="made-in" className={labelClass}>{t("onb.madeIn")}</label><select id="made-in" required value={data.madeIn ?? ""} onChange={(event) => update("madeIn")(event.target.value)} className={inputClass}><option value="">{t("common.selectOption")}</option><option value="india">{t("onb.inIndia")}</option><option value="abroad">{t("onb.abroad")}</option></select><p className="mt-1 text-xs text-gray-500">{t("onb.madeInHint")}</p></div><div><label htmlFor="product-description" className={labelClass}>{t("onb.description")}</label><textarea id="product-description" value={data.productDescription ?? ""} onChange={(event) => update("productDescription")(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20" /></div><DocumentsField label={t("onb.uploadProduct")} hint={t("onb.uploadProductHint")} /></FormShell></main>;
}
