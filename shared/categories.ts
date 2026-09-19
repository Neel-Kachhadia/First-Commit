/**
 * Single source of truth for KavachPay mandate configuration.
 *
 * Imported by:
 *   - backend/src/utils/categories.ts  (re-exports for Node/ESM backend)
 *   - src/lib/kavach-data.ts            (re-exports for Next.js frontend)
 *
 * To add or rename a category, or change its default merchants / purpose,
 * edit this file only — every consumer updates automatically.
 */

// ─── Categories ───────────────────────────────────────────────────────────────

export const MANDATE_CATEGORIES = [
  "Groceries",
  "Pharmacy / Healthcare",
  "Travel",
  "Retail & apparel",
  "Food delivery",
  "Utilities",
] as const;

export type MandateCategory = (typeof MANDATE_CATEGORIES)[number];

// ─── Per-category preset (purpose + default merchants) ────────────────────────
// Used by:
//   - frontend CATEGORY_PRESETS in rules.tsx  (auto-fill on category select)
//   - backend CANONICAL_MERCHANTS in groq-service.ts (NLU context prompt)

export interface CategoryPreset {
  /** One-line description of what the agent is authorised to do. */
  purpose: string;
  /** Canonical merchant names, in preferred display order. */
  merchants: string[];
}

export const CATEGORY_PRESETS: Record<MandateCategory, CategoryPreset> = {
  "Groceries": {
    purpose: "Weekly household restocking from approved grocery merchants.",
    merchants: ["Blinkit", "BigBasket", "Zepto", "JioMart", "Swiggy Instamart", "Dunzo"],
  },
  "Pharmacy / Healthcare": {
    purpose: "Prescription refills and OTC purchases from approved pharmacies.",
    merchants: ["Apollo Pharmacy", "PharmEasy", "Netmeds", "1mg", "MedPlus"],
  },
  "Travel": {
    purpose: "Domestic flights, hotels, and intercity travel within the approved scope.",
    merchants: ["MakeMyTrip", "IRCTC", "Indigo", "Cleartrip", "Goibibo", "Yatra", "RedBus"],
  },
  "Retail & apparel": {
    purpose: "Approved household and apparel replenishment from allowed retailers.",
    merchants: ["Amazon", "Myntra", "AJIO", "Flipkart", "Nykaa", "Meesho"],
  },
  "Food delivery": {
    purpose: "Meal orders from approved food-delivery providers.",
    merchants: ["Swiggy", "Zomato"],
  },
  "Utilities": {
    purpose: "Recurring household utility and telecom payments.",
    merchants: ["BESCOM", "Airtel", "Jio", "BSNL", "Tata Power"],
  },
};

// ─── Flat canonical brand list (for NLU + voice transcription hints) ─────────
// All merchant names from every category preset, deduplicated, plus broader
// fintech / investments / transport brands the model should spell correctly.

export const CANONICAL_BRAND_NAMES: string[] = [
  // Grocery
  "Blinkit", "BigBasket", "Zepto", "JioMart", "Swiggy Instamart", "Dunzo",
  // Pharmacy
  "Apollo Pharmacy", "PharmEasy", "Netmeds", "1mg", "MedPlus",
  // Travel
  "MakeMyTrip", "IRCTC", "Indigo", "Cleartrip", "Goibibo", "Yatra", "RedBus",
  // Retail
  "Amazon", "Myntra", "AJIO", "Flipkart", "Nykaa", "Meesho",
  // Food delivery
  "Swiggy", "Zomato",
  // Utilities
  "BESCOM", "Airtel", "Jio", "BSNL", "Tata Power",
  // Transport (not in presets but common in voice mandates)
  "Ola", "Uber", "Rapido",
  // Electronics
  "Reliance Digital", "Croma", "Vijay Sales", "Decathlon",
  // Fintech
  "Razorpay", "Paytm", "PhonePe", "CRED", "Jupiter", "Fi Money", "Google Pay",
  // Investments
  "Groww", "Zerodha", "Upstox", "INDmoney", "Smallcase", "Navi",
  // E-commerce extras
  "Tata Cliq",
];

// ─── Default expiry helper ────────────────────────────────────────────────────
// Returns the last day of the current calendar month as YYYY-MM-DD.
// Used by the mandate form so the default expiry is always in the future.

export function defaultExpiryDate(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

