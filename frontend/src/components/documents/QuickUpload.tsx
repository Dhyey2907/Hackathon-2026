"use client";

/**
 * Add a document without leaving the dashboard.
 *
 * The button here used to be a link to /documents, which meant the most
 * prominent call to action on the home page did not actually do the thing it
 * named. It now opens a picker and accepts a drop, and files land in the same
 * store the Documents screen reads.
 *
 * Said plainly in the interface, because it changes what the user should
 * expect: the file stays in this browser. Nothing is uploaded to BIS, nothing
 * is sent to a server, and the assistant does not read the contents. It is a
 * place to keep licences and test reports where their expiry can be tracked.
 */

import { useRef, useState } from "react";
import { useDocuments, type DocumentCategory } from "./DocumentProvider";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const CATEGORIES: DocumentCategory[] = ["License", "Test Report", "Certificate", "Other"];

/** Anything bigger is almost certainly not a certificate or a test report. */
const MAX_BYTES = 20 * 1024 * 1024;

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx";

/**
 * `inline` renders the drop zone open and without a close button, for use
 * inside a form - onboarding - rather than behind a dashboard button.
 */
export default function QuickUpload({ inline = false }: { inline?: boolean } = {}) {
  const { t } = useLanguage();
  const { addDocument } = useDocuments();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(inline);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>("License");
  const [expiry, setExpiry] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function accept(files: FileList | null) {
    if (!files || files.length === 0) return;
    const names: string[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        rejected.push(file.name);
        continue;
      }
      addDocument(file, category, expiry || undefined);
      names.push(file.name);
    }

    setAdded(names);
    // Named rather than counted: "2 files were too large" leaves the user
    // hunting for which two.
    setError(rejected.length ? `${t("upload.tooLarge")}: ${rejected.join(", ")}` : null);
    setExpiry("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        id="dashboard-upload-btn"
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        {t("upload.button")}
      </button>
    );
  }

  return (
    <div className={inline ? "w-full" : "w-full sm:max-w-sm"}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-4 text-center transition ${
          dragging
            ? "border-[var(--color-navy)] bg-[var(--color-navy-lighter)]"
            : "border-[var(--color-border)] bg-white"
        }`}
      >
        <p className="text-sm font-medium text-gray-900">{t("upload.dropHere")}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">{t("upload.formats")}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-left">
            <span className="text-[11px] font-semibold text-gray-500">{t("upload.category")}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as DocumentCategory)}
              className="mt-0.5 h-9 w-full rounded-lg border border-gray-300 px-2 text-xs focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
            >
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {t(`upload.category.${option.replace(/\s/g, "")}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-left">
            <span className="text-[11px] font-semibold text-gray-500">{t("upload.expiry")}</span>
            <input
              type="date"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="mt-0.5 h-9 w-full rounded-lg border border-gray-300 px-2 text-xs focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
            />
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => accept(event.target.files)}
          className="sr-only"
        />

        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-navy-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
          >
            {t("upload.choose")}
          </button>
          {!inline && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
            >
              {t("upload.close")}
            </button>
          )}
        </div>
      </div>

      {added.length > 0 && (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-900">
          {t("upload.added")}: {added.join(", ")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          {error}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{t("upload.privacy")}</p>
    </div>
  );
}
