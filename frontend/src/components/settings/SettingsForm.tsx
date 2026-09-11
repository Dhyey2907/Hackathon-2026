"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { Language } from "@/lib/i18n/strings";

type ThemeMode = "light" | "dark";

export default function SettingsForm() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("bis-sahayak-theme") as ThemeMode | null;
      if (savedTheme) return savedTheme;
      if (document.documentElement.classList.contains("dark") || document.body.classList.contains("dark")) {
        return "dark";
      }
    }
    return "light";
  });
  // The real interface language. This select used to keep its own copy in
  // local state, so choosing Hindi here changed nothing anywhere.
  const { language, setLanguage, t } = useLanguage();
  const [expiryReminders, setExpiryReminders] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("bis-sahayak-theme") as ThemeMode | null;
    if (savedTheme === "dark" || document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    }
  }, []);

  function markSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function handleThemeChange(newTheme: ThemeMode) {
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("bis-sahayak-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("bis-sahayak-theme", "light");
    }
    markSaved();
  }

  function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSubmitted(true);
    if (!password || password !== passwordConfirmation) return;
    setPassword("");
    setPasswordConfirmation("");
    setPasswordSubmitted(false);
    markSaved();
  }

  const passwordError =
    passwordSubmitted && !password
      ? t("settings.pwEmpty")
      : passwordSubmitted && password !== passwordConfirmation
      ? t("settings.pwMismatch")
      : "";

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">{t("settings.account")}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{t("settings.title")}</h1>
          <p className="mt-2 text-sm text-gray-600">{t("settings.subtitle")}</p>
        </div>

        <div className="space-y-5">
          {/* ── Theme Section (Midnight Espresso / Butter-Cream) ──────────── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-[var(--color-navy)]">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t("settings.theme")}</h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">{t("settings.themeHint")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Light Mode: Butter-Cream */}
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`group relative flex flex-col rounded-xl border p-4 text-left transition-all ${
                  theme === "light"
                    ? "border-[var(--color-navy)] bg-[rgba(176,196,222,0.18)] shadow-sm ring-2 ring-[var(--color-navy)]/30"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDFBF7] border border-[#3D2B1F]/20 text-[#3D2B1F] shadow-sm">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="4" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{t("settings.lightName")}</h3>
                      <span className="text-[11px] font-medium text-gray-500">{t("settings.lightMode")}</span>
                    </div>
                  </div>
                  {theme === "light" && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-white text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {t("settings.lightDesc")}
                </p>
                {/* Palette Swatches */}
                <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-gray-100">
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-gray-300"
                    style={{ backgroundColor: "#FDFBF7" }}
                    title="Butter-Cream (#FDFBF7)"
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#3D2B1F" }}
                    title="Muted Espresso (#3D2B1F)"
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#B0C4DE" }}
                    title="Dusty Powder Blue (#B0C4DE)"
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#DCAEB5" }}
                    title="Dusty Rose (#DCAEB5)"
                  />
                </div>
              </button>

              {/* Dark Mode: Midnight Espresso */}
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`group relative flex flex-col rounded-xl border p-4 text-left transition-all ${
                  theme === "dark"
                    ? "border-[var(--color-navy)] bg-[rgba(122,139,156,0.2)] shadow-sm ring-2 ring-[var(--color-navy)]/30"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1614] border border-[#EDE7E0]/30 text-[#EDE7E0] shadow-sm">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{t("settings.darkName")}</h3>
                      <span className="text-[11px] font-medium text-gray-500">{t("settings.darkMode")}</span>
                    </div>
                  </div>
                  {theme === "dark" && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-[#1A1614] text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {t("settings.darkDesc")}
                </p>
                {/* Palette Swatches */}
                <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-gray-100">
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#1A1614" }}
                    title="Charcoal-Brown (#1A1614)"
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#EDE7E0" }}
                    title="Soft Oat-Cream (#EDE7E0)"
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#7A8B9C" }}
                    title="Muted Steel Blue (#7A8B9C)"
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "#A67C84" }}
                    title="Dusty Mauve (#A67C84)"
                  />
                </div>
              </button>
            </div>
          </section>

          {/* ── Preferences Section (Language) ─────────────────────────────── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">{t("settings.prefs")}</h2>
              <p className="mt-1 text-sm text-gray-600">{t("settings.prefsHint")}</p>
            </div>
            <div>
              <label htmlFor="settings-language" className="text-sm font-semibold text-gray-900">
                {t("settings.language")}
              </label>
              <select
                id="settings-language"
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value as Language);
                  markSaved();
                }}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">{t("settings.languageHint")}</p>
            </div>
          </section>

          {/* ── Notifications Section ─────────────────────────────────────── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">{t("settings.notifications")}</h2>
              <p className="mt-1 text-sm text-gray-600">{t("settings.notificationsHint")}</p>
            </div>
            <div className="divide-y divide-gray-100">
              <label className="flex cursor-pointer items-center justify-between gap-4 py-4 first:pt-0">
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{t("settings.expiry")}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {t("settings.expiryHint")}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={expiryReminders}
                  onChange={(event) => {
                    setExpiryReminders(event.target.checked);
                    markSaved();
                  }}
                  className="h-5 w-5 shrink-0 accent-[var(--color-navy)]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 py-4 last:pb-0">
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{t("settings.updates")}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {t("settings.updatesHint")}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={productUpdates}
                  onChange={(event) => {
                    setProductUpdates(event.target.checked);
                    markSaved();
                  }}
                  className="h-5 w-5 shrink-0 accent-[var(--color-navy)]"
                />
              </label>
            </div>
          </section>

          {/* ── Account Section ───────────────────────────────────────────── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">{t("settings.account")}</h2>
              <p className="mt-1 text-sm text-gray-600">{t("settings.accountHint")}</p>
            </div>
            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="text-sm font-semibold text-gray-900">
                  {t("settings.changePw")}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("settings.newPw")}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  {t("settings.confirmPw")}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder={t("settings.confirmPw")}
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
                />
                {passwordError && <p className="mt-1 text-xs text-red-700">{passwordError}</p>}
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-[var(--color-navy)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"
                >
                  {t("settings.updatePw")}
                </button>
                {saved && (
                  <p className="text-sm font-medium text-green-700" role="status" aria-live="polite">
                    {t("settings.saved")}
                  </p>
                )}
              </div>
            </form>
            <div className="mt-7 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t("settings.deleteAccount")}</h3>
                <p className="mt-1 text-xs text-gray-500">{t("settings.deleteHint")}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {t("settings.deleteAccount")}
              </button>
            </div>
          </section>
        </div>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
          >
            <h2 id="delete-account-title" className="text-lg font-semibold text-gray-900">
              {t("settings.deleteTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {t("settings.deleteBody")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
