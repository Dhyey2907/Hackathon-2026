"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

export type DocumentCategory = "License" | "Test Report" | "Certificate" | "Other";

export type ExpiryStatus = "expired" | "expiring-soon" | "valid" | "none";

/**
 * Where a document's file lives.
 * - "cloud":   the user's account - Supabase Storage plus a user_documents row.
 * - "browser": this browser's IndexedDB, for local accounts, or as the fallback
 *              when an upload to the account fails.
 * - "sample":  one of the example rows the app ships with; there is no file.
 */
export type DocumentStorage = "cloud" | "browser" | "sample";

export type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size: number;
  uploadedAt: string;
  category: DocumentCategory;
  /** ISO date string (YYYY-MM-DD). Absent means no expiry set. */
  expiryDate?: string;
  /**
   * True for the example rows the app ships with. They exist so the dashboard
   * has something to show before anything is uploaded, and they are badged in
   * the UI - a demo document sitting unmarked beside a real licence is the
   * kind of thing someone acts on.
   */
  isSample?: boolean;
  storage: DocumentStorage;
  /** Cloud documents: the object's path in the bucket. */
  storagePath?: string;
  /** "uploading" while the file is on its way to the account. */
  syncing?: boolean;
  /** Why an upload to the account failed; the file is then kept in the browser. */
  syncError?: string;
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
  /** True until this user's documents have been loaded. */
  isLoading: boolean;
  /** Whether new uploads go to the user's account rather than this browser. */
  savesToAccount: boolean;
  addDocument: (file: File, category: DocumentCategory, expiryDate?: string) => DocumentRecord;
  deleteDocument: (id: string) => void;
  getDocument: (id: string) => DocumentRecord | undefined;
  /** The document's file, downloaded on first use. Null for samples. */
  getFile: (document: DocumentRecord) => Promise<Blob | null>;
};

// Seed dates chosen relative to 2026-09-09 to demonstrate all three urgency states:
//   ISI License      → 2026-09-05  (expired 4 days ago)       → red  "Expired"
//   Test Report      → 2026-09-19  (10 days left)             → amber "Expiring soon"
//   HUID Notes       → 2027-03-09  (~6 months away)           → no badge / valid
//   LED Checklist    → (none)      (no expiry set)            → no badge / neutral
const SAMPLE_DOCUMENTS: DocumentRecord[] = [
  {
    id: "seed-isi-license-electronics",
    isSample: true,
    storage: "sample",
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
    storage: "sample",
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
    storage: "sample",
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
    storage: "sample",
    name: "LED Compliance Checklist.pdf",
    type: "PDF",
    size: 716800,
    uploadedAt: "2026-04-27T09:00:00.000Z",
    category: "Other",
    // no expiryDate — demonstrates "no expiry" state
  },
];

// --- file types ---------------------------------------------------------------

// The bucket only admits these types, and browsers report an empty type for
// several of them (.md, sometimes .csv), so the type comes from the extension.
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function mimeOf(file: File) {
  return MIME_BY_EXTENSION[extensionOf(file.name)] ?? (file.type || "application/octet-stream");
}

function fileType(file: File) {
  const mime = mimeOf(file);
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Image";
  return extensionOf(file.name).toUpperCase() || "FILE";
}

/** Storage keys reject some characters; the display name keeps the original. */
function safeObjectName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(-120) || "document";
}

// --- the user's account: Supabase Storage + user_documents --------------------
//
// Uploads use the signed-in user's own session. Row-level security on the table
// and on storage.objects confines each account to its own folder, so nothing
// here needs, or could use, a service key.

const BUCKET = "user-documents";

type DocumentRow = {
  id: string;
  name: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  category: DocumentCategory;
  expiry_date: string | null;
  storage_path: string;
  uploaded_at: string;
};

function fromRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.file_type,
    mimeType: row.mime_type,
    size: row.size_bytes,
    category: row.category,
    expiryDate: row.expiry_date ?? undefined,
    uploadedAt: row.uploaded_at,
    storage: "cloud",
    storagePath: row.storage_path,
  };
}

const account = {
  async list(): Promise<DocumentRecord[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("user_documents")
      .select("id, name, file_type, mime_type, size_bytes, category, expiry_date, storage_path, uploaded_at")
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return (data as DocumentRow[]).map(fromRow);
  },

  /** Upload the file, then record it. Returns the object path. */
  async save(userId: string, document: DocumentRecord, file: Blob): Promise<string> {
    if (!supabase) throw new Error("Supabase is not configured");
    const path = `${userId}/${document.id}/${safeObjectName(document.name)}`;
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: document.mimeType, upsert: false });
    if (upload.error) throw upload.error;

    const insert = await supabase.from("user_documents").insert({
      id: document.id,
      user_id: userId,
      name: document.name,
      file_type: document.type,
      mime_type: document.mimeType ?? "application/octet-stream",
      size_bytes: document.size,
      category: document.category,
      expiry_date: document.expiryDate ?? null,
      storage_path: path,
      uploaded_at: document.uploadedAt,
    });
    if (insert.error) {
      // Without a row the file is unreachable from the app; do not leave it
      // sitting in the bucket.
      await supabase.storage.from(BUCKET).remove([path]);
      throw insert.error;
    }
    return path;
  },

  async remove(document: DocumentRecord) {
    if (!supabase) return;
    const { error } = await supabase.from("user_documents").delete().eq("id", document.id);
    if (error) throw error;
    if (document.storagePath) await supabase.storage.from(BUCKET).remove([document.storagePath]);
  },

  async download(path: string): Promise<Blob> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw error ?? new Error("The file could not be downloaded.");
    return data;
  },
};

// --- this browser: IndexedDB ----------------------------------------------------
//
// For local accounts, which have no server-side identity to store against, and
// as the fallback when an upload to the account fails - a file the user handed
// over should not simply vanish because the network did.

const DB_NAME = "bis-sahayak-documents";
const STORE = "files";

type StoredDocument = Omit<DocumentRecord, "storage" | "storagePath" | "syncing" | "syncError"> & { blob: Blob };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    // Closing waits for the transaction to finish; it does not abort it.
    db.close();
  }
}

const browser = {
  available: () => typeof indexedDB !== "undefined",
  loadAll: () => withStore<StoredDocument[]>("readonly", (store) => store.getAll() as IDBRequest<StoredDocument[]>),
  save: (document: DocumentRecord, blob: Blob) => {
    const stored: StoredDocument = {
      id: document.id,
      name: document.name,
      type: document.type,
      mimeType: document.mimeType,
      size: document.size,
      uploadedAt: document.uploadedAt,
      category: document.category,
      expiryDate: document.expiryDate,
      blob,
    };
    return withStore("readwrite", (store) => store.put(stored));
  },
  remove: (id: string) => withStore("readwrite", (store) => store.delete(id)),
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "The upload did not complete.";
}

// --- provider -------------------------------------------------------------------

const DocumentContext = createContext<DocumentContextValue | null>(null);

// Browser-stored files being moved into the account, by their browser id.
// Module-level because the provider can mount more than once for a single page
// - React's development double-mount, and every hot reload - and each mount
// runs the load. Without this, every one of them uploaded its own copy.
const carrying = new Set<string>();

type Loaded = { owner: string; documents: DocumentRecord[] };

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();

  // Local accounts have ids like "local-<email>" and no Supabase session.
  const accountId = supabase && user?.id && !user.id.startsWith("local-") ? user.id : null;
  const owner = accountId ?? "browser";

  // Documents are keyed to whoever they were loaded for, so signing out or
  // switching account never shows the previous user's files - without having
  // to clear state inside an effect.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [hiddenSamples, setHiddenSamples] = useState<string[]>([]);

  // Files already in memory: fresh uploads, browser-stored files, and cloud
  // files once downloaded. Previews read from here before going to the network.
  const files = useRef(new Map<string, Blob>());

  const update = useCallback(
    (forOwner: string, change: (documents: DocumentRecord[]) => DocumentRecord[]) => {
      setLoaded((current) => ({
        owner: forOwner,
        documents: change(current?.owner === forOwner ? current.documents : []),
      }));
    },
    [],
  );

  const patch = useCallback(
    (forOwner: string, id: string, fields: Partial<DocumentRecord>) =>
      update(forOwner, (documents) => documents.map((d) => (d.id === id ? { ...d, ...fields } : d))),
    [update],
  );

  /** Send a file to the account; if that fails, keep it in this browser. */
  const saveToAccount = useCallback(
    async (userId: string, document: DocumentRecord, file: Blob) => {
      try {
        const storagePath = await account.save(userId, document, file);
        patch(userId, document.id, { storage: "cloud", storagePath, syncing: false, syncError: undefined });
        return true;
      } catch (error) {
        if (browser.available()) await browser.save(document, file).catch(() => {});
        patch(userId, document.id, { storage: "browser", syncing: false, syncError: errorMessage(error) });
        return false;
      }
    },
    [patch],
  );

  useEffect(() => {
    if (authLoading) return;
    let live = true;

    async function loadBrowser(): Promise<StoredDocument[]> {
      if (!browser.available()) return [];
      try {
        return await browser.loadAll();
      } catch {
        // Private windows and blocked site data refuse IndexedDB.
        return [];
      }
    }

    async function load() {
      const stored = await loadBrowser();
      stored.forEach(({ blob, id }) => files.current.set(id, blob));
      const browserDocs: DocumentRecord[] = stored.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        mimeType: d.mimeType,
        size: d.size,
        uploadedAt: d.uploadedAt,
        category: d.category,
        expiryDate: d.expiryDate,
        storage: "browser",
      }));

      if (!accountId) {
        if (live) update(owner, () => browserDocs);
        return;
      }

      let cloudDocs: DocumentRecord[] = [];
      try {
        cloudDocs = await account.list();
      } catch {
        // The account is unreachable; show what this browser holds and let the
        // next load try again.
        if (live) update(owner, () => browserDocs.map((d) => ({ ...d, syncError: "Could not reach your account." })));
        return;
      }
      if (!live) return;

      // Files uploaded before signing in, or while the account was
      // unreachable, move into the account - under a new id, since the table
      // wants a uuid - and leave the browser once they have arrived.
      const toCarry = browserDocs.filter((d) => !carrying.has(d.id));
      toCarry.forEach((d) => carrying.add(d.id));
      const carried = toCarry.map((d) => ({ previousId: d.id, record: { ...d, id: newId(), syncing: true } }));
      update(owner, () => [...carried.map((c) => c.record), ...cloudDocs]);

      for (const { previousId, record } of carried) {
        const blob = files.current.get(previousId);
        if (!blob) continue;
        files.current.set(record.id, blob);
        // Out of the browser store first, so a later load cannot pick the same
        // file up again. If the upload fails, saveToAccount writes it back
        // under its new id, so the file is never only in memory for long.
        await browser.remove(previousId).catch(() => {});
        await saveToAccount(accountId, record, blob);
      }
    }

    void load();
    return () => {
      live = false;
    };
  }, [accountId, authLoading, owner, saveToAccount, update]);

  const addDocument = useCallback(
    (file: File, category: DocumentCategory, expiryDate?: string) => {
      const document: DocumentRecord = {
        id: newId(),
        name: file.name,
        type: fileType(file),
        mimeType: mimeOf(file),
        size: file.size,
        uploadedAt: new Date().toISOString(),
        category,
        expiryDate: expiryDate || undefined,
        storage: accountId ? "cloud" : "browser",
        syncing: Boolean(accountId),
      };
      files.current.set(document.id, file);
      update(owner, (documents) => [document, ...documents]);

      if (accountId) void saveToAccount(accountId, document, file);
      else if (browser.available()) void browser.save(document, file).catch(() => {});
      return document;
    },
    [accountId, owner, saveToAccount, update],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      if (id.startsWith("seed-")) {
        setHiddenSamples((current) => [...current, id]);
        return;
      }
      const target = loaded?.owner === owner ? loaded.documents.find((d) => d.id === id) : undefined;
      update(owner, (documents) => documents.filter((d) => d.id !== id));
      files.current.delete(id);
      if (!target) return;
      if (target.storage === "cloud") void account.remove(target).catch(() => {});
      else if (browser.available()) void browser.remove(id).catch(() => {});
    },
    [loaded, owner, update],
  );

  const getFile = useCallback(async (document: DocumentRecord) => {
    const cached = files.current.get(document.id);
    if (cached) return cached;
    if (document.storage === "cloud" && document.storagePath) {
      const blob = await account.download(document.storagePath);
      files.current.set(document.id, blob);
      return blob;
    }
    return null;
  }, []);

  const value = useMemo<DocumentContextValue>(() => {
    const mine = loaded?.owner === owner ? loaded.documents : [];
    const samples = SAMPLE_DOCUMENTS.filter((d) => !hiddenSamples.includes(d.id));
    const documents = [...mine, ...samples].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return {
      documents,
      isLoading: authLoading || loaded?.owner !== owner,
      savesToAccount: Boolean(accountId),
      addDocument,
      deleteDocument,
      getDocument: (id: string) => documents.find((d) => d.id === id),
      getFile,
    };
  }, [accountId, addDocument, authLoading, deleteDocument, getFile, hiddenSamples, loaded, owner]);

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (!context) throw new Error("useDocuments must be used inside DocumentProvider");
  return context;
}
