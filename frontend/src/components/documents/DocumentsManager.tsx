"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import T from "@/components/i18n/T";
import { categoryKey, fill, formatDate as formatDateIn } from "@/lib/i18n/format";
import Link from "next/link";
import { Suspense, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentCategory, DocumentRecord, getExpiryStatus, useDocuments } from "./DocumentProvider";
import ExpiryBadge from "./ExpiryBadge";
import DocumentViewer, { StorageBadge } from "./DocumentViewer";
import EmptyState from "@/components/EmptyState";
import ScrollOverHero from "@/components/ScrollOverHero";


const CATEGORIES: DocumentCategory[] = ["License", "Test Report", "Certificate", "Other"];
const ALL_CATEGORIES = ["All", ...CATEGORIES] as const;
type CategoryFilter = (typeof ALL_CATEGORIES)[number];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lower priority number = surfaces higher in the sorted list. */
function expiryPriority(doc: DocumentRecord): number {
  const { status } = getExpiryStatus(doc.expiryDate);
  if (status === "expired") return 0;
  if (status === "expiring-soon") return 1;
  if (status === "valid") return 2;
  return 3; // none
}

function DocumentsManagerInner() {
  const { documents, addDocument, deleteDocument, savesToAccount } = useDocuments();
  const { t, language } = useLanguage();
  const formatDate = (date: string) => formatDateIn(date, language);
  // Categories are stored in English; only their label follows the language.
  const catLabel = (category: string) => (category === "All" ? t("docs.all") : t(categoryKey(category)));
  // Real progress now: true while any file is still on its way to the account.
  const uploading = documents.some((d) => d.syncing);
  const inputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const searchParams = useSearchParams();


  // Upload form state
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>("Other");
  const [expiryDateInput, setExpiryDateInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Filter state — pre-initialised from ?filter= query param
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("All");
  const [showExpiringSoon, setShowExpiringSoon] = useState(() => searchParams.get("filter") === "expiring");

  // "valid" filter: when ?filter=valid, hide expired/expiring docs
  const filterValid = searchParams.get("filter") === "valid";

  function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setUploadMessage(fill(t("docs.tooLarge"), { name: file.name }));
      return;
    }
    const newDoc = addDocument(file, category, expiryDateInput || undefined);
    setUploadMessage(
      fill(t(savesToAccount ? "docs.uploadingAccount" : "docs.savedBrowser"), { name: file.name }),
    );
    setExpiryDateInput("");
    setSelectedId(newDoc.id);
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
  }

  // All filters compose together
  const filtered = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesQuery = doc.name.toLowerCase().includes(query.trim().toLowerCase());
        const matchesCategory = filterCategory === "All" || doc.category === filterCategory;
        const matchesExpiry = !showExpiringSoon || (() => {
          const { status } = getExpiryStatus(doc.expiryDate);
          return status === "expired" || status === "expiring-soon";
        })();
        const matchesValid = !filterValid || (() => {
          const { status } = getExpiryStatus(doc.expiryDate);
          return status === "valid" || status === "none";
        })();
        return matchesQuery && matchesCategory && matchesExpiry && matchesValid;
      })
      .sort((a, b) => {
        const pa = expiryPriority(a);
        const pb = expiryPriority(b);
        if (pa !== pb) return pa - pb;
        if (pa <= 1) {
          const { daysLeft: da } = getExpiryStatus(a.expiryDate);
          const { daysLeft: db } = getExpiryStatus(b.expiryDate);
          return (da ?? 0) - (db ?? 0);
        }
        return b.uploadedAt.localeCompare(a.uploadedAt);
      });
  }, [documents, query, filterCategory, showExpiringSoon, filterValid]);

  // Selected document for Split-Pane view
  const [selectedId, setSelectedId] = useState<string | null>(() => documents[0]?.id ?? null);

  const activeDoc = useMemo(() => {
    if (selectedId) {
      const found = documents.find((d) => d.id === selectedId);
      if (found) return found;
    }
    return filtered[0] ?? documents[0] ?? null;
  }, [documents, filtered, selectedId]);

  const expiringSoonCount = documents.filter((d) => {
    const { status } = getExpiryStatus(d.expiryDate);
    return status === "expired" || status === "expiring-soon";
  }).length;


  return (
    <main ref={mainRef} className="flex-1 overflow-y-auto bg-transparent" id="main-content">

      {/* ── Atmospheric hero with peeking blur: 8px → 0px on scroll */}
      <ScrollOverHero
        eyebrow={t("docs.heroEyebrow")}
        title={t("nav.documents")}
        subtitle={t("docs.heroSubtitle")}
        scrollContainerRef={mainRef}
        startBlur={8}
        endBlur={0}
      />

      <div className="relative z-10 mx-auto -mt-8 w-full max-w-7xl px-4 pb-8 pt-0 sm:px-6 lg:px-8">


        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#3D2B1F]/60">{t("docs.workspace")}</p>
            <h1 className="mt-1 text-2xl font-bold text-[#3D2B1F]">{t("docs.vault")}</h1>
            <p className="mt-1.5 text-sm text-[#5C4A3E]">
              {t("docs.vaultHint")}
              {filterValid && (
                <span className="ml-2 inline-flex items-center rounded-full bg-[#B0C4DE]/30 border border-[#B0C4DE]/50 px-2.5 py-0.5 text-[10px] font-semibold text-[#3D2B1F]">
                  {t("docs.activeOnly")}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowUploadDrawer((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3D2B1F] px-4 py-2.5 text-sm font-semibold text-[#FDFBF7] shadow-sm transition hover:bg-[#4E382A] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#B0C4DE]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{showUploadDrawer ? t("docs.hideUpload") : t("docs.upload")}</span>
            </button>
            <div className="text-right">
              <span className="block text-sm font-semibold text-[#3D2B1F]">
                {fill(t("docs.records"), { n: documents.length })}
              </span>
              {expiringSoonCount > 0 && (
                <span className="text-xs font-semibold text-[#DCAEB5]">
                  {fill(t("docs.needAttention"), { n: expiringSoonCount })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Upload Drawer (Collapsible) ──────────────────────────────── */}
        {showUploadDrawer && (
          <section className="mb-6 rounded-2xl border border-white/50 bg-[#FDFBF7]/90 p-5 shadow-sm backdrop-blur-xl sm:p-6 transition-all animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#3D2B1F]">{t("docs.uploadTitle")}</h2>
                <p className="mt-0.5 text-xs text-[#5C4A3E]">{t("upload.privacy")}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#5C4A3E]">{t("upload.category")}</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                    className="h-10 rounded-lg border border-white/60 bg-[#FDFBF7]/90 px-3 text-sm text-[#3D2B1F] focus:border-[#B0C4DE] focus:outline-none focus:ring-2 focus:ring-[#B0C4DE]/25"
                  >
                    {CATEGORIES.map((item) => <option key={item} value={item}>{catLabel(item)}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#5C4A3E]">
                    {t("docs.expiry")} <span className="font-normal text-[#8C7B6F]">{t("common.optional")}</span>
                  </span>
                  <input
                    type="date"
                    value={expiryDateInput}
                    onChange={(e) => setExpiryDateInput(e.target.value)}
                    className="h-10 rounded-lg border border-white/60 bg-[#FDFBF7]/90 px-3 text-sm text-[#3D2B1F] focus:border-[#B0C4DE] focus:outline-none focus:ring-2 focus:ring-[#B0C4DE]/25"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="h-10 rounded-lg bg-[#3D2B1F] px-4 text-sm font-semibold text-[#FDFBF7] hover:bg-[#4E382A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("docs.browse")}
                </button>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,.md,.csv"
              className="sr-only"
              onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
              className={`mt-4 flex min-h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#B0C4DE] ${
                isDragging
                  ? "border-[#B0C4DE] bg-[#B0C4DE]/20"
                  : "border-[#3D2B1F]/20 bg-[rgba(61,43,31,0.02)] hover:border-[#B0C4DE] hover:bg-[#B0C4DE]/10"
              }`}
            >
              <svg className="h-6 w-6 text-[#3D2B1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" />
              </svg>
              <span className="mt-1.5 text-sm font-semibold text-[#3D2B1F]">{t("upload.dropHere")}</span>
              <span className="text-xs text-[#8C7B6F]">{t("upload.formats")}</span>
            </button>

            {uploadMessage && (
              <p className="mt-2 text-xs font-semibold text-[#3D2B1F]" role="status" aria-live="polite">
                {uploadMessage}
              </p>
            )}
          </section>
        )}

        {/* ── Split-Pane Layout (List Left, Preview Right) ─────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">

          {/* ── LEFT PANE: Document List & Filters (5 cols) ──────────── */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <section className="rounded-2xl border border-white/50 bg-[#FDFBF7]/90 p-5 shadow-sm backdrop-blur-xl">
              {/* Search & Urgency toggle */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8C7B6F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3m2.3-5.7a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                  </svg>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("docs.search")}
                    className="h-9 w-full rounded-lg border border-white/60 bg-[#FDFBF7]/90 pl-9 pr-3 text-sm text-[#3D2B1F] placeholder:text-[#8C7B6F] focus:border-[#B0C4DE] focus:outline-none focus:ring-2 focus:ring-[#B0C4DE]/25"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExpiringSoon((v) => !v)}
                    aria-pressed={showExpiringSoon}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#B0C4DE] ${
                      showExpiringSoon
                        ? "bg-[#DCAEB5] text-[#3D2B1F] shadow-sm font-bold"
                        : "border border-white/60 bg-[#DCAEB5]/20 text-[#3D2B1F] hover:bg-[#DCAEB5]/35"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#3D2B1F]/80" />
                    {t("docs.expiringSoon")}
                    {expiringSoonCount > 0 && (
                      <span className="rounded-full bg-white/40 px-1.5 py-0.2 text-[10px] font-bold">
                        {expiringSoonCount}
                      </span>
                    )}
                  </button>

                  <span className="text-xs text-[#8C7B6F]">
                    {fill(t("docs.countOf"), { a: filtered.length, b: documents.length })}
                  </span>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label={t("docs.filterCategory")}>
                  {ALL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCategory(cat)}
                      aria-pressed={filterCategory === cat}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-[#B0C4DE] ${
                        filterCategory === cat
                          ? "bg-[#3D2B1F] text-[#FDFBF7]"
                          : "border border-white/60 bg-[#FDFBF7]/70 text-[#5C4A3E] hover:border-[#B0C4DE] hover:text-[#3D2B1F]"
                      }`}
                    >
                      {catLabel(cat)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* List items */}
            <div className="space-y-3" role="list" aria-label={t("nav.documents")}>
              {filtered.length > 0 ? (
                filtered.map((doc) => {
                  const isSelected = activeDoc?.id === doc.id;
                  const { status } = getExpiryStatus(doc.expiryDate);
                  const isUrgent = status === "expired" || status === "expiring-soon";

                  return (
                    <article
                      key={doc.id}
                      onClick={() => setSelectedId(doc.id)}
                      role="listitem"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(doc.id); }}
                      className={`group relative flex cursor-pointer flex-col rounded-2xl border p-4 shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#B0C4DE] ${
                        isSelected
                          ? "border-[#3D2B1F]/30 bg-[#FDFBF7]/95 ring-1 ring-[#3D2B1F]/20 shadow-md"
                          : "border-white/50 bg-[#FDFBF7]/90 hover:border-[#B0C4DE]/60"
                      } ${isUrgent ? "border-l-4 border-l-[#DCAEB5]" : ""}`}
                    >
                      {/* Active indicator bar */}
                      {isSelected && (
                        <span
                          className="absolute -left-1 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-[#3D2B1F]"
                          aria-hidden="true"
                        />
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(176,196,222,0.3)] text-[10px] font-bold text-[#3D2B1F]">
                            {doc.type}
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-bold text-[#3D2B1F] group-hover:text-[#4E382A]">
                              {doc.name}
                            </h2>
                            <p className="flex items-center gap-1.5 text-xs text-[#8C7B6F]">
                              {catLabel(doc.category)} · {formatSize(doc.size)}
                              {/* An example row the app ships with. Left
                                  unmarked it sits beside a real licence and
                                  reads as one. */}
                              {doc.isSample && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  {t("docs.sample")}
                                </span>
                              )}
                              <StorageBadge document={doc} />
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <ExpiryBadge expiryDate={doc.expiryDate} size="sm" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDocument(doc.id);
                            }}
                            className="rounded p-1 text-[#8C7B6F] hover:bg-[#DCAEB5]/30 hover:text-red-700 focus:outline-none"
                            aria-label={`${t("common.delete")} ${doc.name}`}
                            title={t("docs.deleteDoc")}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8C7B6F]">
                        <span>{fill(t("docs.uploadedOn"), { date: formatDate(doc.uploadedAt) })}</span>
                        {doc.expiryDate && (
                          <span className={isUrgent ? "font-semibold text-[#3D2B1F]" : ""}>
                            {fill(t("docs.expiresOn"), { date: formatDate(doc.expiryDate) })}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState
                  title={t("docs.noneFound")}
                  description={
                    showExpiringSoon
                      ? t("docs.noneExpiring")
                      : t("docs.noneMatch")
                  }
                  actionLabel={t("common.getStarted")}
                  onAction={() => {
                    setQuery("");
                    setFilterCategory("All");
                    setShowExpiringSoon(false);
                    inputRef.current?.click();
                  }}
                />
              )}
            </div>
          </div>

          {/* ── RIGHT PANE: Document Preview (7 cols) ─────────────────── */}
          <div className="lg:col-span-7">
            <section className="rounded-2xl border border-white/50 bg-[#FDFBF7]/90 p-6 shadow-sm backdrop-blur-xl lg:sticky lg:top-6 min-h-[580px] flex flex-col">
              {activeDoc ? (
                <>
                  {/* Preview Header */}
                  <div className="flex flex-col gap-4 border-b border-[#3D2B1F]/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[rgba(176,196,222,0.3)] px-2 py-0.5 text-xs font-semibold text-[#3D2B1F]">
                          {catLabel(activeDoc.category)}
                        </span>
                        <ExpiryBadge expiryDate={activeDoc.expiryDate} size="md" />
                      </div>
                      <h2 className="mt-2 break-words text-xl font-bold text-[#3D2B1F]">
                        {activeDoc.name}
                      </h2>
                      <p className="mt-1 text-xs text-[#5C4A3E]">
                        {fill(t("docs.meta"), { type: activeDoc.type, size: formatSize(activeDoc.size), date: formatDate(activeDoc.uploadedAt) })}
                        {activeDoc.expiryDate ? fill(t("docs.validUntil"), { date: formatDate(activeDoc.expiryDate) }) : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/documents/${activeDoc.id}`}
                        className="rounded-xl border border-white/60 bg-[#FDFBF7]/80 px-3 py-1.5 text-xs font-semibold text-[#3D2B1F] shadow-sm hover:border-[#B0C4DE] hover:bg-[#B0C4DE]/20"
                        title={t("docs.fullViewTitle")}
                      >
                        {t("docs.fullView")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteDocument(activeDoc.id)}
                        className="rounded-xl border border-red-200/60 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        title={t("docs.deleteDoc")}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>

                  {/* Preview Body */}
                  <div className="mt-6 flex-1 flex flex-col justify-center">
                    <DocumentViewer document={activeDoc} />
                  </div>
                </>
              ) : (
                <div className="my-auto">
                  <EmptyState
                    title={t("docs.noneSelected")}
                    description={t("docs.noneSelectedHint")}
                    actionLabel={t("common.getStarted")}
                    onAction={() => inputRef.current?.click()}
                  />
                </div>
              )}
            </section>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function DocumentsManager() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 overflow-y-auto bg-transparent" id="main-content">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold text-[#3D2B1F]"><T k="docs.loading" /></p>
          </div>
        </main>
      }
    >
      <DocumentsManagerInner />
    </Suspense>
  );
}
