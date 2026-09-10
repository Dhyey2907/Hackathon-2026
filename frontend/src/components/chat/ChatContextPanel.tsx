"use client";

/**
 * The four context cards beside the conversation.
 *
 * Fixed order, always all four: who you are, what certification applies, what
 * the answer cited, and where you can get things tested. The order is the
 * shape of the question a manufacturer actually asks - "this is my business,
 * what do I need, says who, and where do I go" - so it stays put rather than
 * reordering itself around whichever card happens to have content.
 *
 * Each card reveals as it scrolls into view, staggered.
 */

import Reveal from "@/components/motion/Reveal";
import BusinessCard from "./context-cards/BusinessCard";
import CertificationCard from "./context-cards/CertificationCard";
import SourcesCard from "./context-cards/SourcesCard";
import NearbyLabsCard from "./context-cards/NearbyLabsCard";

// Keyed explicitly rather than by `Card.name`, which a production build is
// free to minify.
const CARDS = [
  { key: "business", Card: BusinessCard },
  { key: "certification", Card: CertificationCard },
  { key: "sources", Card: SourcesCard },
  { key: "labs", Card: NearbyLabsCard },
];

export default function ChatContextPanel({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {CARDS.map(({ key, Card }, index) => (
        <Reveal key={key} delayIndex={index}>
          <Card />
        </Reveal>
      ))}
    </div>
  );
}
