/**
 * /updates — what BIS has published lately.
 *
 * A thin server shell so the route keeps its metadata; the feed itself is a
 * client component because it filters and groups in the browser.
 */

import type { Metadata } from "next";
import UpdatesFeed from "@/components/updates/UpdatesFeed";

export const metadata: Metadata = {
  title: "BIS Updates",
  description:
    "Amendments, quality control orders, licences and announcements published by the Bureau of Indian Standards, newest first.",
};

export default function UpdatesPage() {
  return (
    <main className="flex-1 overflow-y-auto" id="main-content">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <UpdatesFeed />
      </div>
    </main>
  );
}
