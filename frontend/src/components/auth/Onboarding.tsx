"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, UserType } from "./AuthProvider";

const OPTIONS: { value: UserType; title: string; description: string; icon: string }[] = [
  { value: "consumer", title: "Consumer", description: "I want to check products, verify certifications, or learn about standards", icon: "✓" },
  { value: "existing_business", title: "Running a business", description: "My business is already operating and I need standards/certification guidance", icon: "▣" },
  { value: "new_business", title: "Starting a business", description: "I'm setting up a new business and need to understand what standards apply", icon: "↗" },
];

export default function Onboarding() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [selected, setSelected] = useState<UserType | null>(null);

  function handleSelect(userType: UserType) {
    setSelected(userType);
    completeOnboarding(userType);
    router.replace("/chat");
  }

  return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10" id="main-content"><section className="w-full max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-10"><div className="mx-auto max-w-xl text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold tracking-tight text-white">BIS</div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-navy)]">Personalise your experience</p><h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Which of these best describes you?</h1><p className="mt-3 text-sm text-gray-600">Choose one option to help BIS Sahayak tailor the guidance you see.</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => handleSelect(option.value)} disabled={selected !== null} className={`group rounded-xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-navy)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2 ${selected === option.value ? "border-[var(--color-navy)] bg-[var(--color-navy-lighter)]" : "border-gray-200 bg-white"}`}><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-lg font-semibold text-[var(--color-navy)]">{option.icon}</span><span className="mt-5 block text-base font-semibold text-gray-900">{option.title}</span><span className="mt-2 block text-sm leading-6 text-gray-600">{option.description}</span></button>)}</div><p className="mt-7 text-center text-xs text-gray-500">You can change this preference later in the full account experience.</p></section></main>;
}