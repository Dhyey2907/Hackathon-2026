import type { Metadata } from "next";
import DocumentPreview from "@/components/documents/DocumentPreview";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Document Preview" };

export default async function DocumentPreviewPage({ params }: Props) {
  const { id } = await params;
  // DocumentPreview is a client component that reads from DocumentProvider context.
  // It handles the "not found" state itself when the id doesn't match any document.
  return <DocumentPreview id={id} />;
}
