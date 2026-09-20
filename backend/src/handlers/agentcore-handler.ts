import type { Request, Response } from "express";
import { IntentService } from "../services/intent-service.js";
import { paymentService } from "../payments/payment-service.js";

const intentService = new IntentService();

/**
 * AgentCore payload allowlist.
 *
 * These are the ONLY fields accepted from the agent's economic intent payload.
 * Provenance fields (agentId, origin, taskId, commandId, paymentProfileId, etc.)
 * are explicitly forbidden and rejected with a 400 error if present.
 *
 * This makes the trust boundary easy to audit:
 *   - Economic intent fields → accepted from agent
 *   - Identity / provenance fields → derived server-side only
 */
const ALLOWED_BODY_FIELDS = new Set([
  "intentId",
  "grantId",
  "amount",
  "currency",
  "merchant",
  "items",
  "description",
  "idempotencyKey",
]);

const FORBIDDEN_BODY_FIELDS = [
  "agentId",
  "origin",
  "taskId",
  "commandId",
  "paymentProfileId",
  "providerTokenRef",
  "providerCustomerId",
];

/**
 * POST /v0/agent-tools/create-payment
 *
 * Dedicated API Gateway target for AgentCore.
 * Reached only after requireIamAuthorization validates SigV4.
 *
 * Provenance is derived server-side from the authenticated route context.
 * The agent cannot self-declare its identity.
 */
export async function agentcoreCreatePaymentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // ── 1. Reject forbidden provenance/identity fields ─────────────────────
    const forbidden = FORBIDDEN_BODY_FIELDS.filter((f) => f in req.body);
    if (forbidden.length > 0) {
      res.status(400).json({
        success: false,
        error: "FORBIDDEN_FIELDS",
        message: `The following fields are not accepted from agent payloads: ${forbidden.join(", ")}. Agent identity and provenance are derived server-side.`,
      });
      return;
    }

    // ── 2. Extract only economic intent fields ─────────────────────────────
    const {
      intentId,
      grantId,
      amount,
      currency = "INR",
      merchant,
      items,
      description,
      idempotencyKey,
    } = req.body;

    if (!grantId || !amount || !merchant) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: grantId, amount, and merchant are required.",
      });
      return;
    }

    // ── 3. Server-side provenance — route-bound, not caller-controlled ─────
    //
    // Any caller reaching this route has passed requireIamAuthorization,
    // which validates the SigV4 format. In a production deployment,
    // API Gateway would verify the cryptographic signature against the
    // AgentCore service role ARN, establishing a single known identity.
    //
    // We do NOT use x-agent-id or req.body.agentId because both are
    // caller-controlled and cannot be distinguished from spoofing.
    const origin = {
      type: "AGENT_RUNTIME" as const,
      agentId: "KAVACHPAY_AGENTCORE",
    };

    console.log(
      `[AgentCoreHandler] Creating intent: grantId=${grantId}, amount=${amount}, ` +
        `merchant=${typeof merchant === "object" ? merchant.name : merchant}, ` +
        `origin.agentId=${origin.agentId}`
    );

    // ── 4. Create KavachPay Intent with server-derived provenance ──────────
    const userId = (req as any).user?.sub ?? "u_frontend_demo";

    const intentResult = await intentService.createIntent({
      intentId,
      amount,
      currency,
      grantId,
      userId,
      merchant: {
        merchantId: (merchant.name ?? merchant).toLowerCase().replace(/\s+/g, "_"),
        name: merchant.name ?? merchant,
        category: merchant.category ?? "GENERAL",
      },
      items,
      description: description ?? "Agent-initiated payment",
      idempotencyKey: idempotencyKey ?? `agentcore_${intentId ?? Date.now()}`,
      origin,
    });

    console.log(
      `[AgentCoreHandler] Intent ${intentResult.intent.intentId} decision=${intentResult.decision.decision}`
    );

    // ── 5. Handle Decision ──────────────────────────────────────────────────
    if (intentResult.decision.decision === "DENY") {
      res.status(403).json({
        success: false,
        error: "AUTHORITY_DENIED",
        reasonCode: intentResult.decision.reasonCode,
        intentId: intentResult.intent.intentId,
      });
      return;
    }

    if (intentResult.decision.decision === "STEP_UP") {
      res.status(202).json({
        success: true,
        status: "STEP_UP_REQUIRED",
        intentId: intentResult.intent.intentId,
        message: "Human approval required before execution.",
      });
      return;
    }

    // ── 6. Execute through PaymentService (which resolves the Payment Profile) ─
    console.log(
      `[AgentCoreHandler] Executing intent ${intentResult.intent.intentId} through PaymentService`
    );

    const paymentResult = await paymentService.execute(intentResult.intent.intentId);

    if (paymentResult.success) {
      res.status(200).json({
        success: true,
        intentId: intentResult.intent.intentId,
        razorpayOrderId: paymentResult.razorpayOrderId,
      });
    } else {
      const isBusinessError =
        paymentResult.error?.includes("Payment profile") ||
        paymentResult.error?.includes("disabled") ||
        paymentResult.error?.includes("not configured");

      res.status(isBusinessError ? 400 : 502).json({
        success: false,
        error: isBusinessError ? "EXECUTION_BUSINESS_ERROR" : "EXECUTION_FAILED",
        message: paymentResult.error,
      });
    }
  } catch (error: any) {
    console.error("[AgentCoreHandler] Error:", error);

    if (error.code === "AGENT_IDENTITY_UNVERIFIED") {
      res.status(403).json({
        success: false,
        error: "AGENT_IDENTITY_UNVERIFIED",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
}
