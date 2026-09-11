"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type ScannerState = "requesting" | "scanning" | "success" | "denied" | "no-camera" | "error";

interface QrScannerProps {
  onDecoded: (value: string) => void;
}

export default function QrScanner({ onDecoded }: QrScannerProps) {
  const generatedId = useId().replace(/:/g, "");
  const elementId = `bis-qr-reader-${generatedId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const decodedRef = useRef(false);
  const startedRef = useRef(false);
  const [state, setState] = useState<ScannerState>("requesting");
  const { t } = useLanguage();

  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    scannerRef.current = scanner;

    async function startScanner() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras.length) {
          setState("no-camera");
          return;
        }

        await scanner.start(
          cameras[0].id,
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          (decodedText) => {
            if (decodedRef.current) return;
            decodedRef.current = true;
            setState("success");
            onDecodedRef.current(decodedText.trim());
            try {
              if (startedRef.current) void scanner.stop().catch(() => undefined);
            } catch {
              // The camera may finish stopping between a decode and this call.
            }
          },
          () => undefined,
        );
        startedRef.current = true;
        if (!cancelled) setState("scanning");
      } catch {
        if (!cancelled) setState("denied");
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      const activeScanner = scannerRef.current;
      if (activeScanner && startedRef.current) {
        try {
          void activeScanner.stop().catch(() => undefined);
        } catch {
          // The browser may revoke the stream before cleanup runs.
        }
      }
    };
  }, [elementId]);

  const copyKey = state === "no-camera" ? "noCamera" : state;
  const stateCopy = { title: t(`qr.${copyKey}.title`), body: t(`qr.${copyKey}.body`) };

  return (
    <div className="mt-5">
      <div className="relative overflow-hidden rounded-xl bg-[#0f2238] p-3">
        <div id={elementId} className="min-h-[280px] overflow-hidden rounded-lg bg-[#0b1828]" aria-label={t("qr.preview")} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`relative h-56 w-56 rounded-2xl border-2 ${state === "success" ? "border-green-400" : "border-white"} shadow-[0_0_0_999px_rgba(4,15,28,0.48)]`}>
            <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-green-300" />
            <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-green-300" />
            <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-green-300" />
            <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-green-300" />
          </div>
        </div>
        {state !== "scanning" && <div className="absolute inset-x-0 bottom-5 mx-auto w-fit rounded-full bg-black/65 px-3 py-1.5 text-center text-xs font-medium text-white">{stateCopy.title}</div>}
      </div>
      <div className="mt-3 text-center"><p className="text-sm font-semibold text-gray-900">{stateCopy.title}</p><p className="mt-1 text-sm text-gray-600">{stateCopy.body}</p></div>
    </div>
  );
}