"use client";

/**
 * Testing laboratories, ordered by roughly how far away they are.
 *
 * Two honesty problems this card has to hold at arm's length.
 *
 * The directory is not real yet. The `labs` table is empty, so this falls back
 * to the ten fixture rows the Lab Finder screen uses. Several carry the names
 * of genuine institutions with invented contact details, so the badge stays on
 * permanently and the phone numbers and e-mail addresses are not rendered at
 * all - a name plus a fake number is what makes a fixture read as a directory
 * entry someone might actually dial.
 *
 * The distances are city-level. Lab records have no coordinates, only a city,
 * so every number here is the distance to that city's centre and is written
 * with a "≈" in front of it.
 *
 * The map is a slot, not a map. Google Maps has no key configured yet; the box
 * holds its shape and aspect so the embed drops straight in later.
 */

import { useState } from "react";
import { MOCK_LABS } from "@/lib/mock-labs";
import { distanceToCityKm, formatApproxKm, type LatLng } from "@/lib/city-coords";
import ContextCard from "./ContextCard";

type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; at: LatLng }
  | { status: "denied"; message: string };

const VISIBLE_LABS = 4;

export default function NearbyLabsCard() {
  const [location, setLocation] = useState<LocationState>({ status: "idle" });

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocation({ status: "denied", message: "This browser cannot share a location." });
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
        // Denial is a normal answer, not an error state. The list stays.
        setLocation({
          status: "denied",
          message: "Location not shared — showing labs in directory order.",
        }),
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  const here = location.status === "ready" ? location.at : null;
  const labs = MOCK_LABS.map((lab) => ({
    lab,
    km: here ? distanceToCityKm(here, lab.city) : null,
  }));

  if (here) {
    labs.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }

  return (
    <ContextCard title="Nearby testing labs" badge="Sample data" badgeTone="warning">
      {/* Map slot — keeps its aspect so the page does not reflow when a real
          map is dropped in here. */}
      <div
        id="chat-labs-map"
        className="mb-3 flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 text-center"
      >
        <p className="px-4 text-[11px] leading-relaxed text-gray-400">
          Map view
          <br />
          Google Maps key not configured
        </p>
      </div>

      {location.status !== "ready" && (
        <button
          type="button"
          onClick={requestLocation}
          disabled={location.status === "locating"}
          className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-navy)] transition hover:bg-[var(--color-navy-lighter)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] disabled:opacity-60"
        >
          {location.status === "locating" ? "Finding you…" : "Use my location"}
        </button>
      )}

      {location.status === "denied" && (
        <p className="mb-3 text-[11px] leading-relaxed text-gray-500">{location.message}</p>
      )}

      <ul className="space-y-3" aria-label="Testing laboratories">
        {labs.slice(0, VISIBLE_LABS).map(({ lab, km }) => (
          <li key={lab.id}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold leading-snug text-gray-900">{lab.name}</p>
              {km !== null && (
                <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                  {formatApproxKm(km)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {lab.city}, {lab.state} · {lab.status}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {lab.scopes.join(", ")}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-400">
        Example entries while the BIS laboratory directory is being loaded — contact details are
        not shown because these rows do not carry real ones.
        {here && " Distances are to the city centre, not the laboratory."}
      </p>
    </ContextCard>
  );
}
