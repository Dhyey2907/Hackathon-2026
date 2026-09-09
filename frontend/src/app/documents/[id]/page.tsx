import type { Metadata } from "next";
import Link from "next/link";
import { RECENT_DOCUMENTS } from "@/lib/recents";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const document = RECENT_DOCUMENTS.find((item) => item.id === id);
  return { title: document?.title ?? "Document preview" };
}

export default async function DocumentPreviewPage({ params }: Props) {
  const { id } = await params;
  const document = RECENT_DOCUMENTS.find((item) => item.id === id);
  if (!document) return <main className="flex-1 bg-gray-50" id="main-content"><div className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="text-2xl font-bold text-gray-900">Document not found</h1><Link href="/documents" className="mt-5 inline-block font-medium text-[var(--color-navy)]">Back to documents</Link></div></main>;
  return <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content"><div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><Link href="/documents" className="text-sm font-medium text-[var(--color-navy)]">← Back to documents</Link><section className="mt-5 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8"><div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--color-navy-lighter)] text-sm font-bold text-[var(--color-navy)]">{document.type}</div><h1 className="mt-5 text-2xl font-bold text-gray-900">{document.title}</h1><p className="mt-2 text-sm text-gray-500">Uploaded {document.uploadedAt}</p><div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center"><p className="font-semibold text-gray-900">Document preview placeholder</p><p className="mt-2 text-sm text-gray-600">A full document viewer will be connected here in a later step.</p></div></section></div></main>;
}
