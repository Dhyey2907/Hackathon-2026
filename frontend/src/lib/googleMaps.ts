/**
 * Google Maps, loaded once and on demand.
 *
 * The key is NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in frontend/.env.local. It is a
 * browser key - it ships inside the page - so restrict it in Google Cloud to
 * this site's addresses (HTTP referrers) and to the two APIs used here: Maps
 * JavaScript API and Places API (New).
 *
 * The script comes straight from Google, as Google recommends, rather than
 * from an npm package. Only the few types used here are declared, instead of
 * adding @types/google.maps as another dependency.
 */

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const hasGoogleMaps = GOOGLE_MAPS_KEY.trim().length > 0;

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GMap {
  fitBounds(bounds: GLatLngBounds, padding?: number): void;
  setZoom(zoom: number): void;
  setOptions(options: Record<string, unknown>): void;
}

export interface GMarker {
  setMap(map: GMap | null): void;
  addListener(event: string, handler: () => void): void;
}

export interface GInfoWindow {
  setContent(content: string | Node): void;
  open(options: { map: GMap; anchor: GMarker }): void;
}

export interface GLatLngBounds {
  extend(point: LatLngLiteral): void;
  isEmpty(): boolean;
}

export interface PlaceResult {
  location?: { lat(): number; lng(): number };
  displayName?: string;
  formattedAddress?: string;
  googleMapsURI?: string;
}

export interface GoogleMapsApi {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GMap;
  Marker: new (options: Record<string, unknown>) => GMarker;
  InfoWindow: new (options?: Record<string, unknown>) => GInfoWindow;
  LatLngBounds: new () => GLatLngBounds;
  SymbolPath: { CIRCLE: number };
  places: {
    Place: {
      searchByText(request: Record<string, unknown>): Promise<{ places: PlaceResult[] }>;
    };
  };
}

type MapsWindow = Window & {
  google?: { maps?: GoogleMapsApi & { importLibrary?: (name: string) => Promise<unknown> } };
  gm_authFailure?: () => void;
  __bisMapsReady?: () => void;
};

let loading: Promise<GoogleMapsApi> | null = null;

// Google reports a rejected key through a global callback, not the promise:
// the script loads fine and every map then renders "For development purposes
// only". Kept as a tiny store so a component can show the reason.
let authFailed = false;
const authListeners = new Set<() => void>();

export function onAuthFailure(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function mapsAuthFailed(): boolean {
  return authFailed;
}

/**
 * Load the Maps JavaScript API with the Places library. `language` is the
 * interface language, so map labels follow it; it is fixed by the first load.
 */
export function loadGoogleMaps(language: string): Promise<GoogleMapsApi> {
  if (!hasGoogleMaps) return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"));
  if (loading) return loading;

  const w = window as MapsWindow;
  loading = new Promise<GoogleMapsApi>((resolve, reject) => {
    w.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((listener) => listener());
    };
    w.__bisMapsReady = async () => {
      try {
        const maps = w.google?.maps;
        if (!maps) throw new Error("Google Maps did not load");
        await maps.importLibrary?.("places");
        resolve(maps);
      } catch (error) {
        reject(error);
      }
    };
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      v: "weekly",
      loading: "async",
      callback: "__bisMapsReady",
      libraries: "places",
      language,
      region: "IN",
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not reach Google Maps"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// One search per laboratory per visit, shared by every map on the page.
const placeCache = new Map<number, PlaceResult | null>();

/**
 * Where Google puts a laboratory, from its published name and town. Returns
 * null when nothing is found. Callers still check that the answer is in the
 * lab's own city or state - a text search can pick the wrong building.
 */
export async function findLabPlace(
  maps: GoogleMapsApi,
  lab: { id: number; name: string; city: string | null; state: string | null },
): Promise<PlaceResult | null> {
  if (placeCache.has(lab.id)) return placeCache.get(lab.id) ?? null;
  const textQuery = [lab.name, lab.city, lab.state, "India"].filter(Boolean).join(", ");
  try {
    const { places } = await maps.places.Place.searchByText({
      textQuery,
      fields: ["location", "displayName", "formattedAddress", "googleMapsURI"],
      maxResultCount: 1,
      region: "in",
    });
    const place = places[0] ?? null;
    placeCache.set(lab.id, place);
    return place;
  } catch {
    // A quota or permission problem for one lab should not stop the others.
    placeCache.set(lab.id, null);
    return null;
  }
}
