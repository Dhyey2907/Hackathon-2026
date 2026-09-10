"use client";

/**
 * What the user told the roadmap about their business.
 *
 * Same external-store shape as the progress store beside it, for the same
 * reason: localStorage has to be read without disagreeing with the server-
 * rendered HTML, and without a setState in an effect. The server snapshot is
 * "no profile yet", which is also the honest first paint - the intake form.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { BusinessProfile, MadeIn, ProductKind } from "@/lib/roadmap";

const STORAGE_KEY = "bis-sahayak-roadmap-profile";

const MADE_IN: MadeIn[] = ["india", "abroad"];
const KINDS: ProductKind[] = ["general", "electronics", "jewellery", "machinery"];

/** Reject anything that is not a well-formed profile, e.g. a hand-edited value. */
function parse(raw: string | null): BusinessProfile | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<BusinessProfile>;
    if (
      typeof value.product === "string" &&
      value.product.trim() &&
      MADE_IN.includes(value.madeIn as MadeIn) &&
      KINDS.includes(value.kind as ProductKind)
    ) {
      return { product: value.product, madeIn: value.madeIn as MadeIn, kind: value.kind as ProductKind };
    }
  } catch {
    // Fall through.
  }
  return null;
}

const store = {
  // Cached, and keyed on the raw string, so getSnapshot returns a stable object
  // until the stored value actually changes.
  raw: undefined as string | null | undefined,
  value: null as BusinessProfile | null,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
  getSnapshot(): BusinessProfile | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (raw !== store.raw) {
      store.raw = raw;
      store.value = parse(raw);
    }
    return store.value;
  },
  getServerSnapshot(): BusinessProfile | null {
    return null;
  },
  set(next: BusinessProfile | null) {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The change still applies until reload.
    }
    store.listeners.forEach((listener) => listener());
  },
};

export function useRoadmapProfile() {
  const profile = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const save = useCallback((next: BusinessProfile) => store.set(next), []);
  const clear = useCallback(() => store.set(null), []);
  return { profile, save, clear };
}
