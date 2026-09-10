import type { Metadata } from "next";
import VerificationForm from "@/components/verify/VerificationForm";

export const metadata: Metadata = { title: "Verify License", description: "Verify an ISI license number or HUID." };

export default function VerifyPage() {
  return <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content"><div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-7"><h1 className="text-2xl font-bold text-gray-900">Verify BIS Mark</h1><p className="mt-2 max-w-2xl text-sm text-gray-600">Check an ISI license or a gold hallmark HUID against a local demonstration record.</p></div><VerificationForm /><p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-5 text-gray-500">This is a mock verification flow for the prototype. For official status, use the current BIS verification service.</p></div></main>;
}