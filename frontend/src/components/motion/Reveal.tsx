"use client";

/**
 * Wraps a section so it reveals when scrolled into view.
 *
 * `delayIndex` staggers siblings - pass the map index. The stagger is capped
 * so a long list does not leave its last items waiting seconds to appear;
 * past the cap everything shares the same delay and reveals together.
 */

import type { CSSProperties, ElementType, ReactNode } from "react";
import { useReveal } from "./useReveal";

const STAGGER_MS = 60;
const MAX_STAGGER_STEPS = 6;

interface RevealProps {
  children: ReactNode;
  /** Element to render. Defaults to a div. */
  as?: ElementType;
  /** Position among siblings, for the stagger. */
  delayIndex?: number;
  className?: string;
  /** Anything else lands on the rendered element - aria-live, id, role. */
  [key: string]: unknown;
}

export default function Reveal({
  children,
  as: Tag = "div",
  delayIndex = 0,
  className = "",
  ...rest
}: RevealProps) {
  const ref = useReveal<HTMLElement>();
  const delay = Math.min(delayIndex, MAX_STAGGER_STEPS) * STAGGER_MS;

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}
