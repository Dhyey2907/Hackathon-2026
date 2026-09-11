"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { Metadata } from "next";
import StandardsBrowser from "@/components/standards/StandardsBrowser";
import ScrollOverHero from "@/components/ScrollOverHero";
import { useRef } from "react";

// Note: metadata export is removed here since this is now a client component.
// The parent layout handles the base title; individual page titles are set in layout.

/**
 * Standards Lookup page.
 * Adds the ScrollOverHero peeking effect: background starts blurred (8px)
 * and sharpens as the user scrolls into the catalogue browser.
 */
export default function StandardsPage() {
  const mainRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();

  return (
    <main
      ref={mainRef}
      className="flex-1 overflow-y-auto bg-gray-50"
      id="main-content"
    >
      {/* ── Atmospheric hero with peeking blur: 8px → 0px on scroll */}
      <ScrollOverHero
        eyebrow={t("std.heroEyebrow")}
        title={t("std.heroTitle")}
        subtitle={t("std.heroSub")}
        scrollContainerRef={mainRef}
        startBlur={8}
        endBlur={0}
      />

      <div className="relative z-10 mx-auto -mt-8 w-full max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
        <StandardsBrowser />
      </div>
    </main>
  );
}