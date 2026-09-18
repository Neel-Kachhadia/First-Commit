/**
 * Single source of truth for KavachPay mandate categories.
 *
 * Imported by:
 *   - backend/src/utils/categories.ts  (re-exports for Node/ESM backend)
 *   - src/lib/kavach-data.ts            (re-exports for Next.js frontend)
 *
 * To add or rename a category, change it here only.
 */
export const MANDATE_CATEGORIES = [
  "Groceries",
  "Pharmacy / Healthcare",
  "Travel",
  "Retail & apparel",
  "Food delivery",
  "Utilities",
] as const;

export type MandateCategory = (typeof MANDATE_CATEGORIES)[number];
