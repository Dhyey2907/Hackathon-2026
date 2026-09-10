"use client";

/**
 * Counts from zero up to a number, once, when it first appears.
 *
 * Used for the compliance score, where watching the figure climb tells you
 * something the final number alone does not - that it is a measurement with a
 * range, not a label.
 *
 * Driven by requestAnimationFrame against a real timestamp rather than a
 * fixed-step interval, so the duration is the same on a 60Hz and a 144Hz
 * display and a dropped frame shortens the animation rather than stretching it.
 *
 * Under reduced motion it returns the target immediately. That is the rule the
 * rest of this app follows: less motion must never mean less information, and
 * a score that animates is a score that is briefly wrong.
 */

import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 1100;

/** Ease-out cubic: quick to begin, settling rather than stopping. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function useCountUp(target: number, durationMs = DEFAULT_DURATION_MS): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A page not running its rendering steps delivers no frames, so an
    // animated number would sit at zero for as long as it stayed hidden.
    const hidden = document.visibilityState === "hidden";

    if (reduced || hidden) {
      // Scheduled rather than set inline: a synchronous setState in an effect
      // body cascades a second render before paint, and a timeout also works
      // where requestAnimationFrame does not - which is the hidden-page case.
      const jump = window.setTimeout(() => setValue(target), 0);
      return () => window.clearTimeout(jump);
    }

    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs);
      setValue(Math.round(target * easeOut(progress)));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return value;
}
