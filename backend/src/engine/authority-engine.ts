import { randomUUID } from "crypto";

import type { Intent } from "../models/intent.js";
import type {
  Decision,
  DecisionReasonCode,
} from "../models/decision.js";

import {
  calculateEffectiveCapacity,
} from "./effective-capacity.js";

import type { Grant } from "../store/grant-repository.js";

import { metrics } from "../utils/metrics.js";

export class AuthorityEngine {
  /**
   * Main KavachPay authorization pipeline.
   *
   * This function evaluates financial authority.
   *
   * It does NOT execute the payment.
   */
  async evaluate(
    intent: Intent,
    grants: Grant[],
    options?: { isApproval?: boolean }
  ): Promise<Decision> {
    const decisionId = `dec_${randomUUID()}`;
    const now = new Date().toISOString();

    /*
     * 2. Validate the authority path.
     */
    if (grants.length === 0) {
      return this.deny(
        decisionId,
        intent,
        "INVALID_AUTHORITY_PATH",
        "No authority path was supplied.",
        now
      );
    }

    /*
     * The final grant must be the grant requested
     * by the payment intent.
     */
    const targetGrant =
      grants[grants.length - 1];

    if (targetGrant.grantId !== intent.grantId) {
      return this.deny(
        decisionId,
        intent,
        "INVALID_AUTHORITY_PATH",
        "The requested grant is not the terminal grant in the authority path.",
        now
      );
    }

    /*
     * 3. Calculate effective authority.
     */
    const capacity =
      calculateEffectiveCapacity(grants);

    /*
     * 4. Revocation / expiration closure.
     */
    if (capacity.blockedBy) {
      const reasonMap: Record<
        "REVOKED" | "EXPIRED" | "ZERO_RESIDUAL",
        DecisionReasonCode
      > = {
        REVOKED: "GRANT_REVOKED",
        EXPIRED: "GRANT_EXPIRED",
        ZERO_RESIDUAL:
          "EFFECTIVE_CAPACITY_EXCEEDED",
      };

      const reasonCode =
        reasonMap[capacity.blockedBy.reason];

      return this.deny(
        decisionId,
        intent,
        reasonCode,
        `Authority blocked by grant ${capacity.blockedBy.grantId}: ${capacity.blockedBy.reason}.`,
        now,
        capacity.effectiveCapacity,
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0
      );
    }

    /*
     * 5. Scope validation (Category and Merchant allow/deny lists).
     *
     * If the merchant is not approved, wrong category, or denied -> automatically DENIED.
     */
    const scopeResult =
      this.checkScope(
        intent,
        targetGrant
      );

    if (!scopeResult.allowed) {
      return this.deny(
        decisionId,
        intent,
        scopeResult.reasonCode,
        scopeResult.reason,
        now,
        capacity.effectiveCapacity,
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0,
        scopeResult.forensics
      );
    }

    /*
     * 6. Capacity check: Balance left & Monthly authority limit.
     *
     * If the transaction exceeds available balance left or total monthly limit -> automatically DENIED.
     */
    if (
      intent.amount >
      capacity.effectiveCapacity
    ) {
      return this.deny(
        decisionId,
        intent,
        "EFFECTIVE_CAPACITY_EXCEEDED",
        `Requested amount ₹${intent.amount} exceeds remaining authority balance of ₹${capacity.effectiveCapacity}.`,
        now,
        capacity.effectiveCapacity,
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0
      );
    }

    if (
      targetGrant.limit !== undefined &&
      intent.amount > targetGrant.limit
    ) {
      return this.deny(
        decisionId,
        intent,
        "EFFECTIVE_CAPACITY_EXCEEDED",
        `Requested amount ₹${intent.amount} exceeds the period authority limit of ₹${targetGrant.limit}.`,
        now,
        capacity.effectiveCapacity,
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0
      );
    }

    /*
     * 7. Automatic threshold check (Step-up / Needs Approval).
     *
     * - If amount is below or equal to the automatic threshold: directly ACCEPTED (ALLOW).
     * - If amount is more than the automatic threshold, but within balance left & monthly limit:
     *   transitions to "Needs approval" (STEP_UP_REQUIRED) so the user can review and approve or deny.
     *
     * The automatic threshold is represented by stepUpAbove (or hardMax / perTransactionCap).
     */
    const autoThreshold = targetGrant.stepUpAbove ?? targetGrant.hardMax;

    if (
      !options?.isApproval &&
      autoThreshold !== undefined &&
      intent.amount > autoThreshold
    ) {
      return {
        decisionId,
        intentId: intent.intentId,
        userId: intent.userId,
        grantId: intent.grantId,

        decision: "STEP_UP",

        reasonCode:
          "STEP_UP_REQUIRED",

        reason:
          `Transaction amount ₹${intent.amount} exceeds the automatic threshold of ₹${autoThreshold}; awaiting human approval.`,

        amount: intent.amount,
        currency: intent.currency,

        effectiveCapacity:
          capacity.effectiveCapacity,

        grantResidual:
          capacity.residualByGrant[
            targetGrant.grantId
          ] ?? 0,

        reserved: false,

        providerStatus: "NOT_INVOKED",

        createdAt: now,
      };
    }

    /*
     * 9. Everything deterministic in the financial
     * authority layer passed.
     *
     * Policy engine will be evaluated separately.
     */
    const decision: Decision = {
      decisionId,

      intentId: intent.intentId,

      userId: intent.userId,

      grantId: intent.grantId,

      decision: "ALLOW",

      reasonCode: "AUTHORIZED",

      reason:
        "Intent is within scope, transaction limits, and effective authority capacity.",

      amount: intent.amount,

      currency: intent.currency,

      effectiveCapacity:
        capacity.effectiveCapacity,

      grantResidual:
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0,

      reserved: false,

      providerStatus: "NOT_INVOKED",

      createdAt: now,
    };
    
    if (decision.decision === "ALLOW") {
      metrics.logEvent("AUTH_ALLOW", { decisionId, intentId: intent.intentId });
    } else if (decision.decision === "DENY") {
      metrics.logEvent("AUTH_DENY", { decisionId, intentId: intent.intentId, reasonCode: decision.reasonCode });
    }

    return decision;
  }

  private evaluateItemRestrictions(
    intent: Intent,
    grant: {
      blockedCategories?: string[];
      blockedItems?: string[];
    }
  ): {
    blocked: boolean;
    blockedItem?: string;
    blockedCategory?: string;
    matchedPolicy?: string;
    reason?: string;
  } {
    const blockedCategories = (grant.blockedCategories ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
    const blockedItems = (grant.blockedItems ?? []).map((i) => i.trim()).filter(Boolean);

    if (blockedCategories.length === 0 && blockedItems.length === 0) {
      return { blocked: false };
    }

    const categoryKeywords: Record<string, string[]> = {
      ALCOHOL: ["alcohol", "wine", "beer", "whiskey", "vodka", "rum", "liquor", "gin", "champagne", "tequila", "brandy", "cocktail"],
      TOBACCO: ["tobacco", "cigarette", "cigar", "nicotine", "vape", "beedi"],
      GAMBLING: ["gambling", "lottery", "casino", "bet", "betting", "poker", "jackpot"],
    };

    // 1. Evaluate structured items if present
    const items = intent.items ?? [];
    for (const item of items) {
      const itemName = (item.name || "").trim();
      const itemCategory = (item.category || "").trim().toUpperCase();

      // Check category against blockedCategories
      for (const blockedCat of blockedCategories) {
        if (itemCategory && (itemCategory === blockedCat || itemCategory.includes(blockedCat))) {
          return {
            blocked: true,
            blockedItem: itemName || blockedCat,
            blockedCategory: blockedCat,
            matchedPolicy: `blockedCategories.${blockedCat}`,
            reason: `Item "${itemName}" (${itemCategory}) violates policy (blockedCategories.${blockedCat}). PSP execution was not invoked.`,
          };
        }

        // Check if item name contains blocked category keyword
        const keywords = categoryKeywords[blockedCat] ?? [blockedCat.toLowerCase()];
        const itemLower = itemName.toLowerCase();
        for (const kw of keywords) {
          const regex = new RegExp(`\\b${kw}\\b`, "i");
          if (regex.test(itemLower)) {
            return {
              blocked: true,
              blockedItem: itemName,
              blockedCategory: blockedCat,
              matchedPolicy: `blockedCategories.${blockedCat}`,
              reason: `Item "${itemName}" is recognized under prohibited category ${blockedCat} (blockedCategories.${blockedCat}). PSP execution was not invoked.`,
            };
          }
        }
      }

      // Check item name against blockedItems
      for (const blockedItem of blockedItems) {
        const itemLower = itemName.toLowerCase();
        const blockedLower = blockedItem.toLowerCase();
        if (itemLower === blockedLower || itemLower.includes(blockedLower)) {
          return {
            blocked: true,
            blockedItem: itemName,
            matchedPolicy: `blockedItems.${blockedItem}`,
            reason: `Item "${itemName}" violates explicit item restriction (blockedItems.${blockedItem}). PSP execution was not invoked.`,
          };
        }
      }
    }

    // 2. Also inspect intent description for defense-in-depth
    if (intent.description) {
      const descLower = intent.description.toLowerCase();

      // Check blockedCategories keywords in description
      for (const blockedCat of blockedCategories) {
        const keywords = categoryKeywords[blockedCat] ?? [blockedCat.toLowerCase()];
        for (const kw of keywords) {
          const regex = new RegExp(`\\b${kw}\\b`, "i");
          if (regex.test(descLower)) {
            return {
              blocked: true,
              blockedItem: kw,
              blockedCategory: blockedCat,
              matchedPolicy: `blockedCategories.${blockedCat}`,
              reason: `Transaction description mentions prohibited category item "${kw}" (${blockedCat}). PSP execution was not invoked.`,
            };
          }
        }
      }

      // Check blockedItems in description
      for (const blockedItem of blockedItems) {
        const regex = new RegExp(`\\b${blockedItem.toLowerCase()}\\b`, "i");
        if (regex.test(descLower)) {
          return {
            blocked: true,
            blockedItem,
            matchedPolicy: `blockedItems.${blockedItem}`,
            reason: `Transaction description mentions explicitly blocked item "${blockedItem}". PSP execution was not invoked.`,
          };
        }
      }
    }

    return { blocked: false };
  }

  private checkScope(
    intent: Intent,
    grant: {
      category?: string;
      merchantAllow?: string[];
      merchantDeny?: string[];
      blockedCategories?: string[];
      blockedItems?: string[];
    }
  ):
    | {
        allowed: true;
      }
    | {
        allowed: false;
        reasonCode:
          | "SCOPE_DENIED"
          | "MERCHANT_DENIED"
          | "MERCHANT_NOT_ALLOWED"
          | "ITEM_BLOCKED";
        reason: string;
        forensics?: {
          blockedItem?: string;
          blockedCategory?: string;
          matchedPolicy?: string;
        };
      } {
    /*
     * Explicit item & category restrictions check (Item-Level Enforcement Guarantee).
     */
    const itemCheck = this.evaluateItemRestrictions(intent, grant);
    if (itemCheck.blocked) {
      return {
        allowed: false,
        reasonCode: "ITEM_BLOCKED",
        reason: itemCheck.reason || "Transaction violates mandate item-level restrictions.",
        forensics: {
          blockedItem: itemCheck.blockedItem,
          blockedCategory: itemCheck.blockedCategory,
          matchedPolicy: itemCheck.matchedPolicy,
        },
      };
    }

    /*
     * Category restriction (resilient to case, spaces, underscores, slashes).
     */
    const normalizeCategory = (cat?: string) =>
      (cat ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

    if (
      grant.category &&
      normalizeCategory(grant.category) !==
        normalizeCategory(intent.merchant.category)
    ) {
      return {
        allowed: false,
        reasonCode: "SCOPE_DENIED",
        reason:
          `Merchant category "${intent.merchant.category}" does not match the authorized category "${grant.category}".`,
      };
    }

    /*
     * Helper to match merchant against a list, comparing:
     * - Exact string against merchantId or name
     * - Case-insensitive and alphanumeric-normalized string against merchantId or name
     */
    const normalizeMerchant = (s?: string) =>
      (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const matchesMerchantList = (list?: string[]) => {
      if (!list || list.length === 0) return false;
      const idNorm = normalizeMerchant(intent.merchant.merchantId);
      const nameNorm = intent.merchant.name ? normalizeMerchant(intent.merchant.name) : idNorm;
      return list.some((item) => {
        const itemNorm = normalizeMerchant(item);
        return (
          item === intent.merchant.merchantId ||
          item === intent.merchant.name ||
          (idNorm && itemNorm === idNorm) ||
          (nameNorm && itemNorm === nameNorm)
        );
      });
    };

    /*
     * Explicit merchant deny list.
     */
    if (matchesMerchantList(grant.merchantDeny)) {
      return {
        allowed: false,
        reasonCode: "MERCHANT_DENIED",
        reason:
          `Merchant "${intent.merchant.name || intent.merchant.merchantId}" is explicitly denied by the grant.`,
      };
    }

    /*
     * Allow-list enforcement.
     */
    if (
      grant.merchantAllow &&
      grant.merchantAllow.length > 0 &&
      !matchesMerchantList(grant.merchantAllow)
    ) {
      return {
        allowed: false,
        reasonCode:
          "MERCHANT_NOT_ALLOWED",
        reason:
          `Merchant "${intent.merchant.name || intent.merchant.merchantId}" is not present in the grant allow-list.`,
      };
    }

    return {
      allowed: true,
    };
  }

  private deny(
    decisionId: string,
    intent: Intent,
    reasonCode: DecisionReasonCode,
    reason: string,
    createdAt: string,
    effectiveCapacity = 0,
    grantResidual = 0,
    forensics?: {
      blockedItem?: string;
      blockedCategory?: string;
      matchedPolicy?: string;
    }
  ): Decision {
    return {
      decisionId,

      intentId: intent.intentId,

      userId: intent.userId,

      grantId: intent.grantId,

      decision: "DENY",

      reasonCode,

      reason,

      amount: intent.amount,

      currency: intent.currency,

      effectiveCapacity,

      grantResidual,

      reserved: false,

      blockedItem: forensics?.blockedItem,
      blockedCategory: forensics?.blockedCategory,
      matchedPolicy: forensics?.matchedPolicy,
      providerStatus: "NOT_INVOKED",

      createdAt,
    };
  }
}

export const authorityEngine =
  new AuthorityEngine();
