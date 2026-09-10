"use client";

import { useEffect, useRef } from "react";

interface ScrollOverHeroProps {
  /** Small eyebrow label above the title */
  eyebrow: string;
  /** Large hero title */
  title: string;
  /** Supporting subtitle */
  subtitle: string;
  /**
   * The scrollable container to attach the listener to.
   * If not provided, defaults to the nearest scrollable parent (window).
   * Pass a ref to the <main> element for page-level scroll tracking.
   */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Starting blur when this hero is fully visible at the top.
   * Defaults to 8px (the atmospheric route default for non-home routes).
   */
  startBlur?: number;
  /**
   * Ending blur when the user has fully scrolled past the hero.
   * Defaults to 0px (crystal clarity).
   */
  endBlur?: number;
}

/**
 * ScrollOverHero — shared atmospheric page header with peeking blur effect.
 *
 * Visual flow: The background starts blurred (atmospheric, 8px) while the hero
 * is visible. As the user scrolls down past the hero, --current-blur linearly
 * animates from startBlur → endBlur, creating a "coming into focus" effect.
 *
 * The surrounding non-home page owns the full atmospheric background; this
 * component adds the focused header content and theme-aware glow details.
 */
export default function ScrollOverHero({
  eyebrow,
  title,
  subtitle,
  scrollContainerRef,
  startBlur = 8,
  endBlur = 0,
}: ScrollOverHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set initial blur when the component mounts
    document.documentElement.style.setProperty("--current-blur", `${startBlur}px`);

    function handleScroll() {
      const hero = heroRef.current;
      if (!hero) return;

      const heroRect = hero.getBoundingClientRect();
      const heroHeight = heroRect.height;

      // How far the hero has been scrolled past (negative when below viewport top)
      // When heroRect.top is 0, user is at the very top (hero fully visible).
      // When heroRect.top <= -heroHeight, hero is fully scrolled away.
      const scrolledPast = Math.max(0, -heroRect.top);
      const progress = Math.min(1, scrolledPast / heroHeight);

      // Linearly interpolate blur: startBlur → endBlur
      const blur = startBlur + (endBlur - startBlur) * progress;
      document.documentElement.style.setProperty("--current-blur", `${blur.toFixed(2)}px`);
    }

    // Attach to scroll container or window
    const container = scrollContainerRef?.current ?? window;
    container.addEventListener("scroll", handleScroll, { passive: true });

    // Run once immediately to set correct initial state
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      // Reset to route default on unmount (8px for non-home routes)
      document.documentElement.style.setProperty("--current-blur", "8px");
    };
  }, [startBlur, endBlur, scrollContainerRef]);

  return (
    <div
      ref={heroRef}
      className="page-hero relative w-full overflow-hidden"
    >
      {/* Atmospheric page header */}
      <div className="relative px-6 py-10 sm:px-10 sm:py-14">
        <div
          className="page-hero-glow page-hero-glow-blue pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full"
          aria-hidden="true"
        />
        <div
          className="page-hero-glow page-hero-glow-warm pointer-events-none absolute -bottom-8 -left-8 h-48 w-48 rounded-full"
          aria-hidden="true"
        />

        {/* Hero text */}
        <div className="relative z-10 max-w-2xl">
          {/* Eyebrow */}
          <p className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-6 rounded-full"
              style={{ backgroundColor: "var(--color-powder-blue)" }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {eyebrow}
            </span>
          </p>

          {/* Title */}
          <h1
            className="text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: "var(--color-text-primary)", letterSpacing: "-0.025em" }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          <p
            className="mt-3 text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--color-text-secondary)", maxWidth: "42ch" }}
          >
            {subtitle}
          </p>

          {/* Decorative scroll hint */}
          <div className="page-hero-hint mt-8 flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
              Scroll to focus
            </span>
            <svg
              className="h-3.5 w-3.5 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: "var(--color-text-muted)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade — blends hero into content */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-16"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--color-bg))",
          opacity: 0.6,
        }}
      />
    </div>
  );
}
