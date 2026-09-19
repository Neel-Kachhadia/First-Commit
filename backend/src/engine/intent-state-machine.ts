import type { IntentStatus } from "../models/intent.js";
import { intentRepository } from "../store/intent-repository.js";

/**
 * KavachPay Intent State Machine
 *
 * Defines all valid transitions for the intent lifecycle.
 * Any attempt to move to an unlisted target status will throw.
 *
 * Lifecycle:
 *
 *                  ┌─────────────────┐
 *                  │     PENDING     │
 *                  └────────┬────────┘
 *                           │
 *            ┌──────────────┼──────────────┐
 *            ▼              ▼              ▼
 *   STEP_UP_REQUIRED     RESERVED        DENIED
 *       │                  │
 *   ┌───┴───┐         PAYMENT_CREATED
 *   ▼       ▼            │       │
 * RESERVED DENIED     EXECUTED  FAILED
 *
 * APPROVED → RESERVED (legacy compatibility path)
 */

const TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
  PENDING:           ["STEP_UP_REQUIRED", "RESERVED", "DENIED"],
  STEP_UP_REQUIRED:  ["RESERVED", "DENIED"],
  APPROVED:          ["RESERVED"],          // legacy compat
  RESERVED:          ["PAYMENT_CREATED", "DENIED"],
  PAYMENT_CREATED:   ["EXECUTED", "FAILED"],
  DENIED:            [],                    // terminal
  EXECUTED:          [],                    // terminal
  FAILED:            ["RESERVED"],          // allow retry reservation after failure
  REVERSED:          [],                    // terminal
};

/**
 * Assert that a transition from `from` → `to` is valid.
 * Throws a descriptive error if it is not.
 */
export function assertTransition(
  from: IntentStatus,
  to: IntentStatus
): void {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid intent state transition: ${from} → ${to}. ` +
      `Allowed transitions from ${from}: [${allowed.join(", ") || "none (terminal state)"}].`
    );
  }
}

/**
 * Apply a transition: validate it, then persist to DynamoDB
 * with the expected current status as a condition.
 *
 * The optimistic `expectedStatus` condition on the DynamoDB update
 * prevents two concurrent requests from both successfully
 * transitioning from the same state.
 */
export async function applyTransition(
  intentId: string,
  from: IntentStatus,
  to: IntentStatus,
  metadata?: {
    reason?: string;
    reasonCode?: string;
    blockedItem?: string;
    blockedCategory?: string;
    matchedPolicy?: string;
    providerStatus?: "NOT_INVOKED" | "INVOKED" | "SKIPPED";
  }
): Promise<void> {
  assertTransition(from, to);
  if (metadata) {
    await intentRepository.updateDecision(intentId, { status: to, ...metadata }, from);
  } else {
    await intentRepository.updateStatus(intentId, to, from);
  }
}
