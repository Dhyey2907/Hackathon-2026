import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});



import AppShell from "@/components/AppShell";
import RouteBlurEffect from "@/components/RouteBlurEffect";
import { AuthProvider } from "@/components/auth/AuthProvider";
import LanguageProvider from "@/components/i18n/LanguageProvider";
import { DocumentProvider } from "@/components/documents/DocumentProvider";
import { ChatProvider } from "@/components/chat/ChatProvider";

export const metadata: Metadata = {
  title: {
    default: "BIS Sahayak — Indian Standards Assistant",
    template: "%s | BIS Sahayak",
  },
  description:
    "AI-powered assistant for the Bureau of Indian Standards — certification schemes, hallmarking, testing laboratories, and consumer queries, backed by cited sources.",
  keywords: ["BIS", "Indian Standards", "IS certification", "hallmarking", "QCO"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`flex h-full flex-col text-[var(--color-text-primary)] antialiased ${inter.variable}`}>
        {/* Route-based background blur toggle */}
        <RouteBlurEffect />

        {/* Skip to main content (accessibility) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-navy focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
        >
          Skip to main content
        </a>

        <LanguageProvider>
          <AuthProvider>
            <DocumentProvider>
              <ChatProvider>
                <AppShell>{children}</AppShell>
              </ChatProvider>
            </DocumentProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

