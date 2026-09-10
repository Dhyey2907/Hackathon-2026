import type { Metadata } from "next";
import StandardsBrowser from "@/components/standards/StandardsBrowser";

export const metadata: Metadata = { title: "Standards Lookup", description: "Search the BIS standards catalogue." };

export default function StandardsPage() {
  return <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content"><div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-7"><h1 className="text-2xl font-bold text-gray-900">Standards Lookup</h1><p className="mt-2 text-sm text-gray-600">Browse catalogue metadata for Indian Standards and their certification pathways.</p></div><StandardsBrowser /></div></main>;
}