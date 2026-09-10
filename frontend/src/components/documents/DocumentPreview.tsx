"use client";

import Link from "next/link";
import { useDocuments } from "./DocumentProvider";
import ExpiryBadge from "./ExpiryBadge";
import EmptyState from "@/components/EmptyState";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export default function DocumentPreview({ id }: { id: string }) {
  const { getDocument, deleteDocument } = useDocuments();
  const document = getDocument(id);

  if (!document) {
    return (
      <main className="flex-1 bg-transparent" id="main-content">
        <div className="mx-auto max-w-xl px-4 py-16">
          <EmptyState
            title="Document not found"
            description="The document you are looking for may have been removed or does not exist in this session."
            actionLabel="Get Started"
            actionHref="/documents"
          />
        </div>
      </main>
    );
  }

  const isPdf = document.type === "PDF";
  const isImage = document.type === "Image";

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
              <div className="mt-3">
                <ExpiryBadge expiryDate={document.expiryDate} size="md" />
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

          {/* PDF preview */}
          {document.previewUrl && isPdf && (
            <iframe
              src={document.previewUrl}
              title={`Preview of ${document.name}`}
              className="mt-8 h-[560px] w-full rounded-lg border border-gray-200"
            />
          )}

          {/* Image preview */}
          {document.previewUrl && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.previewUrl}
              alt={`Preview of ${document.name}`}
              className="mx-auto mt-8 max-h-[560px] max-w-full rounded-lg border border-gray-200 object-contain"
            />
          )}

          {/* Fallback for other file types */}
          {(!document.previewUrl || (!isPdf && !isImage)) && (
            <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
              <p className="font-semibold text-gray-900">Preview unavailable for this local record</p>
              <p className="mt-2 text-sm text-gray-600">
                The metadata is available above. A backend document viewer can be connected later.
              </p>
              <button
                type="button"
                onClick={() => window.alert("Mock download: this document is only available in the current browser session.")}
                className="mt-5 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)]"
              >
                Download mock file
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
