"use client";

/**
 * Testing laboratories, from BIS's published directory.
 *
 * Real rows now - the ten fixtures with invented phone numbers are gone, and
 * with them the Sample data badge. What remains to be careful about is
 * position, because BIS publishes a laboratory's city and state and nothing
 * finer. A lab therefore cannot be pinned to where it is, only to its city,
 * and for the long tail of towns we do not hold, only to its state. `locate`
 * reports which of the two it managed and the distance is written to match -
 * "~12 km" for a city, "same region" for a state, nothing at all otherwise.
 *
 * Geolocation is asked for on a click, never on mount: a permission prompt
 * that appears by itself the moment a chat page loads is startling and, most
 * of the time, unwanted.
 */

import { fill } from "@/lib/i18n/format";
import { useEffect, useState } from "react";
import Link from "next/link";
import { findLabs } from "@/lib/api";
import type { Lab } from "@/lib/types";
import { describeDistance, haversineKm, locate, type LatLng } from "@/lib/geo";
import ContextCard from "./ContextCard";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; at: LatLng }
  | { status: "unavailable"; message: string };

const VISIBLE_LABS = 4;

export default function NearbyLabsCard() {
  const { t } = useLanguage();
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: "idle" });

  useEffect(() => {
    let live = true;
    // Recognised laboratories only here: the panel has room for four, and a
    // Group 2 facility is not somewhere you can send a sample for a licence.
    findLabs({ recognisedOnly: true })
      .then((response) => live && setLabs(response.results))
      .catch(() => live && setLabs([]));
    return () => {
      live = false;
    };
  }, []);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocation({ status: "unavailable", message: "noGeo" });
      return;
    }
    if (!window.isSecureContext) {
      setLocation({ status: "unavailable", message: "needHttps" });
      return;
    }
    setLocation({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocation({
          status: "ready",
          at: { lat: position.coords.latitude, lng: position.coords.longitude },
        }),
      () =>
        // Declining is a normal answer, not an error. The list stays as it was.
        setLocation({
          status: "unavailable",
          message: "locationDeclined",
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  const here = location.status === "ready" ? location.at : null;

  const ranked = (labs ?? [])
    .map((lab) => {
      const { at, precision } = locate(lab.city, lab.state);
      const km = here && at ? haversineKm(here, at) : null;
      return { lab, km, precision };
    })
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  if (labs === null) {
    return <ContextCard title={t("panel.labs")} awaiting={t("panel.labsLoading")} />;
  }
  if (labs.length === 0) {
    return (
      <ContextCard
        title={t("panel.labs")}
        awaiting={t("panel.labsUnreachable")}
      />
    );
  }

  return (
    <ContextCard title={t("panel.labs")} badge={`${labs.length}`}>
      {/* Map slot: keeps its aspect so nothing reflows when a real map is
          dropped in. When one is, it must be a genuine place search - plotting
          pins at these city centres would read as surveyed lab addresses. */}
      <div
        id="chat-labs-map"
        className="mb-3 flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 text-center"
      >
        <p className="px-4 text-[11px] leading-relaxed text-gray-400">
          {t("panel.mapView")}
          <br />
          {t("panel.mapNoKey")}
        </p>
      </div>

      {location.status !== "ready" && (
        <button
          type="button"
          onClick={requestLocation}
          disabled={location.status === "locating"}
          className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-navy)] transition hover:bg-[var(--color-navy-lighter)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] disabled:opacity-60"
        >
          {location.status === "locating" ? t("panel.locating") : t("panel.sortByDistance")}
        </button>
      )}

      {location.status === "unavailable" && (
        <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
          {t(`panel.${location.message}`)}
        </p>
      )}

      <ul className="space-y-3" aria-label={t("panel.labsAria")}>
        {ranked.slice(0, VISIBLE_LABS).map(({ lab, km, precision }) => {
          const described = km === null ? null : describeDistance(km, precision);
          const distance =
            described === "your city" ? t("geo.yourCity") : described === "same state" ? t("geo.sameState") : described;
          return (
            <li key={lab.id}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold leading-snug text-gray-900">{lab.name}</p>
                {distance && (
                  <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{distance}</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {[lab.city, lab.state].filter(Boolean).join(", ") || t("labs.locationUnknown")}
                {lab.category ? ` · ${lab.category}` : ""}
              </p>
              {lab.operative === false && (
                <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                  {t("panel.suspended")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-gray-100 pt-2">
        <Link href="/labs" className="text-[11px] font-semibold text-[var(--color-navy)] hover:underline">
          {fill(t("panel.seeAll"), { n: labs.length })}
        </Link>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
          {t("panel.labsCaveat")}
        </p>
      </div>
    </ContextCard>
  );
}
