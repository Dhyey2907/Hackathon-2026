import type { Metadata } from "next";
import LabFinder from "@/components/labs/LabFinder";

export const metadata: Metadata = { title: "Lab Finder", description: "Find BIS-recognised testing laboratories." };

export default function LabsPage() {
  return <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content"><div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-7"><h1 className="text-2xl font-bold text-gray-900">Lab Finder</h1><p className="mt-2 text-sm text-gray-600">Locate BIS-recognised testing laboratories by product category and location.</p></div><LabFinder /></div></main>;
}