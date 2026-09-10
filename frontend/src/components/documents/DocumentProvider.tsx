"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type DocumentCategory = "License" | "Test Report" | "Certificate" | "Other";

export type ExpiryStatus = "expired" | "expiring-soon" | "valid" | "none";

export type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  category: DocumentCategory;
  previewUrl?: string;
  /** ISO date string (YYYY-MM-DD). Absent means no expiry set. */
  expiryDate?: string;
  /**
   * True for the example rows the app ships with. They exist so the dashboard
   * has something to show before anything is uploaded, and they are badged in
   * the UI - a demo document sitting unmarked beside a real licence is the
   * kind of thing someone acts on.
   */
  isSample?: boolean;
};

/**
 * Derives the expiry urgency for a document.
 * - "expired":       past the expiry date
 * - "expiring-soon": within 30 days
 * - "valid":         more than 30 days away
 * - "none":          no expiry date set
 */
export function getExpiryStatus(expiryDate?: string): { status: ExpiryStatus; daysLeft: number | null } {
  if (!expiryDate) return { status: "none", daysLeft: null };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= 30) return { status: "expiring-soon", daysLeft };
  return { status: "valid", daysLeft };
}

type DocumentContextValue = {
  documents: DocumentRecord[];
  addDocument: (file: File, category: DocumentCategory, expiryDate?: string) => DocumentRecord;
  deleteDocument: (id: string) => void;
  getDocument: (id: string) => DocumentRecord | undefined;
};

// Seed dates chosen relative to 2026-09-09 to demonstrate all three urgency states:
//   ISI License      → 2026-09-05  (expired 4 days ago)       → red  "Expired"
//   Test Report      → 2026-09-19  (10 days left)             → amber "Expiring soon"
//   HUID Notes       → 2027-03-09  (~6 months away)           → no badge / valid
//   LED Checklist    → (none)      (no expiry set)            → no badge / neutral
const INITIAL_DOCUMENTS: DocumentRecord[] = [
  {
    id: "seed-isi-license-electronics",
    isSample: true,
    name: "ISI License - Electronics.pdf",
    type: "PDF",
    size: 2457600,
    uploadedAt: "2026-05-18T09:00:00.000Z",
    category: "License",
    expiryDate: "2026-09-05",
  },
  {
    id: "seed-test-report-cement",
    isSample: true,
    name: "Test Report - Cement.pdf",
    type: "PDF",
    size: 1835008,
    uploadedAt: "2026-05-12T09:00:00.000Z",
    category: "Test Report",
    expiryDate: "2026-09-19",
  },
  {
    id: "seed-huid-verification-notes",
    isSample: true,
    name: "HUID Verification Notes.pdf",
    type: "PDF",
    size: 921600,
    uploadedAt: "2026-05-04T09:00:00.000Z",
    category: "Certificate",
    expiryDate: "2027-03-09",
  },
  {
    id: "seed-led-compliance-checklist",
    isSample: true,
    name: "LED Compliance Checklist.pdf",
    type: "PDF",
    size: 716800,
    uploadedAt: "2026-04-27T09:00:00.000Z",
    category: "Other",
    // no expiryDate — demonstrates "no expiry" state
  },
];

const DocumentContext = createContext<DocumentContextValue | null>(null);

function fileType(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "PDF";
  if (file.type.startsWith("image/")) return "Image";
  return file.name.split(".").pop()?.toUpperCase() || "FILE";
}

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(INITIAL_DOCUMENTS);

  function addDocument(file: File, category: DocumentCategory, expiryDate?: string) {
    const document: DocumentRecord = {
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: fileType(file),
      size: file.size,
      uploadedAt: new Date().toISOString(),
      category,
      previewUrl: URL.createObjectURL(file),
      expiryDate: expiryDate || undefined,
    };
    setDocuments((current) => [document, ...current]);
    return document;
  }

  function deleteDocument(id: string) {
    setDocuments((current) => {
      const target = current.find((document) => document.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((document) => document.id !== id);
    });
  }

  const value = useMemo(
    () => ({
      documents: [...documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
      addDocument,
      deleteDocument,
      getDocument: (id: string) => documents.find((document) => document.id === id),
    }),
    [documents],
  );

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (!context) throw new Error("useDocuments must be used inside DocumentProvider");
  return context;
}
