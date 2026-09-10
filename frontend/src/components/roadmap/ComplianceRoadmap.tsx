"use client";

/**
 * The Compliance Roadmap: ask what the business is, then lay out its route.
 *
 * Two screens. First a short intake - what you make, where you make it, what
 * kind of product it is - which may be pre-filled from what the assistant
 * learned in chat. Then the roadmap for the scheme those answers point to,
 * with the Indian Standards actually matched to the product shown above it.
 *
 * The chat pre-fill is offered, never applied silently. It is an inference
 * from conversation, and a roadmap built on the wrong scheme is worse than
 * none, so the user sees what was inferred and confirms or edits it. It is
 * only offered at all when the assistant's own confidence is high or medium -
 * the same bar the chat uses before it will describe someone's business back
 * to them.
 *
 * Ticking a step records what the user says they have done, not confirmation
 * from BIS, and the page says so.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TRACKS,
  guessKind,
  pickScheme,
  progressPercent,
  type BusinessProfile,
  type MadeIn,
  type ProductKind,
  type RoadmapStep,
} from "@/lib/roadmap";
import { searchStandards } from "@/lib/api";
import type { Standard } from "@/lib/types";
import { useChat } from "@/components/chat/ChatProvider";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import Reveal from "@/components/motion/Reveal";
import { useRoadmapProgress } from "./useRoadmapProgress";
import { useRoadmapProfile } from "./useRoadmapProfile";

export default function ComplianceRoadmap() {
  const { profile, save, clear } = useRoadmapProfile();
  const [editing, setEditing] = useState(false);

  if (!profile || editing) {
    return (
      <Intake
        initial={profile}
        onSubmit={(next) => {
          save(next);
          setEditing(false);
        }}
        onCancel={profile ? () => setEditing(false) : undefined}
      />
    );
  }

  return <Roadmap profile={profile} onEdit={() => setEditing(true)} onStartOver={clear} />;
}

// --- intake ---------------------------------------------------------------

const KINDS: ProductKind[] = ["general", "electronics", "jewellery", "machinery"];

function Intake({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: BusinessProfile | null;
  onSubmit: (profile: BusinessProfile) => void;
  onCancel?: () => void;
}) {
  const { t } = useLanguage();
  const { businessContext } = useChat();

  const [product, setProduct] = useState(initial?.product ?? "");
  const [madeIn, setMadeIn] = useState<MadeIn>(initial?.madeIn ?? "india");
  const [kind, setKind] = useState<ProductKind>(initial?.kind ?? "general");
  // Once the user picks a kind by hand *in this session*, stop overwriting it
  // from the text. Not seeded from `initial`: when someone edits their answers
  // and types a different product, the old kind is the one most likely to be
  // wrong - "gold chains" kept the "Electronics" of the LED answer before it.
  const [kindTouched, setKindTouched] = useState(false);

  // Offered only at the chat's own confidence bar; see the file header. One
  // chip per product rather than a joined list: "LED bulbs, cement" is two
  // businesses on two different schemes, and a roadmap can only follow one.
  const fromChat = businessContext?.is_usable ? businessContext.products : [];
  const suggestions = fromChat.filter(
    (item) => item.trim().toLowerCase() !== product.trim().toLowerCase()
  );

  function describe(value: string) {
    setProduct(value);
    if (!kindTouched) setKind(guessKind(value));
  }

  const canSubmit = product.trim().length > 1;

  return (
    <Reveal as="section" className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
        {t("roadmap.eyebrow")}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-gray-900">{t("roadmap.title")}</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">{t("intake.subtitle")}</p>

      {suggestions.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-navy-lighter)] px-4 py-3">
          <p className="text-sm font-semibold text-gray-700">{t("intake.fromChat")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => describe(item)}
                className="rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-navy-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
              >
                {t("intake.useThis")}: {item}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="mt-5 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit({ product: product.trim(), madeIn, kind });
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-gray-900">{t("intake.product")}</span>
          <input
            value={product}
            onChange={(event) => describe(event.target.value)}
            placeholder={t("intake.productPlaceholder")}
            className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-gray-900">{t("intake.madeIn")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["india", "abroad"] as MadeIn[]).map((option) => (
              <Choice
                key={option}
                name="madeIn"
                checked={madeIn === option}
                onChange={() => setMadeIn(option)}
                label={t(`intake.madeIn.${option}`)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-gray-900">{t("intake.kind")}</legend>
          <p className="mt-0.5 text-xs text-gray-500">{t("intake.kindHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {KINDS.map((option) => (
              <Choice
                key={option}
                name="kind"
                checked={kind === option}
                onChange={() => {
                  setKind(option);
                  setKindTouched(true);
                }}
                label={t(`intake.kind.${option}`)}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--color-navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-navy-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("intake.build")}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
            >
              {t("upload.close")}
            </button>
          )}
        </div>
      </form>
    </Reveal>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition focus-within:ring-2 focus-within:ring-[var(--color-navy)] ${
        checked
          ? "border-[var(--color-navy)] bg-[var(--color-navy-lighter)] font-semibold text-[var(--color-navy)]"
          : "border-[var(--color-border)] bg-white text-gray-700 hover:border-[var(--color-navy)]"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

// --- the roadmap ----------------------------------------------------------

function Roadmap({
  profile,
  onEdit,
  onStartOver,
}: {
  profile: BusinessProfile;
  onEdit: () => void;
  onStartOver: () => void;
}) {
  const { t } = useLanguage();
  const { done, toggle, reset, isDone } = useRoadmapProgress();
  const [openId, setOpenId] = useState<string | null>(null);

  const track = TRACKS[pickScheme(profile)];
  const percent = progressPercent(done, track.steps);
  const completed = track.steps.filter((step) => isDone(step.id)).length;
  const nextStep = track.steps.find((step) => !isDone(step.id));

  return (
    <div className="space-y-5">
      <Reveal as="section" className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
              {t("roadmap.title")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">{profile.product}</h2>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{track.name}</span> — {track.because}
            </p>
            <button
              type="button"
              onClick={onEdit}
              className="mt-2 text-xs font-semibold text-[var(--color-navy)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
            >
              {t("intake.change")}
            </button>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-2xl font-bold tabular-nums text-[var(--color-navy)]">{percent}%</p>
            <p className="text-[11px] text-gray-500">
              {completed} / {track.steps.length} {t("roadmap.stepsDone")}
            </p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${completed} of ${track.steps.length}`}
          aria-label={t("roadmap.title")}
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className="h-full rounded-full bg-[var(--color-navy)] transition-[width] duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        {nextStep ? (
          <p className="mt-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-900">{t("roadmap.nextUp")}:</span> {nextStep.title}
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold text-emerald-700">{t("roadmap.allDone")}</p>
        )}
      </Reveal>

      {/* Jewellery is not certified against a product standard the way the
          other tracks are, so the standards panel would be noise there. */}
      {track.id !== "hallmarking" && <MatchedStandards product={profile.product} />}

      <Reveal as="section" delayIndex={1} className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
        <ol className="space-y-2">
          {track.steps.map((step, index) => (
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
              href={track.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--color-navy)] hover:underline"
            >
              bis.gov.in
            </a>
            .
          </p>
          <div className="flex shrink-0 gap-1">
            {completed > 0 && (
              <button
                type="button"
                onClick={reset}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
              >
                {t("roadmap.reset")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                reset();
                onStartOver();
              }}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
            >
              {t("intake.startOver")}
            </button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/**
 * The Indian Standards the catalogue matches to this product.
 *
 * Real rows from the same hybrid search the chat uses. Shown as candidates, not
 * a ruling: matching a free-text product description to a standard is exactly
 * the judgement BIS's technical departments exist to make, and the panel says
 * to confirm with them.
 */
function MatchedStandards({ product }: { product: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<{ for: string; results: Standard[] | null; failed: boolean }>({
    for: "",
    results: null,
    failed: false,
  });

  useEffect(() => {
    let live = true;
    searchStandards(product, 4)
      .then((response) => live && setState({ for: product, results: response.results, failed: false }))
      .catch(() => live && setState({ for: product, results: [], failed: true }));
    return () => {
      live = false;
    };
  }, [product]);

  // Results from a previous product are stale the moment the product changes.
  const results = state.for === product ? state.results : null;
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return (results ?? []).filter((item) => !seen.has(item.is_number) && seen.add(item.is_number));
  }, [results]);

  return (
    <Reveal as="section" className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {t("intake.standardsTitle")}
      </h3>

      {results === null && <p className="mt-2 text-sm text-gray-500">{t("intake.standardsLoading")}</p>}
      {results !== null && unique.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">
          {state.failed ? t("intake.standardsFailed") : t("intake.standardsNone")}
        </p>
      )}

      {unique.length > 0 && (
        <ul className="mt-3 space-y-2">
          {unique.map((standard) => (
            <li key={standard.is_number} className="flex flex-wrap items-baseline gap-2">
              <Link
                href={`/standards/${encodeURIComponent(standard.is_number)}`}
                className="rounded bg-[var(--color-navy-lighter)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[var(--color-navy)] hover:underline"
              >
                {standard.is_number}
              </Link>
              <span className="text-sm text-gray-700">{standard.title}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t("intake.standardsCaveat")}</p>
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
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400">{index + 1}.</span>
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
