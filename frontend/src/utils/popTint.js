// Visual-only helpers for the redesigned (neo-brutalist) screens.
// No data, routing, pricing or business logic lives here.

const TINTS = ["bg-sun", "bg-lime", "bg-coral", "bg-lilac", "bg-mint"];

/** A stable backdrop colour per store/item id, so rows without photos don't read as one flat block. */
export function tintFor(id) {
  const seed = String(id || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TINTS[seed % TINTS.length];
}

/** Status dot colour for a store's availability. */
export const AVAILABILITY_DOT = {
  OPEN: "bg-leaf",
  BUSY: "bg-sun",
  CLOSED: "bg-bad",
  TEMPORARILY_UNAVAILABLE: "bg-bad",
};
