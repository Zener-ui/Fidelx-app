// Canonical Fidelx categories. Store these exact values in the database.
const FIDELX_CATEGORIES = [
  "Food",
  "Fashion",
  "Electronics",
  "Beauty",
  "Groceries",
  "Pharmacy",
  "Home & Living",
  "Phones & Accessories",
  "Services",
  "Other",
];

const normalizeCategory = (value) => String(value || "").trim();

const isValidCategory = (value) =>
  FIDELX_CATEGORIES.includes(normalizeCategory(value));

module.exports = { FIDELX_CATEGORIES, normalizeCategory, isValidCategory };
