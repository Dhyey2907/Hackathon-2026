"use client";

/**
 * Preview of one document, used by the vault's side pane and the full-page view.
 *
 * PDFs and images render natively. Text files are shown as text. Word (.docx)
 * files cannot be rendered by a browser, so their text is read by the backend's
 * POST /extract - the same reader the chat uses - and shown instead. Everything
 * else gets a working download rather than a promise of one.
 */

import { useEffect, useMemo, useState } from "react";
import { extractDocument } from "@/lib/api";
import { useDocuments, type DocumentRecord } from "./DocumentProvider";

type Kind = "pdf" | "image" | "text" | "docx" | "other";

function kindOf(document: DocumentRecord): Kind {
  const mime = document.mimeType ?? "";
  const name = document.name.toLowerCase();
  if (document.type === "PDF" || mime === "application/pdf") return "pdf";
  if (document.type === "Image" || mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/") || /\.(txt|md|csv)$/.test(name)) return "text";
  if (name.endsWith(".docx")) return "docx";
  return "other";
}

/** Text previews are capped; the full file is one click away. */
const MAX_TEXT = 200_000;

type Result =
  | { id: string; status: "ready"; url: string; text?: string; note?: string }
  | { id: string; status: "error"; message: string };

export function StorageBadge({ document }: { document: DocumentRecord }) {
  if (document.storage === "sample") return null;
  const [label, tone] = document.syncing
    ? ["Uploading…", "bg-sky-100 text-sky-800"]
    : document.syncError
    ? ["Saved in this browser only", "bg-amber-100 text-amber-800"]
    : document.storage === "cloud"
    ? ["Saved to your account", "bg-emerald-100 text-emerald-800"]
    : ["Saved in this browser", "bg-slate-100 text-slate-700"];
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`} title={document.syncError}>
      {label}
    </span>
  );
}

export default function DocumentViewer({ document, height = 520 }: { document: DocumentRecord; height?: number }) {
  const { getFile } = useDocuments();
  const kind = kindOf(document);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Only what decides which file to load. A record is replaced when its upload
  // finishes; reloading the preview for that would make the PDF flicker.
  const target = useMemo(
    () => document,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document.id, document.storage, document.storagePath],
  );

  useEffect(() => {
    if (target.storage === "sample") return;
    let live = true;
    let url: string | null = null;

    (async () => {
      try {
        const blob = await getFile(target);
        if (!live) return;
        if (!blob) {
          setResult({ id: target.id, status: "error", message: "The file for this record is not available." });
          return;
        }
        url = URL.createObjectURL(blob);
        let text: string | undefined;
        let note: string | undefined;
        if (kind === "text") {
          const raw = await blob.text();
          text = raw.slice(0, MAX_TEXT);
          if (raw.length > MAX_TEXT) note = "Showing the first part of a long file. Download it to see the rest.";
        } else if (kind === "docx") {
          const read = await extractDocument(new File([blob], target.name, { type: blob.type }));
          if (read.readable) {
            text = read.text;
            note = read.truncated
              ? "Text preview of the first part of this Word document. Download it to see the formatting and the rest."
              : "Text preview - download the file to see its formatting.";
          } else {
            note = read.message ?? "The text of this document could not be read.";
          }
        }
        if (!live) {
          URL.revokeObjectURL(url);
          return;
        }
        setResult({ id: target.id, status: "ready", url, text, note });
      } catch (error) {
        if (!live) return;
        const message =
          error && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : "The preview could not be loaded.";
        setResult({ id: target.id, status: "error", message });
      }
    })();

    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [target, getFile, kind, attempt]);

  if (document.storage === "sample") {
    return (
      <Panel>
        <p className="font-semibold text-[var(--color-text-primary)]">Sample record - no file attached</p>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--color-text-muted)]">
          This example shows how expiry tracking works. Upload your own licence, certificate or test report to
          preview it here.
        </p>
      </Panel>
    );
  }

  const current = result?.id === document.id ? result : null;

  if (!current) {
    return (
      <Panel>
        <p className="text-sm text-[var(--color-text-muted)]">Loading preview…</p>
      </Panel>
    );
  }

  if (current.status === "error") {
    return (
      <Panel>
        <p className="font-semibold text-[var(--color-text-primary)]">Preview unavailable</p>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--color-text-muted)]">{current.message}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-4 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
        >
          Try again
        </button>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(kind === "pdf" || kind === "image" || kind === "text") && (
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
          >
            Open in new tab ↗
          </a>
        )}
        <a
          href={current.url}
          download={document.name}
          className="rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-navy-light)]"
        >
          Download ↓
        </a>
      </div>

      {kind === "pdf" && (
        <iframe
          src={current.url}
          title={`Preview of ${document.name}`}
          style={{ height }}
          className="w-full rounded-xl border border-[var(--color-border)] bg-white"
        />
      )}

      {kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.url}
          alt={`Preview of ${document.name}`}
          style={{ maxHeight: height }}
          className="mx-auto max-w-full rounded-xl border border-[var(--color-border)] object-contain"
        />
      )}

      {(kind === "text" || kind === "docx") && current.text && (
        <pre
          style={{ maxHeight: height }}
          className="overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs leading-relaxed text-[var(--color-text-primary)]"
        >
          {current.text}
        </pre>
      )}

      {(kind === "other" || ((kind === "text" || kind === "docx") && !current.text)) && (
        <Panel>
          <p className="font-semibold text-[var(--color-text-primary)]">No preview for this file type</p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--color-text-muted)]">
            {kind === "other" && document.name.toLowerCase().endsWith(".doc")
              ? "Older .doc files cannot be shown in the browser. Download it to open it, or save it as .docx or PDF for a preview."
              : "Download the file to open it."}
          </p>
        </Panel>
      )}

      {current.note && <p className="text-[11px] text-[var(--color-text-muted)]">{current.note}</p>}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-14 text-center">
      {children}
    </div>
  );
}
