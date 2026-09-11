"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import React from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * Centered aesthetic empty state placeholder with
 * Muted Espresso Brown (#3D2B1F) styling and Frosted Glass frame.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: EmptyStateProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/50 bg-[#FDFBF7]/90 p-8 text-center shadow-sm backdrop-blur-xl sm:p-10">
      {/* Icon frame with muted espresso-brown tone */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#3D2B1F]/15 bg-[rgba(61,43,31,0.06)] text-[#3D2B1F] shadow-sm">
        {icon || (
          <svg
            className="h-7 w-7 text-[#3D2B1F]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        )}
      </div>

      <h3 className="text-lg font-bold text-[#3D2B1F] tracking-tight">{title ?? t("empty.title")}</h3>
      <p className="mt-2 max-w-sm text-sm text-[#5C4A3E] leading-relaxed">{description ?? t("empty.desc")}</p>

      {/* 'Get Started' CTA Button */}
      {(actionHref || onAction) && (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3D2B1F] px-5 py-2.5 text-sm font-semibold text-[#FDFBF7] shadow-sm transition-all hover:bg-[#4E382A] hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#B0C4DE]"
            >
              <span>{actionLabel ?? t("common.getStarted")}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3D2B1F] px-5 py-2.5 text-sm font-semibold text-[#FDFBF7] shadow-sm transition-all hover:bg-[#4E382A] hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#B0C4DE]"
            >
              <span>{actionLabel ?? t("common.getStarted")}</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
