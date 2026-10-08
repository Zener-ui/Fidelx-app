import { buildReorderPlan, isStoreBlocked, describePlanNotes, summarizeItems } from "./reorderPlan.js";
import assert from "node:assert/strict";
const ok = (product) => ({ status: "fulfilled", value: { product } });
const bad = { status: "rejected", reason: new Error("404") };
const vendor = { id: "v1", business_name: "Mama Ngozi", availability_status: "OPEN" };
const P = (o = {}) => ({ id: "p1", name: "Jollof", price: 1500, stock_quantity: 10, is_available: true, deleted_at: null, images: ["a.jpg"], variants: [], ...o });
const it = (o = {}) => ({ product_id: "p1", variant_id: null, quantity: 2, products: { name: "Jollof" }, ...o });
let n = 0; const t = (name, fn) => { fn(); n++; console.log("  pass:", name); };

t("happy path uses LIVE price, exact cart-item shape", () => {
  const r = buildReorderPlan([it()], [ok(P({ price: 1800 }))], vendor);
  assert.deepEqual(r.add, [{ product_id: "p1", variant_id: null, name: "Jollof", price: 1800, image: "a.jpg", vendor_id: "v1", vendor_name: "Mama Ngozi", quantity: 2 }]);
  assert.equal(r.skipped.length + r.reduced.length, 0);
});
t("out of stock is skipped", () => { const r = buildReorderPlan([it()], [ok(P({ stock_quantity: 0 }))], vendor); assert.equal(r.add.length, 0); assert.deepEqual(r.skipped, ["Jollof"]); });
t("quantity is capped to stock and reported", () => { const r = buildReorderPlan([it({ quantity: 5 })], [ok(P({ stock_quantity: 3 }))], vendor); assert.equal(r.add[0].quantity, 3); assert.deepEqual(r.reduced, [{ name: "Jollof", from: 5, to: 3 }]); });
t("paused product skipped", () => assert.equal(buildReorderPlan([it()], [ok(P({ is_available: false }))], vendor).add.length, 0));
t("soft-deleted product skipped", () => assert.equal(buildReorderPlan([it()], [ok(P({ deleted_at: "2026-01-01" }))], vendor).add.length, 0));
t("failed/404 product fetch skipped, others still added", () => { const r = buildReorderPlan([it(), it({ product_id: "p2", products: { name: "Chicken" } })], [bad, ok(P({ id: "p2", name: "Chicken" }))], vendor); assert.equal(r.add.length, 1); assert.deepEqual(r.skipped, ["Jollof"]); });
t("variant: live price = base + adjustment, live variant stock", () => { const r = buildReorderPlan([it({ variant_id: "x" })], [ok(P({ variants: [{ id: "x", price_adjustment: 200, stock_quantity: 4 }] }))], vendor); assert.equal(r.add[0].price, 1700); assert.equal(r.add[0].variant_id, "x"); });
t("variant that no longer exists is skipped", () => assert.equal(buildReorderPlan([it({ variant_id: "gone" })], [ok(P({ variants: [{ id: "x", stock_quantity: 4 }] }))], vendor).add.length, 0));
t("variant out of stock skipped even if base stock is fine", () => assert.equal(buildReorderPlan([it({ variant_id: "x" })], [ok(P({ stock_quantity: 99, variants: [{ id: "x", stock_quantity: 0 }] }))], vendor).add.length, 0));
t("bad price (NaN) is never added", () => assert.equal(buildReorderPlan([it()], [ok(P({ price: undefined }))], vendor).add.length, 0));
t("zero/garbage quantity becomes 1, never 0", () => assert.equal(buildReorderPlan([it({ quantity: 0 })], [ok(P())], vendor).add[0].quantity, 1));
t("store gating matches ProductPage (CLOSED + TEMPORARILY_UNAVAILABLE blocked, BUSY allowed)", () => {
  assert.equal(isStoreBlocked({ availability_status: "CLOSED" }), true);
  assert.equal(isStoreBlocked({ availability_status: "TEMPORARILY_UNAVAILABLE" }), true);
  assert.equal(isStoreBlocked({ availability_status: "BUSY" }), false);
  assert.equal(isStoreBlocked({ availability_status: "OPEN" }), false);
  assert.equal(isStoreBlocked(null), true);
});
t("notes + summary text", () => {
  assert.equal(describePlanNotes({ skipped: [], reduced: [] }), "");
  assert.equal(describePlanNotes({ skipped: ["A", "B"], reduced: [{ name: "C", from: 5, to: 3 }] }), "Not available right now: A, B. Limited stock: C (3 of 5)");
  assert.equal(summarizeItems([{ quantity: 2, products: { name: "Rice" } }, { quantity: 1, products: { name: "Chicken" } }, { quantity: 3, products: { name: "Plantain" } }]), "2× Rice, 1× Chicken +1 more");
});
console.log(`\n${n} / ${n} tests passed`);
