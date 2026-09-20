import type { Request, Response } from "express";
import { receiptService } from "../services/receipt-service.js";
import { decisionRepository } from "../store/decision-repository.js";
import { auditRepository } from "../store/audit-repository.js";
import { intentRepository } from "../store/intent-repository.js";

/**
 * GET /v0/decisions/:intentId/decisions
 * List all decisions for an intent.
 */
export async function getDecisionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const intentId = req.params.intentId as string;

    if (!intentId) {
      res.status(400).json({ error: "intentId is required" });
      return;
    }

    // Ownership check — only the intent owner may view its decisions.
    const userId = req.user!.sub;
    const intent = await intentRepository.getIntent(intentId);
    if (!intent || intent.userId !== userId) {
      res.status(404).json({ error: "Intent not found." });
      return;
    }

    const decisions = await decisionRepository.getDecisionsForIntent(intentId);
    res.status(200).json({ decisions });
  } catch (err: any) {
    console.error("[DecisionsHandler] getDecisions error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /v0/decisions/:intentId/verify/:decisionId
 *
 * Verifies the cryptographic authenticity of a stored decision receipt.
 * Recomputes the HMAC-SHA256 over the stored receiptHash and compares
 * it to the stored signature.
 *
 * Response:
 *  {
 *    valid: boolean,
 *    algorithm: "HMAC-SHA256",
 *    signature: "<hex>",
 *    receiptHash: "<hex>",
 *    signedAt: "<ISO>",
 *    authorityPath?: string[],
 *    stateBefore?: Record<string, number>,
 *    stateAfter?: Record<string, number>,
 *  }
 */
export async function verifyReceiptHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const intentId = req.params.intentId as string;
    const decisionId = req.params.decisionId as string;

    if (!intentId || !decisionId) {
      res.status(400).json({ error: "intentId and decisionId are required" });
      return;
    }

    // Ownership check — only the intent owner may verify its receipt.
    const userId = req.user!.sub;
    const intent = await intentRepository.getIntent(intentId);
    if (!intent || intent.userId !== userId) {
      res.status(404).json({ error: "Intent not found." });
      return;
    }

    const result = await receiptService.verifyReceipt(intentId, decisionId);

    res.status(result.valid ? 200 : 422).json(result);
  } catch (err: any) {
    console.error("[DecisionsHandler] verifyReceipt error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /v0/audit
 *
 * List recent audit events for a user.
 */
export async function listAuditHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const requestedLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 50;

    const events = await auditRepository.listEvents(userId, limit);
    res.status(200).json({ events });
  } catch (err: any) {
    console.error("[AuditHandler] listAudit error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
