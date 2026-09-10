/**
 * City centroids, used to put a rough distance on a testing lab.
 *
 * The lab records carry a city name and nothing else - the `labs` table has no
 * latitude or longitude column - so "12 km away" is not available and would be
 * a lie if we printed it. What we can honestly say is how far the user is from
 * the *city* the lab sits in, which is enough to order a list by usefulness.
 *
 * Anything built on this must say "approx." where it shows a number.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Centroids for every city present in the lab directory. */
export const CITY_COORDS: Record<string, LatLng> = {
  Vadodara: { lat: 22.3072, lng: 73.1812 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  "New Delhi": { lat: 28.6139, lng: 77.209 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
};

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Distance from a point to a named city, or null when the city is not one we
 * hold a centroid for. Null means "we don't know" and must render as no
 * distance at all rather than as zero.
 */
export function distanceToCityKm(from: LatLng, city: string): number | null {
  const target = CITY_COORDS[city];
  return target ? haversineKm(from, target) : null;
}

/** "≈ 240 km" / "≈ 8 km" - always hedged, because the target is a city centre. */
export function formatApproxKm(km: number): string {
  return km < 10 ? `≈ ${km.toFixed(1)} km` : `≈ ${Math.round(km)} km`;
}
