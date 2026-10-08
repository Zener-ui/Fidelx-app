import { UtensilsCrossed, Shirt, Smartphone, Sparkles, Home, Dumbbell, BookOpen, Package } from "lucide-react";

/**
 * Maps a category's stable `slug` (from product_categories) to a real
 * Lucide icon and a distinct, eye-catching color — replacing the emoji
 * that were previously stored directly in the database and rendered
 * as-is. Falls back to a generic package icon for any category slug
 * not listed here (e.g. a new category added later), so this never
 * breaks even if the category list changes.
 */
export const CATEGORY_ICON_MAP = {
  "food-groceries":   { icon: UtensilsCrossed, color: "text-orange-500", bg: "bg-orange-500/10" },
  "fashion-clothing": { icon: Shirt,           color: "text-pink-500",   bg: "bg-pink-500/10" },
  "electronics":      { icon: Smartphone,      color: "text-blue-500",   bg: "bg-blue-500/10" },
  "health-beauty":    { icon: Sparkles,        color: "text-purple-500", bg: "bg-purple-500/10" },
  "home-living":      { icon: Home,            color: "text-amber-500",  bg: "bg-amber-500/10" },
  "sports-fitness":   { icon: Dumbbell,        color: "text-green-500",  bg: "bg-green-500/10" },
  "books-stationery": { icon: BookOpen,        color: "text-indigo-500", bg: "bg-indigo-500/10" },
  other:              { icon: Package,         color: "text-slate-soft", bg: "bg-surface" },
};

export const getCategoryIcon = (slug) => CATEGORY_ICON_MAP[slug] || CATEGORY_ICON_MAP.other;
