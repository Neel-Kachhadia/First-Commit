import { z } from "zod";

export const DecisionTypeSchema = z.enum([
  "ALLOW",
  "STEP_UP",
  "DENY",
]);

export const DecisionReasonCodeSchema = z.enum([
  "AUTHORIZED",
  "EFFECTIVE_CAPACITY_EXCEEDED",
  "SCOPE_DENIED",
  "MERCHANT_DENIED",
  "MERCHANT_NOT_ALLOWED",
  "GRANT_REVOKED",
  "GRANT_EXPIRED",
  "PER_TXN_LIMIT_EXCEEDED",
  "STEP_UP_REQUIRED",
  "WINDOW_BUDGET_EXCEEDED",
  "SPLIT_PATTERN_EXCEEDED",
  "REPLAY_DETECTED",
  "GRANT_NOT_FOUND",
  "INVALID_AUTHORITY_PATH",
  "RESERVATION_FAILED",
  "POLICY_DENIED",
  "ITEM_BLOCKED",
  "INVALID_INTENT",
  "MAX_DELEGATION_DEPTH_EXCEEDED",
  "MAX_DELEGATION_CHILDREN_EXCEEDED",
]);

export const DecisionSchema = z.object({
  decisionId: z.string().min(1),

  intentId: z.string().min(1),

  userId: z.string().min(1),

  grantId: z.string().min(1),

  decision: DecisionTypeSchema,

  reasonCode: DecisionReasonCodeSchema,

  /**
   * Human-readable explanation of the deciding constraint.
   */
  reason: z.string().min(1),

  amount: z.number().positive(),

  currency: z.string().length(3),

  /**
   * Effective authority available at decision time.
   */
  effectiveCapacity: z.number().nonnegative(),

  /**
   * Remaining authority on the requested grant.
   */
  grantResidual: z.number().nonnegative(),

  /**
   * Whether a reservation was successfully created.
   */
  reserved: z.boolean(),

  /**
   * Forensics for item-level policy violations.
   */
  blockedItem: z.string().optional(),
  blockedCategory: z.string().optional(),
  matchedPolicy: z.string().optional(),
  providerStatus: z.enum(["NOT_INVOKED", "INVOKED", "SKIPPED"]).optional().default("NOT_INVOKED"),

  /**
   * Policy engine result, when evaluated.
   */
  policyDecision: z
    .enum(["ALLOW", "DENY"])
    .optional(),

  createdAt: z.string().datetime(),

  /**
   * Hash/reference for the immutable decision receipt.
   */
  receiptHash: z.string().optional(),
});

export type Decision = z.infer<typeof DecisionSchema>;

export type DecisionType =
  z.infer<typeof DecisionTypeSchema>;

export type DecisionReasonCode =
  z.infer<typeof DecisionReasonCodeSchema>;
