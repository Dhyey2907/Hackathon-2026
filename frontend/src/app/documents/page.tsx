import type { Metadata } from "next";
import Link from "next/link";
import { RECENT_DOCUMENTS } from "@/lib/recents";

export const metadata: Metadata = { title: "Documents", description: "Review your mock uploaded documents." };

export default function DocumentsPage() {
  return <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content"><div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-7"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">Workspace</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Documents</h1><p className="mt-2 text-sm text-gray-600">Mock document records from your recent workspace activity.</p></div><section className="space-y-3">{RECENT_DOCUMENTS.map((document) => <Link key={document.id} href={`/documents/${document.id}`} className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition hover:border-[var(--color-navy)] hover:shadow-md"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-xs font-bold text-[var(--color-navy)]">{document.type}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{document.title}</span><span className="mt-1 block text-xs text-gray-500">Uploaded {document.uploadedAt}</span></span><span className="text-sm font-medium text-[var(--color-navy)]">Preview →</span></Link>)}</section></div></main>;
}
