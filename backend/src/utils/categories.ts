/**
 * Re-exports mandate configuration from the repo-level shared package.
 * Path: backend/src/utils/ → ../../.. → repo root → shared/
 */
export {
  MANDATE_CATEGORIES,
  CATEGORY_PRESETS,
  CANONICAL_BRAND_NAMES,
  defaultExpiryDate,
  type MandateCategory,
  type CategoryPreset,
} from "../../../shared/categories.js";
