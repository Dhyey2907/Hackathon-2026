"use client";

/**
 * The route to a BIS licence, as a checklist the user drives.
 *
 * Each step carries the BIS page it came from, because the value of a checklist
 * like this is entirely in whether its claims can be checked. A fee or a
 * timeline stated here without a link back is just a number this app made up.
 *
 * Ticking a step records what the *user* says they have done. It is not a claim
 * by BIS that anything is complete, and the summary line says so - the
 * difference matters when the thing being tracked is a legal obligation.
 */

import { useState } from "react";
import { ROADMAP, ROADMAP_SOURCE, progressPercent, type RoadmapStep } from "@/lib/roadmap";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useRoadmapProgress } from "./useRoadmapProgress";
import Reveal from "@/components/motion/Reveal";

export default function ComplianceRoadmap() {
  const { t } = useLanguage();
  const { done, toggle, reset, isDone } = useRoadmapProgress();
  const [openId, setOpenId] = useState<string | null>(null);

  const percent = progressPercent(done);
  const completed = ROADMAP.filter((step) => isDone(step.id)).length;
  const nextStep = ROADMAP.find((step) => !isDone(step.id));

  return (
    <Reveal as="section" className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
            {t("roadmap.eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">{t("roadmap.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t("roadmap.subtitle")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums text-[var(--color-navy)]">{percent}%</p>
          <p className="text-[11px] text-gray-500">
            {completed} / {ROADMAP.length} {t("roadmap.stepsDone")}
          </p>
        </div>
      </div>

      {/* Progress bar. aria-valuetext rather than a bare number, so a screen
          reader hears "3 of 10 steps" instead of an unqualified "30". */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${completed} of ${ROADMAP.length}`}
        aria-label={t("roadmap.title")}
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className="h-full rounded-full bg-[var(--color-navy)] transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {nextStep && (
        <p className="mt-3 text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{t("roadmap.nextUp")}:</span>{" "}
          {nextStep.title}
        </p>
      )}
      {!nextStep && (
        <p className="mt-3 text-xs font-semibold text-emerald-700">{t("roadmap.allDone")}</p>
      )}

      <ol className="mt-5 space-y-2">
        {ROADMAP.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            index={index}
            done={isDone(step.id)}
            open={openId === step.id}
            onToggleDone={() => toggle(step.id)}
            onToggleOpen={() => setOpenId((current) => (current === step.id ? null : step.id))}
          />
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="max-w-xl text-[11px] leading-relaxed text-gray-400">
          {t("roadmap.disclaimer")}{" "}
          <a
            href={ROADMAP_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--color-navy)] hover:underline"
          >
            bis.gov.in
          </a>
          .
        </p>
        {completed > 0 && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
          >
            {t("roadmap.reset")}
          </button>
        )}
      </div>
    </Reveal>
  );
}

function StepRow({
  step,
  index,
  done,
  open,
  onToggleDone,
  onToggleOpen,
}: {
  step: RoadmapStep;
  index: number;
  done: boolean;
  open: boolean;
  onToggleDone: () => void;
  onToggleOpen: () => void;
}) {
  const { t } = useLanguage();

  return (
    <li
      className={`rounded-xl border transition ${
        done ? "border-emerald-200 bg-emerald-50/40" : "border-[var(--color-border)] bg-white"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* A real checkbox, so it is reachable by keyboard and announced as a
            checkbox rather than as a decorated div. */}
        <label className="flex cursor-pointer items-center pt-0.5">
          <input
            type="checkbox"
            checked={done}
            onChange={onToggleDone}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--color-navy)] focus:ring-2 focus:ring-[var(--color-navy)]"
          />
          <span className="sr-only">
            {done ? t("roadmap.markNotDone") : t("roadmap.markDone")}: {step.title}
          </span>
        </label>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            className="flex w-full items-start gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
          >
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400">
              {index + 1}.
            </span>
            <span
              className={`flex-1 text-sm font-medium leading-snug ${
                done ? "text-gray-500 line-through decoration-gray-300" : "text-gray-900"
              }`}
            >
              {step.title}
            </span>
            <svg
              className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {open && (
            <div className="mt-2 space-y-2 pl-6">
              <p className="text-sm leading-relaxed text-gray-600">{step.detail}</p>
              {step.timing && (
                <p className="text-xs text-gray-500">
                  <span className="font-semibold">{t("roadmap.timing")}:</span> {step.timing}
                </p>
              )}
              {step.caveat && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                  {step.caveat}
                </p>
              )}
              <a
                href={step.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-navy)] hover:underline"
              >
                {step.sourceLabel}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
