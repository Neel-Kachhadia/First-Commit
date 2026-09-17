import { createHash } from "crypto";
import type { Decision } from "../models/decision.js";
import { decisionRepository } from "../store/decision-repository.js";

export class ReceiptService {
  /**
   * Finalizes a decision by calculating a deterministic receipt hash
   * and storing both the decision and its receipt together.
   */
  async finalizeDecision(decision: Decision): Promise<Decision> {
    const canonicalPayload = {
      intentId: decision.intentId,
      decisionId: decision.decisionId,
      grantId: decision.grantId,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      amount: decision.amount,
      currency: decision.currency,
      effectiveCapacity: decision.effectiveCapacity,
      reserved: decision.reserved,
      createdAt: decision.createdAt,
    };

    const hash = createHash("sha256")
      .update(JSON.stringify(canonicalPayload))
      .digest("hex");

    decision.receiptHash = hash;

    // 1. Persist the main decision record
    await decisionRepository.createDecision(decision);

    // 2. Persist the standalone immutable receipt
    await decisionRepository.createReceipt(decision, hash);

    return decision;
  }
}

export const receiptService = new ReceiptService();
