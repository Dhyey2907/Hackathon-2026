/**
 * /roadmap — the Compliance Roadmap.
 *
 * A thin server shell so the route keeps its metadata; the roadmap itself is a
 * client component because it tracks what the user has ticked off.
 */

import type { Metadata } from "next";
import ComplianceRoadmap from "@/components/roadmap/ComplianceRoadmap";

export const metadata: Metadata = {
  title: "Compliance Roadmap",
  description:
    "The route to a BIS licence, step by step, drawn from the Bureau's own published process — with each step linking back to its source.",
};

export default function RoadmapPage() {
  return (
    <main className="flex-1 overflow-y-auto" id="main-content">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <ComplianceRoadmap />
      </div>
    </main>
  );
}
