"use client";

import Link from "next/link";
import { useDocuments } from "./DocumentProvider";
import ExpiryBadge from "./ExpiryBadge";
import DocumentViewer, { StorageBadge } from "./DocumentViewer";
import EmptyState from "@/components/EmptyState";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export default function DocumentPreview({ id }: { id: string }) {
  const { getDocument, deleteDocument, isLoading } = useDocuments();
  const document = getDocument(id);

  // Documents in the account arrive a moment after the page does; "not found"
  // before they have would be wrong.
  if (!document && isLoading) {
    return (
      <main className="flex-1 bg-transparent" id="main-content">
        <p className="mx-auto max-w-xl px-4 py-16 text-sm text-[var(--color-text-muted)]">Loading document…</p>
      </main>
    );
  }

  if (!document) {
    return (
      <main className="flex-1 bg-transparent" id="main-content">
        <div className="mx-auto max-w-xl px-4 py-16">
          <EmptyState
            title="Document not found"
            description="The document you are looking for may have been removed."
            actionLabel="Get Started"
            actionHref="/documents"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/documents" className="text-sm font-medium text-[var(--color-navy)]">
          ← Back to documents
        </Link>

        <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
                {document.category}
              </p>
              <h1 className="mt-1 break-words text-2xl font-bold text-gray-900">{document.name}</h1>
              <p className="mt-2 text-sm text-gray-500">
                {document.type} · {formatSize(document.size)} · Uploaded {formatDate(document.uploadedAt)}
                {document.expiryDate ? ` · Expires ${formatDate(document.expiryDate)}` : null}
              </p>
              {/* Expiry status badge — shown prominently on the detail page */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ExpiryBadge expiryDate={document.expiryDate} size="md" />
                <StorageBadge document={document} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { deleteDocument(document.id); }}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete
            </button>
          </div>

          <div className="mt-8">
            <DocumentViewer document={document} height={640} />
          </div>
        </section>
      </div>
    </main>
  );
}
