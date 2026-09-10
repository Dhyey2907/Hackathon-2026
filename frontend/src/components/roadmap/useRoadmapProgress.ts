"use client";

/**
 * Which roadmap steps the user has marked done.
 *
 * Shared through a small external store rather than React context, because two
 * unrelated places need it: the roadmap itself, and the compliance score on the
 * dashboard. A context would mean wrapping the whole app to let one number read
 * one array.
 *
 * Read through `useSyncExternalStore` for the same reason as the language
 * setting - reading localStorage during render disagrees with the server-
 * rendered HTML, and reading it in an effect means setState on every mount.
 * The server snapshot is "nothing done", so the first paint always matches.
 *
 * This lives in the browser only. It is the user's own note of where they have
 * got to, not a claim by BIS that any step is complete, and the interface says
 * so where it shows the number.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "bis-sahayak-roadmap-done";

const EMPTY: string[] = [];

function read(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return EMPTY;
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : EMPTY;
  } catch {
    // Private windows, blocked site data, or a value someone hand-edited.
    return EMPTY;
  }
}

const store = {
  // Cached so getSnapshot returns a stable reference. Returning a fresh array
  // each call would make useSyncExternalStore re-render without end.
  cache: null as string[] | null,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
  getSnapshot(): string[] {
    if (store.cache === null) store.cache = read();
    return store.cache;
  },
  getServerSnapshot(): string[] {
    return EMPTY;
  },
  set(next: string[]) {
    store.cache = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The change still applies for this session.
    }
    store.listeners.forEach((listener) => listener());
  },
};

export function useRoadmapProgress() {
  const done = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = store.getSnapshot();
    store.set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);

  const reset = useCallback(() => store.set([]), []);

  return { done, toggle, reset, isDone: (id: string) => done.includes(id) };
}
