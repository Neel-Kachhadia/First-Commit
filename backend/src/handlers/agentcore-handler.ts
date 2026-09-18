import type { Request, Response } from "express";
import { IntentService } from "../services/intent-service.js";
import { paymentService } from "../payments/payment-service.js";

const intentService = new IntentService();

/**
 * POST /v0/agent-tools/create-payment
 * 
 * Dedicated API Gateway target for Amazon Bedrock AgentCore.
 * AgentCore evaluates the Cedar policy, and if permitted, invokes this endpoint.
 * 
 * Request body (derived from payment-tool.json schema):
 * {
 *   "intentId": string,
 *   "grantId": string,
 *   "amount": number, // in INR rupees
 *   "merchant": string,
 *   "category": string
 * }
 */
export async function agentcoreCreatePaymentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { intentId, grantId, amount, merchant, category } = req.body;

    if (!intentId || !grantId || !amount || !merchant || !category) {
      res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
      return;
    }

    console.log(`[AgentCoreHandler] Creating KavachPay intent for ₹${amount} (grant=${grantId}, merchant=${merchant})`);

    // 1. Create KavachPay Intent
    // amount is in rupees in the tool schema
    const intentResult = await intentService.createIntent({
      intentId,
      amount,
      currency: "INR",
      grantId,
      userId: "u_demo", // Assuming a demo user for the hackathon
      merchant: {
        merchantId: merchant.toLowerCase().replace(/\s+/g, "_"),
        name: merchant,
        category: category,
      },
      description: "Agent-initiated payment",
      idempotencyKey: `agentcore_${intentId}`,
    });

    console.log(`[AgentCoreHandler] Intent ${intentId} decision=${intentResult.decision.decision}`);

    // 2. Handle Decision
    if (intentResult.decision.decision === "DENY") {
      res.status(403).json({
        success: false,
        error: "AUTHORITY_DENIED",
        reasonCode: intentResult.decision.reasonCode,
      });
      return;
    }

    if (intentResult.decision.decision === "STEP_UP") {
      res.status(202).json({
        success: true,
        status: "STEP_UP_REQUIRED",
        intentId: intentResult.intent.intentId,
        message: "Human approval required",
      });
      return;
    }

    // 3. Execute Payment via PaymentService
    console.log(`[AgentCoreHandler] Executing KavachPay intent ${intentResult.intent.intentId} through PaymentService`);
    
    // paymentService handles atomic reservation and Razorpay execution
    const paymentResult = await paymentService.execute(intentResult.intent.intentId);

    if (paymentResult.success) {
      res.status(200).json({
        success: true,
        intentId: intentResult.intent.intentId,
        razorpayOrderId: paymentResult.razorpayOrderId,
      });
    } else {
      // Typically execution fails if Razorpay rejects it, but KavachPay authorized it
      res.status(502).json({
        success: false,
        error: "EXECUTION_FAILED",
      });
    }
  } catch (error: any) {
    console.error("[AgentCoreHandler] Error creating payment:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
}
