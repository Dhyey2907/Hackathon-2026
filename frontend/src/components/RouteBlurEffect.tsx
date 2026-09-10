"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Detects route changes and manages the background blur system.
 *
 * Responsibilities:
 * 1. Restores the saved dark/light theme from localStorage.
 * 2. Sets --current-blur on <html>:
 *    - Home (/):        0px  → sharp background (feature background visible)
 *    - All other routes: 8px → atmospheric blur start point
 *    The per-page ScrollOverHero and ChatWindow will then animate this
 *    value downward as the user scrolls or the AI responds.
 */
export default function RouteBlurEffect() {
  const pathname = usePathname();

  // Restore saved theme on every route change
  useEffect(() => {
    const savedTheme = localStorage.getItem("bis-sahayak-theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [pathname]);

  // Set route-based blur via CSS variable
  useEffect(() => {
    const isHome = pathname === "/";
    if (isHome) {
      // Home: sharp background, remove blur class
      document.documentElement.style.setProperty("--current-blur", "0px");
      document.body.classList.remove("bg-blurred");
      document.documentElement.classList.remove("bg-blurred");
    } else {
      // Non-home: start with atmospheric 8px blur.
      // ScrollOverHero / ChatWindow will animate this down on scroll/state change.
      document.documentElement.style.setProperty("--current-blur", "8px");
      document.body.classList.add("bg-blurred");
      document.documentElement.classList.add("bg-blurred");
    }
  }, [pathname]);

  return null;
}
