"use client";

/**
 * Reveal-on-scroll: an element fades and rises into place the first time it
 * comes into view, then stays put.
 *
 * The governing rule is that content must never be invisible. A reveal starts
 * at `opacity: 0`, so anything that stops the release from happening hides the
 * page rather than merely un-animating it. Three separate things can stop it,
 * and each has a guard here:
 *
 *   The scroll root is not the window. Most routes render their own
 *   `<main class="flex-1 overflow-y-auto">`, /chat scrolls a nested div, and
 *   the auth screens scroll the document. An observer rooted at the viewport
 *   would never fire inside a scrolling <main>, so each element resolves its
 *   own nearest scrollable ancestor at mount.
 *
 *   The observer may never fire at all. A page that is not running its
 *   rendering steps - a background tab, a restored session - delivers no
 *   IntersectionObserver callbacks whatsoever. A working observer always
 *   delivers an initial callback per target, intersecting or not, so silence
 *   is diagnostic: if a root's observer has said nothing at all by the time
 *   the failsafe runs, every element waiting on it is shown outright. Note
 *   this is keyed on "the observer is dead", not "this element is late" - a
 *   plain timeout would pop the whole page into view after a few seconds and
 *   there would be no scroll animation left.
 *
 *   The user may have asked for less motion. Then it is marked revealed at
 *   once and never observed - the global CSS rule only shortens durations, so
 *   an element left at opacity 0 would stay there.
 *
 * One observer per scroll root, not one per element: a page can reveal thirty
 * things, and thirty observers is thirty callbacks to service.
 */

import { useEffect, useRef } from "react";

interface RootState {
  observer: IntersectionObserver;
  /** Has this observer ever delivered a callback? */
  alive: boolean;
  /** Elements still waiting, so a dead observer can be recovered from. */
  waiting: Set<HTMLElement>;
}

/** Shared observers, keyed by scroll root (null = viewport). */
const roots = new Map<Element | null, RootState>();

/** How long to wait before concluding an observer will never speak. */
const FAILSAFE_MS = 2000;

/** How long the CSS transition runs, after which the compositor hint is dropped. */
const SETTLE_MS = 900;

function reveal(element: HTMLElement) {
  if (element.classList.contains("is-revealed")) return;
  element.classList.add("is-revealed");
  // Once landed, drop the compositor hint. A wrapper left holding a transform
  // becomes a containing block, which breaks position:fixed inside it.
  window.setTimeout(() => element.classList.add("reveal-done"), SETTLE_MS);
}

function nearestScrollParent(element: Element): Element | null {
  let node = element.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/** Is the element already inside its root's box? Pure measurement, no observer. */
function alreadyInView(element: Element, root: Element | null): boolean {
  const box = element.getBoundingClientRect();
  const rootBox = root ? root.getBoundingClientRect() : null;
  const top = rootBox ? rootBox.top : 0;
  const bottom = rootBox ? rootBox.bottom : window.innerHeight;
  return box.top < bottom && box.bottom > top;
}

function stateFor(root: Element | null): RootState {
  const existing = roots.get(root);
  if (existing) return existing;

  const state: RootState = {
    alive: false,
    waiting: new Set(),
    observer: new IntersectionObserver(
      (entries) => {
        state.alive = true;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          reveal(target);
          state.waiting.delete(target);
          // Revealed once and left alone - re-hiding on scroll back up makes
          // a page feel unstable to anyone scrolling back to re-read.
          state.observer.unobserve(target);
        }
      },
      // The negative bottom margin holds the reveal until the element is
      // properly on screen rather than peeking over the fold.
      { root, rootMargin: "0px 0px -10% 0px", threshold: 0.01 }
    ),
  };

  window.setTimeout(() => {
    if (state.alive) return;
    // The observer never spoke. Show everything rather than leave a blank page.
    for (const element of state.waiting) {
      reveal(element);
      state.observer.unobserve(element);
    }
    state.waiting.clear();
  }, FAILSAFE_MS);

  roots.set(root, state);
  return state;
}

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const unsupported = typeof IntersectionObserver === "undefined";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (unsupported || reduced) {
      reveal(element);
      return;
    }

    const root = nearestScrollParent(element);
    // Already on screen: reveal from a plain measurement rather than waiting
    // for a callback that a non-rendering page will never deliver.
    if (alreadyInView(element, root)) {
      reveal(element);
      return;
    }

    const state = stateFor(root);
    state.waiting.add(element);
    state.observer.observe(element);

    return () => {
      state.waiting.delete(element);
      state.observer.unobserve(element);
    };
  }, []);

  return ref;
}
