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
    grants: Grant[]
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
     * 5. Single transaction hard limit.
     */
    if (
      targetGrant.hardMax !== undefined &&
      intent.amount > targetGrant.hardMax
    ) {
      return this.deny(
        decisionId,
        intent,
        "PER_TXN_LIMIT_EXCEEDED",
        `Requested amount ₹${intent.amount} exceeds the per-transaction limit of ₹${targetGrant.hardMax}.`,
        now,
        capacity.effectiveCapacity,
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0
      );
    }

    /*
     * 6. Scope validation.
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
        ] ?? 0
      );
    }

    /*
     * 7. Effective capacity check.
     */
    if (
      intent.amount >
      capacity.effectiveCapacity
    ) {
      return this.deny(
        decisionId,
        intent,
        "EFFECTIVE_CAPACITY_EXCEEDED",
        `Requested amount ₹${intent.amount} exceeds effective authority capacity of ₹${capacity.effectiveCapacity}.`,
        now,
        capacity.effectiveCapacity,
        capacity.residualByGrant[
          targetGrant.grantId
        ] ?? 0
      );
    }

    /*
     * 8. Step-up threshold.
     *
     * We do NOT reserve here.
     *
     * Reservation happens after the user/agent
     * satisfies the step-up requirement.
     */
    if (
      targetGrant.stepUpAbove !== undefined &&
      intent.amount >
        targetGrant.stepUpAbove
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
          `Transaction amount ₹${intent.amount} exceeds the step-up threshold of ₹${targetGrant.stepUpAbove}.`,

        amount: intent.amount,
        currency: intent.currency,

        effectiveCapacity:
          capacity.effectiveCapacity,

        grantResidual:
          capacity.residualByGrant[
            targetGrant.grantId
          ] ?? 0,

        reserved: false,

        createdAt: now,
      };
    }

    /*
     * 9. Everything deterministic in the financial
     * authority layer passed.
     *
     * Policy engine will be evaluated separately.
     */
    return {
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

      createdAt: now,
    };
  }

  private checkScope(
    intent: Intent,
    grant: {
      category?: string;
      merchantAllow?: string[];
      merchantDeny?: string[];
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
          | "MERCHANT_NOT_ALLOWED";
        reason: string;
      } {
    /*
     * Category restriction.
     */
    if (
      grant.category &&
      grant.category.toLowerCase() !==
        intent.merchant.category.toLowerCase()
    ) {
      return {
        allowed: false,
        reasonCode: "SCOPE_DENIED",
        reason:
          `Merchant category "${intent.merchant.category}" does not match the authorized category "${grant.category}".`,
      };
    }

    /*
     * Explicit merchant deny list.
     */
    if (
      grant.merchantDeny?.includes(
        intent.merchant.merchantId
      )
    ) {
      return {
        allowed: false,
        reasonCode: "MERCHANT_DENIED",
        reason:
          `Merchant ${intent.merchant.merchantId} is explicitly denied by the grant.`,
      };
    }

    /*
     * Allow-list enforcement.
     */
    if (
      grant.merchantAllow &&
      grant.merchantAllow.length > 0 &&
      !grant.merchantAllow.includes(
        intent.merchant.merchantId
      )
    ) {
      return {
        allowed: false,
        reasonCode:
          "MERCHANT_NOT_ALLOWED",
        reason:
          `Merchant ${intent.merchant.merchantId} is not present in the grant allow-list.`,
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
    grantResidual = 0
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

      createdAt,
    };
  }
}

export const authorityEngine =
  new AuthorityEngine();
