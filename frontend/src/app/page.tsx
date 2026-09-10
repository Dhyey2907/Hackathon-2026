"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ComplianceDashboard from "@/components/dashboard/ComplianceDashboard";
import ChatInput from "@/components/chat/ChatInput";
import { useChat } from "@/components/chat/ChatProvider";

const FEATURES = [
  {
    title: "Chat Assistant",
    description: "Ask questions about standards, licensing, and hallmarking in plain language.",
    href: "/chat",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    title: "Product Wizard",
    description: "Find the applicable Indian Standards and certification requirements for your product.",
    href: "/wizard",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    title: "Standards Lookup",
    description: "Search the BIS catalogue to find standard codes, titles, and scopes.",
    href: "/standards",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: "Lab Finder",
    description: "Locate BIS-recognised testing laboratories by product scope and location.",
    href: "/labs",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Verify License",
    description: "Check the validity of an ISI license number or HUID hallmark.",
    href: "/verify",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const router = useRouter();
  const { input, setInput, sendMessage, isLoading } = useChat();

  function continueInChat() {
    if (!input.trim() || isLoading) return;
    void sendMessage(input);
    router.push("/chat");
  }

  return (
    <main className="home-page flex-1 overflow-y-auto" id="main-content">
      <section className="home-hero relative overflow-hidden border-b border-white/60 px-5 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-14 lg:px-14">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_78%_35%,rgba(255,255,255,0.95),transparent_30%),linear-gradient(135deg,transparent_45%,rgba(220,174,181,0.12)_46%,transparent_62%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Good afternoon,</p>
              <h1 className="mt-2 max-w-[12ch] text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-5xl lg:text-[3.7rem]">
                How can I help you with BIS <span className="text-[#E78B68]">today?</span>
                <span className="ml-2 text-[#F2B15D]" aria-hidden="true">✦</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
                Find standards, check products, understand certification requirements — all in one place.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
                <span className="hero-trust-pill inline-flex items-center gap-2 rounded-full px-3 py-2 shadow-sm ring-1 ring-white/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Official BIS Source
                </span>
                <span className="hero-trust-pill inline-flex items-center gap-2 rounded-full px-3 py-2 shadow-sm ring-1 ring-white/80">
                  <span aria-hidden="true">◈</span> Reliable Information
                </span>
                <span className="hero-trust-pill inline-flex items-center gap-2 rounded-full px-3 py-2 shadow-sm ring-1 ring-white/80">
                  <span aria-hidden="true">♧</span> For Everyone
                </span>
              </div>
            </div>

            <div className="relative hidden min-h-[290px] lg:block" aria-hidden="true">
              <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E8CDBD]/70" />
              <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rotate-[24deg] rounded-full border border-[#D9E3EE]/80" />
              <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[10px] border-white/80 bg-[#252525] shadow-[0_16px_40px_rgba(61,43,31,0.2)]">
                <div className="flex h-16 w-20 items-center justify-center gap-3 rounded-[45%] bg-[#111] text-white shadow-inner">
                  <span className="h-3 w-3 rounded-full bg-[#FFF1E8]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFF1E8]" />
                </div>
              </div>
              <span className="absolute left-[23%] top-[36%] h-3 w-3 rounded-full bg-[#F19B70] shadow-[0_0_0_5px_rgba(241,155,112,0.12)]" />
              <span className="absolute right-[22%] top-[29%] h-2 w-2 rounded-full bg-[#E7A2A7]" />
              <span className="absolute bottom-[18%] left-[30%] h-2 w-2 rounded-full bg-[#F19B70]" />

              <HeroActionCard className="left-0 top-0 rotate-[-7deg]" icon="▤" title="Search" subtitle="Standards" />
              <HeroActionCard className="right-0 top-7 rotate-[6deg]" icon="⌾" title="Scan" subtitle="Product" />
              <HeroActionCard className="bottom-0 right-4 rotate-[-5deg]" icon="◈" title="Get" subtitle="Guidance" />
              <p className="absolute bottom-8 left-[30%] max-w-[10ch] -rotate-[9deg] text-center font-serif text-sm italic leading-5 text-[#9B786C]">
                Same Standards<br />Brighter Tomorrow
              </p>
            </div>
          </div>

          <div className="mt-8 max-w-4xl">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={continueInChat}
              disabled={isLoading}
              placeholder="Ask anything about BIS standards, products or certification..."
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
        {/* Compliance dashboard widget — renders for logged-in users via client-side auth check */}
        <ComplianceDashboard />

        {/* Feature grid */}
        <div className="mt-10">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Tools &amp; Features</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-navy-lighter)] text-[var(--color-navy)] mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 flex-1">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function HeroActionCard({
  className,
  icon,
  title,
  subtitle,
}: {
  className: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className={`hero-action-card absolute w-32 rounded-2xl border p-4 shadow-[0_18px_40px_rgba(22,43,58,0.12)] ${className}`}>
      <div className="text-2xl text-[#D86F42]">{icon}</div>
      <p className="mt-3 text-sm font-semibold leading-4 text-[var(--color-text-primary)]">{title}<br />{subtitle}</p>
      <span className="absolute right-4 top-4 text-lg text-[#D86F42]">→</span>
    </div>
  );
}
