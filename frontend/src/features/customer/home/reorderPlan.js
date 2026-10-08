/**
 * "Order again" — pure decision logic. No React, no network, no cart writes.
 * It only turns (past order items + live product records + live store record)
 * into the list of cart items that can safely be added right now.
 *
 * It mirrors the rules the Product page already applies to "Add to cart"
 * (same cart-item shape, same variant pricing, same out-of-stock check, same
 * blocked-store statuses) and is stricter in two places because a reorder
 * replays an OLD order: paused (is_available = false) and soft-deleted
 * products are skipped. Prices always come from the LIVE product, never from
 * the old order. Checkout re-prices on the server regardless.
 */

// Same two statuses ProductPage treats as "store unavailable".
const BLOCKED_STORE_STATUSES = ["CLOSED", "TEMPORARILY_UNAVAILABLE"];

export function isStoreBlocked(vendor) {
  return !vendor || BLOCKED_STORE_STATUSES.includes(vendor.availability_status);
}

/**
 * @param orderItems     sub-order items from GET /sub-orders/order/:id
 *                       ({ product_id, variant_id, quantity, products:{name} })
 * @param productResults Promise.allSettled results of getProduct(), same order as orderItems
 * @param vendor         live store record from GET /vendors/:id
 * @returns { add: cartItem[], skipped: string[], reduced: {name, from, to}[] }
 */
export function buildReorderPlan(orderItems, productResults, vendor) {
  const add = [];
  const skipped = [];
  const reduced = [];

  orderItems.forEach((it, i) => {
    const name = it.products?.name || "An item";
    const r = productResults[i];
    const product = r && r.status === "fulfilled" ? r.value?.product : null;

    if (!product || product.is_available === false || product.deleted_at) {
      skipped.push(name);
      return;
    }

    let stock = product.stock_quantity ?? 0;
    let price = Number(product.price);

    if (it.variant_id) {
      const variant = (product.variants || []).find((v) => v.id === it.variant_id);
      if (!variant) { skipped.push(name); return; }
      stock = variant.stock_quantity ?? 0;
      price = price + Number(variant.price_adjustment || 0);
    }

    if (!(stock > 0) || !Number.isFinite(price)) { skipped.push(name); return; }

    const wanted = Math.max(1, Number(it.quantity) || 1);
    const quantity = Math.min(wanted, stock);
    if (quantity < wanted) reduced.push({ name, from: wanted, to: quantity });

    add.push({
      product_id: product.id || it.product_id,
      variant_id: it.variant_id || null,
      name: product.name,
      price,
      image: product.images?.[0] || null,
      vendor_id: vendor.id,
      vendor_name: vendor.business_name,
      quantity,
    });
  });

  return { add, skipped, reduced };
}

/** One short sentence about anything that could not be added as-is ("" if all good). */
export function describePlanNotes({ skipped, reduced }) {
  const notes = [];
  if (skipped.length) notes.push(`Not available right now: ${skipped.join(", ")}`);
  if (reduced.length) {
    notes.push(`Limited stock: ${reduced.map((r) => `${r.name} (${r.to} of ${r.from})`).join(", ")}`);
  }
  return notes.join(". ");
}

/** "2× Jollof rice, 1× Chicken +1 more" */
export function summarizeItems(items = []) {
  const parts = items.map((it) => `${it.quantity}× ${it.products?.name || "Item"}`);
  return parts.length > 2 ? `${parts.slice(0, 2).join(", ")} +${parts.length - 2} more` : parts.join(", ");
}
