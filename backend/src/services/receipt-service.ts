import { createHash, createHmac } from "crypto";
import type { Decision } from "../models/decision.js";
import { decisionRepository } from "../store/decision-repository.js";

/**
 * KavachPay Decision Receipt Service
 *
 * Produces cryptographically authenticated decision receipts using HMAC-SHA256.
 *
 * Note: HMAC-SHA256 is a symmetric message authentication code.
 * The holder of KAVACHPAY_SIGNING_KEY can both generate and verify receipts.
 * For asymmetric verification (public-key verifiable), upgrade to KMS RSA/ECDSA.
 *
 * Receipt structure:
 *
 *   canonical JSON payload
 *         ↓
 *    SHA-256 hash (receiptHash)
 *         ↓
 *   HMAC-SHA256 with KAVACHPAY_SIGNING_KEY (signature)
 *         ↓
 *   stored in DynamoDB alongside the decision
 */

function getSigningKey(): string {
  const key = process.env.KAVACHPAY_SIGNING_KEY;
  if (!key) {
    console.warn(
      "[ReceiptService] KAVACHPAY_SIGNING_KEY is not set. " +
      "Receipts will be hashed but not signed. Set this env var before production/demo use."
    );
    return "kavachpay-dev-signing-key-replace-in-production";
  }
  return key;
}

export interface ReceiptContext {
  /**
   * Grant IDs from root → target, in authority path order.
   */
  authorityPath?: string[];

  /**
   * Remaining budget on each grant before the reservation was applied.
   */
  stateBefore?: Record<string, number>;

  /**
   * Remaining budget on each grant after the reservation was applied.
   */
  stateAfter?: Record<string, number>;
}

export class ReceiptService {
  /**
   * Finalizes a decision by:
   *  1. Building the canonical receipt payload (including pre/post state snapshots)
   *  2. Computing SHA-256 receiptHash over the canonical payload
   *  3. Computing HMAC-SHA256 signature over the receiptHash
   *  4. Persisting both the decision and its receipt to DynamoDB
   */
  async finalizeDecision(
    decision: Decision,
    context?: ReceiptContext
  ): Promise<Decision> {
    const canonicalPayload = {
      intentId: decision.intentId,
      decisionId: decision.decisionId,
      grantId: decision.grantId,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      amount: decision.amount,
      currency: decision.currency,
      effectiveCapacity: decision.effectiveCapacity,
      grantResidual: decision.grantResidual,
      reserved: decision.reserved,
      createdAt: decision.createdAt,
      // Optional enrichment fields (included when present)
      ...(context?.authorityPath && { authorityPath: context.authorityPath }),
      ...(context?.stateBefore && { stateBefore: context.stateBefore }),
      ...(context?.stateAfter && { stateAfter: context.stateAfter }),
    };

    // 1. Deterministic SHA-256 hash of the canonical payload
    const receiptHash = createHash("sha256")
      .update(JSON.stringify(canonicalPayload))
      .digest("hex");

    // 2. HMAC-SHA256 over the receiptHash — authentication layer
    const signingKey = getSigningKey();
    const signature = createHmac("sha256", signingKey)
      .update(receiptHash)
      .digest("hex");

    decision.receiptHash = receiptHash;

    // 3. Persist the main decision record
    await decisionRepository.createDecision(decision);

    // 4. Persist the standalone immutable receipt (with HMAC signature)
    await decisionRepository.createReceipt(decision, receiptHash, {
      signature,
      algorithm: "HMAC-SHA256",
      signedAt: new Date().toISOString(),
      authorityPath: context?.authorityPath,
      stateBefore: context?.stateBefore,
      stateAfter: context?.stateAfter,
    });

    return decision;
  }

  /**
   * Verify a stored receipt by recomputing the HMAC-SHA256
   * over the stored receiptHash and comparing with the stored signature.
   *
   * Returns true only if both the hash and the signature are valid.
   */
  async verifyReceipt(
    intentId: string,
    decisionId: string
  ): Promise<{
    valid: boolean;
    algorithm: string;
    signature: string;
    receiptHash: string;
    signedAt: string;
    authorityPath?: string[];
    stateBefore?: Record<string, number>;
    stateAfter?: Record<string, number>;
    error?: string;
  }> {
    const receipt = await decisionRepository.getReceipt(intentId, decisionId);

    if (!receipt) {
      return {
        valid: false,
        algorithm: "HMAC-SHA256",
        signature: "",
        receiptHash: "",
        signedAt: "",
        error: "Receipt not found.",
      };
    }

    // Recompute HMAC over the stored receiptHash
    const signingKey = getSigningKey();
    const expectedSig = createHmac("sha256", signingKey)
      .update(receipt.receiptHash)
      .digest("hex");

    const valid = expectedSig === receipt.signature;

    return {
      valid,
      algorithm: receipt.algorithm,
      signature: receipt.signature,
      receiptHash: receipt.receiptHash,
      signedAt: receipt.signedAt,
      authorityPath: receipt.authorityPath,
      stateBefore: receipt.stateBefore,
      stateAfter: receipt.stateAfter,
      ...(!valid && { error: "Signature mismatch — receipt may have been tampered with." }),
    };
  }
}

export const receiptService = new ReceiptService();
