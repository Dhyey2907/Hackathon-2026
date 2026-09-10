/**
 * Coordinates for placing a testing laboratory on the map, roughly.
 *
 * BIS publishes a laboratory's city and state and nothing more - the lists
 * carry no street address and no coordinates - so a lab cannot be pinned to
 * where it actually is. What we can do is place it in its city, and failing
 * that in its state, and say plainly which of the two we managed.
 *
 * That distinction matters when it is shown. "12 km" implies a surveyed
 * address; what we have supports "about 12 km to the city centre", and for a
 * state-level match not even that. Anything rendering these numbers must carry
 * the qualifier that `precision` reports.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** How well we could locate a laboratory. */
export type GeoPrecision = "city" | "state" | "unknown";

export interface Located {
  at: LatLng | null;
  precision: GeoPrecision;
}

/** Every state and union territory that appears in the directory. */
export const STATE_COORDS: Record<string, LatLng> = {
  "Andaman and Nicobar Islands": { lat: 11.7401, lng: 92.6586 },
  "Andhra Pradesh": { lat: 15.9129, lng: 79.74 },
  "Arunachal Pradesh": { lat: 28.218, lng: 94.7278 },
  Assam: { lat: 26.2006, lng: 92.9376 },
  Bihar: { lat: 25.0961, lng: 85.3131 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
  Chhattisgarh: { lat: 21.2787, lng: 81.8661 },
  "Dadra and Nagar Haveli and Daman and Diu": { lat: 20.3974, lng: 72.8328 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Goa: { lat: 15.2993, lng: 74.124 },
  Gujarat: { lat: 22.2587, lng: 71.1924 },
  Haryana: { lat: 29.0588, lng: 76.0856 },
  "Himachal Pradesh": { lat: 31.1048, lng: 77.1734 },
  "Jammu and Kashmir": { lat: 33.7782, lng: 76.5762 },
  Jharkhand: { lat: 23.6102, lng: 85.2799 },
  Karnataka: { lat: 15.3173, lng: 75.7139 },
  Kerala: { lat: 10.8505, lng: 76.2711 },
  "Madhya Pradesh": { lat: 22.9734, lng: 78.6569 },
  Maharashtra: { lat: 19.7515, lng: 75.7139 },
  Meghalaya: { lat: 25.467, lng: 91.3662 },
  Nagaland: { lat: 26.1584, lng: 94.5624 },
  Odisha: { lat: 20.9517, lng: 85.0985 },
  Puducherry: { lat: 11.9416, lng: 79.8083 },
  Punjab: { lat: 31.1471, lng: 75.3412 },
  Rajasthan: { lat: 27.0238, lng: 74.2179 },
  Sikkim: { lat: 27.533, lng: 88.5122 },
  "Tamil Nadu": { lat: 11.1271, lng: 78.6569 },
  Telangana: { lat: 18.1124, lng: 79.0193 },
  Tripura: { lat: 23.9408, lng: 91.9882 },
  "Uttar Pradesh": { lat: 26.8467, lng: 80.9462 },
  Uttarakhand: { lat: 30.0668, lng: 79.0193 },
  "West Bengal": { lat: 22.9868, lng: 87.855 },
};

/**
 * City centres, covering the places the directory actually names. Ranked by
 * how many laboratories sit in each, so the common cases resolve precisely and
 * the long tail falls back to its state.
 */
export const CITY_COORDS: Record<string, LatLng> = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  "New Delhi": { lat: 28.6139, lng: 77.209 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Ghaziabad: { lat: 28.6692, lng: 77.4538 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Noida: { lat: 28.5355, lng: 77.391 },
  "Greater Noida": { lat: 28.4744, lng: 77.504 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  "Navi Mumbai": { lat: 19.033, lng: 73.0297 },
  Thane: { lat: 19.2183, lng: 72.9781 },
  Gurugram: { lat: 28.4595, lng: 77.0266 },
  Faridabad: { lat: 28.4089, lng: 77.3178 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Nagpur: { lat: 21.1458, lng: 79.0882 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Mohali: { lat: 30.7046, lng: 76.7179 },
  Sonipat: { lat: 28.9931, lng: 77.0151 },
  Vadodara: { lat: 22.3072, lng: 73.1812 },
  Guwahati: { lat: 26.1445, lng: 91.7362 },
  Rajkot: { lat: 22.3039, lng: 70.8022 },
  Indore: { lat: 22.7196, lng: 75.8577 },
  Kanpur: { lat: 26.4499, lng: 80.3319 },
  Ranchi: { lat: 23.3441, lng: 85.3096 },
  Dehradun: { lat: 30.3165, lng: 78.0322 },
  Ludhiana: { lat: 30.901, lng: 75.8573 },
  Karnal: { lat: 29.6857, lng: 76.9905 },
  Bahadurgarh: { lat: 28.6926, lng: 76.9339 },
  Bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  Raipur: { lat: 21.2514, lng: 81.6296 },
  Kochi: { lat: 9.9312, lng: 76.2673 },
  Jalandhar: { lat: 31.326, lng: 75.5762 },
  Nashik: { lat: 19.9975, lng: 73.7898 },
  Coimbatore: { lat: 11.0168, lng: 76.9558 },
  Surat: { lat: 21.1702, lng: 72.8311 },
  Visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
  Patna: { lat: 25.5941, lng: 85.1376 },
  Jamshedpur: { lat: 22.8046, lng: 86.2029 },
  Thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  Meerut: { lat: 28.9845, lng: 77.7064 },
  Agra: { lat: 27.1767, lng: 78.0081 },
  Varanasi: { lat: 25.3176, lng: 82.9739 },
  Mysuru: { lat: 12.2958, lng: 76.6394 },
  Aurangabad: { lat: 19.8762, lng: 75.3433 },
  Panipat: { lat: 29.3909, lng: 76.9635 },
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

/** Best available position for a laboratory, and how good it is. */
export function locate(city: string | null, state: string | null): Located {
  if (city && CITY_COORDS[city]) return { at: CITY_COORDS[city], precision: "city" };
  if (state && STATE_COORDS[state]) return { at: STATE_COORDS[state], precision: "state" };
  return { at: null, precision: "unknown" };
}

/**
 * A distance written so it cannot be mistaken for a surveyed one. A state-level
 * match is far too coarse to put a number on, so it does not get one.
 */
export function describeDistance(km: number, precision: GeoPrecision): string | null {
  if (precision === "city") {
    // Both ends of this measurement are city centres, so a small number is
    // noise dressed as precision - "~0.0 km" from a lab across town is worse
    // than saying plainly that it is in the same place.
    if (km < 5) return "your city";
    return km < 50 ? `~${Math.round(km)} km` : `~${Math.round(km / 10) * 10} km`;
  }
  if (precision === "state") return "same state";
  return null;
}
