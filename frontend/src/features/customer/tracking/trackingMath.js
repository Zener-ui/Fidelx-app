/**
 * Live rider tracking: pure maths + wording. No React, no network.
 * Turns the backend's tracking payload into exactly what the card shows,
 * and is deliberately honest about uncertainty: it never invents a distance
 * or ETA it does not have.
 */

export const ARRIVING_KM = 0.3;      // closer than this = "Almost there!"
export const STALE_FIX_MS = 90_000;  // a position older than this is shown as "last seen"
const SPEED_KMH = { motorcycle: 22, bicycle: 10 };
const DEFAULT_SPEED_KMH = 20;

const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km between two {lat, lng} points. */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function etaMinutes(remainingKm, vehicle) {
  const speed = SPEED_KMH[vehicle] || DEFAULT_SPEED_KMH;
  return Math.max(1, Math.ceil((remainingKm / speed) * 60));
}

/** "450 m" under a kilometre (rounded to 10 m), "1.2 km" above. */
export function formatDistance(km) {
  if (km < 0.95) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(1)} km`;
}

/** 0 at the store, 1 at the customer. referenceKm = the longest remaining distance seen. */
export function progressFor(remainingKm, referenceKm) {
  if (!(referenceKm > 0)) return 0;
  return Math.min(1, Math.max(0, 1 - remainingKm / referenceKm));
}

function ageText(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  return mins >= 60 ? "over an hour" : `${mins} min`;
}

/**
 * @param {object} p
 * @param {string} p.status        sub-order status (RIDER_ASSIGNED | PICKED_UP | DELIVERING)
 * @param {object|null} p.rider    { lat, lng, last_seen } or null
 * @param {object|null} p.store    { lat, lng } or null
 * @param {object|null} p.destination { lat, lng } or null
 * @param {string|null} p.vehicle
 * @param {number} p.nowMs         "now", already corrected to server time
 * @param {number} [p.maxRemainingKm]  largest remaining distance seen so far in this session
 */
export function describeTracking({ status, rider, store, destination, vehicle, nowMs, maxRemainingKm = 0 }) {
  const base = { mode: "no-fix", progress: 0, approximate: true, remainingKm: null, distanceText: null, etaText: null, ageMs: null };

  if (status === "RIDER_ASSIGNED") {
    return { ...base, mode: "to-store", headline: "Your rider is heading to the store", subline: "They'll pick up your order shortly." };
  }

  // PICKED_UP / DELIVERING: needs a destination to say anything numeric
  if (!destination || !rider) {
    return {
      ...base,
      progress: status === "DELIVERING" ? 0.3 : 0.12,
      headline: "Your rider is on the way",
      subline: "Live location isn't available right now.",
    };
  }

  const remainingKm = haversineKm(rider, destination);
  const totalKm = store ? haversineKm(store, destination) : 0;
  const referenceKm = Math.max(totalKm, maxRemainingKm, remainingKm);
  const distanceText = formatDistance(remainingKm);
  const ageMs = nowMs - Date.parse(rider.last_seen);
  let progress = Math.max(0.04, progressFor(remainingKm, referenceKm));

  if (Number.isFinite(ageMs) && ageMs > STALE_FIX_MS) {
    return { ...base, mode: "stale", progress, approximate: false, remainingKm, distanceText, ageMs,
      headline: "Your rider is on the way", subline: `Last seen ${ageText(ageMs)} ago, about ${distanceText} away` };
  }

  if (remainingKm <= ARRIVING_KM) {
    return { ...base, mode: "arriving", progress: Math.max(progress, 0.97), approximate: false, remainingKm, distanceText, ageMs,
      headline: "Almost there!", subline: "Get your delivery code ready." };
  }

  const eta = etaMinutes(remainingKm, vehicle);
  return { ...base, mode: "live", progress, approximate: false, remainingKm, distanceText, ageMs,
    etaText: `~${eta} min`, headline: `${distanceText} away`, subline: `About ${eta} min until your order arrives` };
}
