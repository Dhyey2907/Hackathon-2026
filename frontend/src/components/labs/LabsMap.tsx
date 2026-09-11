"use client";

/**
 * Testing laboratories on a Google map.
 *
 * BIS publishes a laboratory's name, city and state - no street address and no
 * coordinates. A pin at the city centre would look like a surveyed address, so
 * each lab's published name and town is searched on Google Maps instead, and a
 * pin is placed only when Google's answer lies in that same city or state. The
 * info window shows Google's address and says where it came from, because a
 * text search can still land on the wrong building.
 *
 * Without NEXT_PUBLIC_GOOGLE_MAPS_API_KEY this renders the placeholder it
 * replaced, with a note on where the key goes.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lab } from "@/lib/types";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { fill } from "@/lib/i18n/format";
import {
  findLabPlace,
  hasGoogleMaps,
  loadGoogleMaps,
  mapsAuthFailed,
  onAuthFailure,
  type GMap,
  type GMarker,
  type GoogleMapsApi,
  type LatLngLiteral,
  type PlaceResult,
} from "@/lib/googleMaps";

const INDIA: LatLngLiteral = { lat: 22.5, lng: 79 };

/** Muted map for the dark theme, drawn from the app's own palette. */
const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#16232d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#c9d1d9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1117" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1f2d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#243442" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a4b5b" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

function themeStyles() {
  return document.documentElement.classList.contains("dark") ? DARK_STYLES : null;
}

/** Google's answer is only trusted when it is in the lab's own town. */
function inLabsTown(address: string | undefined, lab: Lab): boolean {
  if (!address) return false;
  const haystack = address.toLowerCase();
  return [lab.city, lab.state].some((part) => Boolean(part) && haystack.includes((part as string).toLowerCase()));
}

/** Built as DOM nodes, not HTML, so a lab's name can never inject markup. */
function infoContent(lab: Lab, place: PlaceResult, t: (key: string) => string): HTMLElement {
  const box = document.createElement("div");
  box.style.maxWidth = "240px";
  box.style.fontSize = "12px";
  box.style.lineHeight = "1.45";
  box.style.color = "#16212b";
  const name = document.createElement("strong");
  name.textContent = lab.name;
  const address = document.createElement("p");
  address.textContent = place.formattedAddress ?? "";
  address.style.margin = "4px 0";
  const note = document.createElement("p");
  note.textContent = t("map.fromSearch");
  note.style.margin = "0 0 4px";
  note.style.color = "#6b7280";
  box.append(name, address, note);
  if (place.googleMapsURI) {
    const link = document.createElement("a");
    link.href = place.googleMapsURI;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = t("map.openInMaps");
    link.style.color = "#1d4ed8";
    box.append(link);
  }
  return box;
}

interface LabsMapProps {
  labs: Lab[];
  /** The reader's position, when they have shared it. */
  here?: LatLngLiteral | null;
  /** Sizing for the map box, e.g. "h-80" or "aspect-[16/10]". */
  className?: string;
  id?: string;
}

export default function LabsMap({ labs, here = null, className = "", id }: LabsMapProps) {
  const { t, language } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markers = useRef<GMarker[]>([]);
  const [api, setApi] = useState<GoogleMapsApi | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [progress, setProgress] = useState<{ key: string; found: number; done: boolean } | null>(null);
  const authFailed = useSyncExternalStore(onAuthFailure, mapsAuthFailed, () => false);

  useEffect(() => {
    if (!hasGoogleMaps) return;
    let live = true;
    loadGoogleMaps(language)
      .then((maps) => live && setApi(maps))
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [language]);

  // Create the map once the API is ready.
  useEffect(() => {
    if (!api || !container.current || mapRef.current) return;
    mapRef.current = new api.Map(container.current, {
      center: INDIA,
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      styles: themeStyles(),
    });
  }, [api]);

  // Follow the app's theme as it changes.
  useEffect(() => {
    if (!api) return;
    const observer = new MutationObserver(() => mapRef.current?.setOptions({ styles: themeStyles() }));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [api]);

  // Labs and position are tracked by key: the caller may pass a fresh array
  // on every render, and re-searching for that would waste Places requests.
  const labKey = labs.map((lab) => lab.id).join(",");
  const hereKey = here ? `${here.lat},${here.lng}` : "";

  useEffect(() => {
    const map = mapRef.current;
    if (!api || !map) return;
    let live = true;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];
    const info = new api.InfoWindow();
    const bounds = new api.LatLngBounds();

    (async () => {
      let found = 0;
      if (here) {
        bounds.extend(here);
        markers.current.push(
          new api.Marker({
            map,
            position: here,
            title: t("map.you"),
            zIndex: 999,
            icon: {
              path: api.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          }),
        );
      }
      for (const lab of labs) {
        const place = await findLabPlace(api, lab);
        if (!live) return;
        if (!place?.location || !inLabsTown(place.formattedAddress, lab)) continue;
        const position = { lat: place.location.lat(), lng: place.location.lng() };
        const marker = new api.Marker({ map, position, title: lab.name });
        marker.addListener("click", () => {
          info.setContent(infoContent(lab, place, t));
          info.open({ map, anchor: marker });
        });
        markers.current.push(marker);
        bounds.extend(position);
        found += 1;
        setProgress({ key: labKey, found, done: false });
      }
      if (!live) return;
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 48);
        if (found + (here ? 1 : 0) === 1) map.setZoom(12);
      }
      setProgress({ key: labKey, found, done: true });
    })();

    return () => {
      live = false;
    };
    // `labs` and `here` are followed through labKey and hereKey (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, labKey, hereKey]);

  if (!hasGoogleMaps) {
    return (
      <div
        id={id}
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 px-4 py-6 text-center ${className}`}
      >
        <p className="text-[11px] leading-relaxed text-gray-400">
          {t("panel.mapView")}
          <br />
          {t("panel.mapNoKey")}
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">{t("map.keyHint")}</p>
      </div>
    );
  }

  const current = progress?.key === labKey ? progress : null;
  const status = authFailed
    ? t("map.authFailed")
    : loadFailed
    ? t("map.loadFailed")
    : !api
    ? t("map.loading")
    : current?.done
    ? fill(t("map.found"), { found: current.found, n: labs.length })
    : fill(t("map.locating"), { n: labs.length });

  return (
    <div>
      <div
        id={id}
        ref={container}
        role="region"
        aria-label={t("map.title")}
        className={`overflow-hidden rounded-lg border border-[var(--color-border)] bg-gray-100 ${className}`}
      />
      <p
        role="status"
        className={`mt-1.5 text-[11px] leading-relaxed ${authFailed || loadFailed ? "text-amber-700" : "text-[var(--color-text-muted)]"}`}
      >
        {status}
      </p>
    </div>
  );
}
