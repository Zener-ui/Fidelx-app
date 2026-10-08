// Run: node src/features/customer/tracking/trackingMath.test.mjs
import assert from "node:assert/strict";
import { haversineKm, etaMinutes, formatDistance, progressFor, describeTracking, ARRIVING_KM, STALE_FIX_MS } from "./trackingMath.js";

let n = 0; const t = (name, fn) => { fn(); n++; console.log("  pass:", name); };
const NOW = Date.parse("2026-10-05T12:00:00Z");
const fix = (lat, lng, agoMs = 5000) => ({ lat, lng, last_seen: new Date(NOW - agoMs).toISOString() });
// Roughly 111 m per 0.001 degree of latitude. Store -> home is ~2.2 km due north.
const STORE = { lat: 6.4300, lng: 8.1400 }, HOME = { lat: 6.4500, lng: 8.1400 };
const base = { status: "DELIVERING", store: STORE, destination: HOME, vehicle: "motorcycle", nowMs: NOW };

t("haversine: known distances", () => {
  assert.ok(Math.abs(haversineKm(STORE, HOME) - 2.224) < 0.01);
  assert.equal(haversineKm(HOME, HOME), 0);
  assert.ok(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.19) < 0.1);
});
t("distance formatting", () => {
  assert.equal(formatDistance(0.04), "40 m"); assert.equal(formatDistance(0.003), "10 m");
  assert.equal(formatDistance(0.452), "450 m"); assert.equal(formatDistance(0.94), "940 m");
  assert.equal(formatDistance(0.96), "1.0 km"); assert.equal(formatDistance(1.234), "1.2 km"); assert.equal(formatDistance(12.04), "12.0 km");
});
t("ETA: vehicle speed, rounded UP, never zero", () => {
  assert.equal(etaMinutes(11, "motorcycle"), 30);   // 11 km at 22 km/h
  assert.equal(etaMinutes(5, "bicycle"), 30);       // 5 km at 10 km/h
  assert.equal(etaMinutes(1, null), 3);             // default 20 km/h
  assert.equal(etaMinutes(0.001, "motorcycle"), 1);
});
t("progress: clamped 0..1, safe with a zero reference", () => {
  assert.equal(progressFor(2, 2), 0); assert.equal(progressFor(1, 2), 0.5); assert.equal(progressFor(0, 2), 1);
  assert.equal(progressFor(5, 2), 0); assert.equal(progressFor(-1, 2), 1); assert.equal(progressFor(1, 0), 0);
});
t("RIDER_ASSIGNED: heading to the store, no distance or ETA invented", () => {
  const v = describeTracking({ ...base, status: "RIDER_ASSIGNED", rider: fix(6.4, 8.14) });
  assert.equal(v.mode, "to-store"); assert.equal(v.etaText, null); assert.equal(v.distanceText, null); assert.equal(v.progress, 0);
});
t("no rider position: honest 'on the way', approximate bar, NO numbers", () => {
  const picked = describeTracking({ ...base, status: "PICKED_UP", rider: null });
  assert.equal(picked.mode, "no-fix"); assert.equal(picked.etaText, null); assert.equal(picked.distanceText, null); assert.equal(picked.approximate, true); assert.equal(picked.progress, 0.12);
  assert.equal(describeTracking({ ...base, rider: null }).progress, 0.3);
  assert.equal(describeTracking({ ...base, rider: fix(6.44, 8.14), destination: null }).mode, "no-fix");   // can't measure without a destination
});
t("live: halfway there", () => {
  const v = describeTracking({ ...base, rider: fix(6.44, 8.14) });                     // ~1.1 km left of ~2.2 km
  assert.equal(v.mode, "live"); assert.ok(Math.abs(v.progress - 0.5) < 0.02, String(v.progress));
  assert.equal(v.distanceText, "1.1 km"); assert.equal(v.etaText, "~4 min"); assert.equal(v.headline, "1.1 km away"); assert.equal(v.approximate, false);
});
t("progress only moves forward as the rider approaches", () => {
  const ps = [6.432, 6.438, 6.444, 6.448].map((lat) => describeTracking({ ...base, rider: fix(lat, 8.14) }).progress);
  for (let i = 1; i < ps.length; i++) assert.ok(ps[i] > ps[i - 1], ps.join(","));
});
t("almost there: inside the arriving distance, not just outside it", () => {
  const justOutside = { lat: 6.4470, lng: 8.14 };                                      // ~333 m from home
  assert.ok(haversineKm(HOME, justOutside) > ARRIVING_KM);
  assert.equal(describeTracking({ ...base, rider: fix(justOutside.lat, justOutside.lng) }).mode, "live");
  const near = describeTracking({ ...base, rider: fix(6.4485, 8.14) });                // ~167 m
  assert.ok(haversineKm(HOME, { lat: 6.4485, lng: 8.14 }) < ARRIVING_KM);
  assert.equal(near.mode, "arriving"); assert.equal(near.headline, "Almost there!"); assert.ok(near.progress >= 0.97); assert.equal(near.etaText, null);
  assert.equal(describeTracking({ ...base, rider: fix(6.45, 8.14) }).mode, "arriving"); // standing at the door
});
t("stale position: greyed 'last seen', no ETA, keeps last distance", () => {
  const v = describeTracking({ ...base, rider: fix(6.44, 8.14, STALE_FIX_MS + 1000) });
  assert.equal(v.mode, "stale"); assert.equal(v.etaText, null); assert.match(v.subline, /^Last seen 2 min ago, about 1\.1 km away$/);
  assert.equal(describeTracking({ ...base, rider: fix(6.44, 8.14, STALE_FIX_MS - 1000) }).mode, "live");
  assert.match(describeTracking({ ...base, rider: fix(6.44, 8.14, 3 * 3600_000) }).subline, /Last seen over an hour ago/);
});
t("rider far from the route: bar starts at the start and never goes negative", () => {
  const far = describeTracking({ ...base, rider: fix(6.38, 8.14) });                  // 7.7 km away, farther than the store
  assert.ok(far.progress >= 0.04 && far.progress <= 0.05, String(far.progress));
  const later = describeTracking({ ...base, rider: fix(6.42, 8.14), maxRemainingKm: haversineKm({ lat: 6.38, lng: 8.14 }, HOME) });
  assert.ok(later.progress > far.progress);
});
t("missing store: progress is still sensible using the longest distance seen", () => {
  const v = describeTracking({ ...base, store: null, rider: fix(6.44, 8.14), maxRemainingKm: 2.2 });
  assert.ok(Math.abs(v.progress - 0.5) < 0.03, String(v.progress));
  assert.equal(describeTracking({ ...base, store: null, rider: fix(6.44, 8.14) }).progress, 0.04);   // first fix, nothing to compare to
});
console.log(`\n${n} / ${n} tests passed`);
