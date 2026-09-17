/**
 * KavachPay — AP2 Adapter
 *
 * Normalizes an external Google AP2 Mandate into KavachPay's
 * internal Financial Intent Contract (CreateGrantInput).
 */

import type { CreateGrantInput } from "../services/grant-service.js";

/**
 * Temporary normalized representation for the demo.
 * Replace with the pinned AP2 SDK/model types once AP2 dependency
 * is integrated.
 */
export interface Ap2MandateInput {
  mandate_id: string;
  agent_id: string;
  principal_id: string;

  limits: {
    total_budget: number;
    transaction_maximum?: number;
    currency: string;
  };

  rules: {
    allowed_merchants?: string[];
    blocked_merchants?: string[];
    allowed_categories?: string[];
  };

  validity: {
    start_time: string;
    end_time: string;
  };
}

export class Ap2Adapter {
  /**
   * Normalizes an AP2 Mandate into a KavachPay Financial Intent Contract.
   *
   * Enforces rules:
   * - start_time cannot be in the future (KavachPay activates immediately).
   * - only a single allowed_category is supported natively right now.
   *
   * @param mandate The external AP2 mandate payload
   * @param label A user-friendly label for the generated grant
   * @param parentGrantId Optional parent grant for delegation
   */
  normalizeMandate(
    mandate: Ap2MandateInput,
    label: string,
    parentGrantId?: string
  ): CreateGrantInput {
    // 1. Validate start time
    const now = new Date();
    const startTime = new Date(mandate.validity.start_time);
    
    // We allow a small grace period for clock skew
    if (startTime.getTime() - now.getTime() > 60000) {
      throw new Error(
        "KavachPay currently activates grants immediately. Future start_time is not supported."
      );
    }

    // 2. Validate categories
    const categories = mandate.rules.allowed_categories ?? [];
    if (categories.length > 1) {
      throw new Error(
        "KavachPay currently supports a maximum of 1 category restriction per mandate."
      );
    }
    const category = categories.length === 1 ? categories[0] : undefined;

    // 3. Map to CreateGrantInput
    return {
      userId: mandate.principal_id,
      label,
      parentGrantId,
      currency: mandate.limits.currency,
      limit: mandate.limits.total_budget,
      window: "WEEKLY", // Defaulting to WEEKLY as a sane default for the demo since AP2 doesn't specify window
      windowStart: now.toISOString(),
      hardMax: mandate.limits.transaction_maximum ?? mandate.limits.total_budget,
      category,
      merchantAllow: mandate.rules.allowed_merchants ?? [],
      merchantDeny: mandate.rules.blocked_merchants ?? [],
      expiresAt: mandate.validity.end_time,
      delegationEnabled: true, // Typically true for root agents in demo
      maxDepth: 3,             // Sane default
      maxChildren: 10,         // Sane default
      evidence: {
        sourceProtocol: "AP2",
        mandateRef: mandate.mandate_id,
        signedBy: mandate.agent_id,
      }
    };
  }
}

export const ap2Adapter = new Ap2Adapter();
