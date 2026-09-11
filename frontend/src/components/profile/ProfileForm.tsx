"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useEffect, useState } from "react";
import { useAuth, OnboardingData, UserType } from "@/components/auth/AuthProvider";

const ACCOUNT_TYPES: { value: UserType; labelKey: string }[] = [
  { value: "consumer", labelKey: "onb.consumer.title" },
  { value: "existing_business", labelKey: "onb.existing_business.title" },
  { value: "new_business", labelKey: "onb.new_business.title" },
];

/** Onboarding answers, labelled with the question that collected them. */
const DETAIL_KEYS: Record<string, string> = {
  businessName: "onb.businessName",
  businessType: "onb.businessType",
  industry: "onb.industry",
  productCategories: "onb.productCategories",
  certifications: "onb.certs",
  standards: "onb.standards",
  productName: "onb.productName",
  productionStatus: "onb.productionStatus",
  productDescription: "onb.description",
  madeIn: "onb.madeIn",
  consumerGoal: "onb.goal",
  consumerCategory: "onb.categoryShort",
};

function initials(name: string, identifier: string) { const source = name.trim() || identifier.trim() || "BIS Sahayak"; return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export default function ProfileForm() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.identifier ?? "");
  const [userType, setUserType] = useState<UserType>(user?.userType ?? "consumer");
  const [details] = useState<OnboardingData>(user?.onboardingData ?? {});
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return; const timer = window.setTimeout(() => setSaved(false), 2600); return () => window.clearTimeout(timer); }, [saved]);
  const accountLabel = t(ACCOUNT_TYPES.find((type) => type.value === userType)?.labelKey ?? "onb.consumer.title");
  function saveProfile(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaved(true); }
  const detailEntries = Object.entries(details).filter(([, value]) => value);
  return <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content"><div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-7"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">{t("settings.account")}</p><h1 className="mt-1 text-2xl font-bold text-gray-900">{t("nav.profile")}</h1><p className="mt-2 text-sm text-gray-600">{t("prof.sub")}</p></div><div className="grid gap-5 lg:grid-cols-[220px_1fr]"><section className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-center shadow-sm"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-navy-lighter)] text-xl font-bold text-[var(--color-navy)]">{initials(name, email)}</div><h2 className="mt-4 truncate font-semibold text-gray-900">{name || t("prof.user")}</h2><p className="mt-1 truncate text-sm text-gray-500">{email}</p><span className="mt-4 inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{accountLabel}</span></section><section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8"><div className="mb-6"><h2 className="text-lg font-semibold text-gray-900">{t("prof.personal")}</h2><p className="mt-1 text-sm text-gray-600">{t("prof.local")}</p></div><form onSubmit={saveProfile} className="space-y-5"><div><label htmlFor="profile-name" className="text-sm font-semibold text-gray-900">{t("common.name")}</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20" /></div><div><label htmlFor="profile-email" className="text-sm font-semibold text-gray-900">{t("auth.identifier")}</label><input id="profile-email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20" /></div><div><label htmlFor="profile-account-type" className="text-sm font-semibold text-gray-900">{t("prof.accountType")}</label><select id="profile-account-type" value={userType} onChange={(event) => setUserType(event.target.value as UserType)} className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20">{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}</select></div>{detailEntries.length > 0 && <div className="rounded-lg border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-800">{t("prof.onboarding")}</p><dl className="mt-3 grid gap-3 sm:grid-cols-2">{detailEntries.map(([key, value]) => <div key={key}><dt className="text-xs font-semibold capitalize text-blue-800">{DETAIL_KEYS[key] ? t(DETAIL_KEYS[key]) : key.replace(/([A-Z])/g, " $1")}</dt><dd className="mt-1 text-sm text-blue-950">{value}</dd></div>)}</dl></div>}<div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm font-medium ${saved ? "text-green-700" : "text-transparent"}`} role="status" aria-live="polite">{t("prof.saved")}</p><button type="submit" className="h-11 rounded-lg bg-[var(--color-navy)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2">{t("prof.save")}</button></div></form></section></div></div></main>;
}
