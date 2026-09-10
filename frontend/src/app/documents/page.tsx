import type { Metadata } from "next";
import DocumentsManager from "@/components/documents/DocumentsManager";

export const metadata: Metadata = { title: "Documents", description: "Manage local BIS Sahayak documents." };

export default function DocumentsPage() {
  return <DocumentsManager />;
}
