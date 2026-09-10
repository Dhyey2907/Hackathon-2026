"use client";

/**
 * StackedCards — a pile of documents that deals itself.
 *
 * The front card is fully readable; the ones behind it peek out above it,
 * each a little smaller and dimmer, so the set reads as a physical stack
 * rather than a list with margins. Every few seconds the front card sinks to
 * the back and the next one comes forward.
 *
 * Two things make the motion cheap and stable:
 *
 *   The DOM never reorders. Each card's position is derived from its distance
 *   from the active index, so React re-renders style values and the browser
 *   interpolates transforms on the compositor. Reordering children instead
 *   would remount them mid-flight and make the movement jump.
 *
 *   Height is set by an invisible copy of every card stacked in one grid cell,
 *   so the container is always as tall as the tallest card. Measuring the
 *   front card instead would resize the container on every rotation and shove
 *   the rest of the page around.
 *
 * Presentational only: it knows nothing about what it is stacking. The caller
 * supplies the items and renders each card with the app's own components.
 */

import { useCallback, useEffect, useState } from "react";

/** How many cards are visible before the rest are parked out of sight. */
const MAX_VISIBLE = 4;
const ROTATE_MS = 3800;
const TRANSITION_MS = 820;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

interface Depth {
  /** Vertical gap between one card and the one behind it. */
  y: number;
  /** How much smaller each card gets, per step back. */
  scale: number;
  /** Horizontal inset per step back, which narrows the stack towards the top. */
  x: number;
}

const DESKTOP: Depth = { y: 34, scale: 0.035, x: 10 };
// Tighter on small screens: the same offsets would eat the card's own height
// and push the stack off the side.
const MOBILE: Depth = { y: 20, scale: 0.022, x: 5 };

const OPACITY = [1, 0.88, 0.72, 0.55];

export interface StackedCardsProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  /** `isFront` lets a card show more detail when it is the readable one. */
  renderCard: (item: T, isFront: boolean, index: number) => React.ReactNode;
  /** Accessible name for the stack as a whole. */
  label: string;
  /** Seconds between rotations; set 0 to hold the stack still. */
  intervalMs?: number;
  className?: string;
}

export default function StackedCards<T>({
  items,
  getKey,
  renderCard,
  label,
  intervalMs = ROTATE_MS,
  className = "",
}: StackedCardsProps<T>) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [depth, setDepth] = useState<Depth>(DESKTOP);

  // Read both media queries here rather than in CSS: the same values drive the
  // transforms, and duplicating them in a stylesheet would let the two drift.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 640px)");

    const sync = () => {
      setReducedMotion(motion.matches);
      setDepth(small.matches ? MOBILE : DESKTOP);
    };
    sync();

    motion.addEventListener("change", sync);
    small.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      small.removeEventListener("change", sync);
    };
  }, []);

  const advance = useCallback(
    (step: number) => setActive((current) => (current + step + count) % count),
    [count]
  );

  useEffect(() => {
    // Someone reading the front card, or who asked for less motion, should not
    // have it pulled out from under them.
    if (paused || reducedMotion || intervalMs <= 0 || count < 2) return;
    const timer = window.setInterval(() => advance(1), intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, intervalMs, count, advance]);

  if (count === 0) return null;

  const visibleDepth = Math.min(count - 1, MAX_VISIBLE - 1);
  // Room above the front card for the ones peeking out behind it.
  const headroom = visibleDepth * depth.y;

  return (
    <section
      aria-roledescription="card stack"
      aria-label={label}
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div style={{ paddingTop: headroom }}>
        <div className="relative">
          {/* Sizer: never seen, never clickable, exists only so the container
              is as tall as the tallest card and nothing below it shifts. */}
          <div className="invisible grid" aria-hidden="true">
            {items.map((item, index) => (
              <div key={getKey(item, index)} className="col-start-1 row-start-1">
                {renderCard(item, true, index)}
              </div>
            ))}
          </div>

          {items.map((item, index) => {
            const distance = (index - active + count) % count;
            const hidden = distance >= MAX_VISIBLE;
            // Anything past the visible depth waits at the back position with
            // no opacity, so it fades in rather than appearing from nowhere.
            const step = hidden ? visibleDepth : distance;
            const isFront = distance === 0;

            return (
              <div
                key={getKey(item, index)}
                // inset-0, not top-0: every card is the height of the tallest,
                // so a long card behind a short one cannot poke out below the
                // front card. Back cards must only ever peek from the top.
                className="absolute inset-0"
                style={{
                  transform: `translate3d(0, ${-step * depth.y}px, 0) scale(${
                    1 - step * depth.scale
                  }) rotate(${step === 0 ? 0 : step % 2 ? -0.28 : 0.22}deg)`,
                  // Inset rather than a wider transform, so back cards stay
                  // inside the container and cannot cause sideways scrolling.
                  marginInline: step * depth.x,
                  opacity: hidden ? 0 : OPACITY[step] ?? 0.5,
                  zIndex: count - step,
                  transition: reducedMotion
                    ? undefined
                    : `transform ${TRANSITION_MS}ms ${EASING}, opacity ${TRANSITION_MS}ms ${EASING}, margin ${TRANSITION_MS}ms ${EASING}`,
                  willChange: "transform, opacity",
                  pointerEvents: hidden ? "none" : undefined,
                }}
              >
                {/* Only the front card is reachable; the rest are decoration
                    until promoted, so tabbing does not disappear behind the
                    pile. */}
                {/* The card element is stretched to fill, so all four share a
                    height and the stack keeps clean parallel edges. */}
                <div inert={!isFront} className="h-full [&>*]:h-full">
                  {renderCard(item, isFront, index)}
                </div>

                {!isFront && !hidden && (
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    className="absolute inset-0 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
                    aria-label={`Bring card ${index + 1} of ${count} to the front`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" role="tablist" aria-label={`${label} position`}>
            {items.map((item, index) => (
              <button
                key={getKey(item, index)}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Card ${index + 1} of ${count}`}
                onClick={() => setActive(index)}
                className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] ${
                  index === active
                    ? "w-6 bg-[var(--color-navy)]"
                    : "w-1.5 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <StackButton onClick={() => advance(-1)} label="Previous card" path="M15.75 19.5 8.25 12l7.5-7.5" />
            <StackButton onClick={() => advance(1)} label="Next card" path="M8.25 4.5 15.75 12l-7.5 7.5" />
          </div>
        </div>
      )}

      {/* Announces the change for screen readers, which cannot see the stack
          move. Kept out of the visual flow. */}
      <p aria-live="polite" className="sr-only">
        Showing card {active + 1} of {count}
      </p>
    </section>
  );
}

function StackButton({
  onClick,
  label,
  path,
}: {
  onClick: () => void;
  label: string;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-gray-500 shadow-sm transition hover:text-[var(--color-navy)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </button>
  );
}
