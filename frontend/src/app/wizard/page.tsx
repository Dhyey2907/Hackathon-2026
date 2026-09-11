import T from "@/components/i18n/T";
import type { Metadata } from "next";
import WizardFlow from "@/components/wizard/WizardFlow";

export const metadata: Metadata = {
  title: "Product Wizard",
  description: "Find the applicable Indian Standards and certification requirements for your product.",
};

export default function WizardPage() {
  return (
    <main className="flex flex-col h-full overflow-y-auto bg-gray-50" id="main-content">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex-1 flex flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900"><T k="wiz.pageTitle" /></h1>
          <p className="mt-2 text-sm text-gray-600">
            <T k="wiz.pageHint" />
          </p>
        </div>
        
        <WizardFlow />
      </div>
    </main>
  );
}
