/**
 * KavachPay — Razorpay Standard Web Checkout Handlers
 *
 * Implements:
 * 1. POST /api/create-order  — Validates amount (>= 100 paise) and creates Razorpay order
 * 2. POST /api/verify-payment — Verifies HMAC-SHA256 signature (order_id + "|" + payment_id)
 * 3. GET /api/config         — Exposes public key_id safely to frontend
 */

import type { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { IntentService } from "../services/intent-service.js";
import { paymentService } from "../payments/payment-service.js";

const intentService = new IntentService();

function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Helper to compute expected signature:
 * HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
export function generatePaymentSignature(
  orderId: string,
  paymentId: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

/**
 * Constant-time signature verification.
 */
export function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = generatePaymentSignature(orderId, paymentId, secret);
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const receivedBuf = Buffer.from(signature, "utf8");

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * POST /api/create-order
 *
 * Request body:
 * {
 *   amount: number, // in paise
 *   currency?: string, // default 'INR'
 *   receipt?: string
 * }
 *
 * Minimum amount: 100 paise (₹1.00)
 *
 * Return:
/**
 * POST /api/create-order
 *
 * Creates a Razorpay order through the complete KavachPay flow:
 *
 *   Client
 *      ↓
 *   KavachPay Intent
 *      ↓
 *   Authority Engine
 *      ↓
 *   Atomic Reservation
 *      ↓
 *   PaymentService
 *      ↓
 *   Razorpay Order
 *
 * Request body:
 * {
 *   amount: number,              // paise
 *   currency?: string,            // default INR
 *   grantId: string,              // KavachPay grant governing payment
 *   userId?: string,              // default u_demo
 *   merchant?: {
 *     merchantId: string,
 *     name: string,
 *     category: string
 *   },
 *   description?: string,
 *   idempotencyKey?: string,
 *   intentId?: string,
 *   receipt?: string
 * }
 *
 * Example:
 * {
 *   "amount": 10000,
 *   "currency": "INR",
 *   "grantId": "g_123",
 *   "userId": "u_demo",
 *   "merchant": {
 *     "merchantId": "blinkit",
 *     "name": "Blinkit",
 *     "category": "GROCERY"
 *   },
 *   "description": "Grocery purchase",
 *   "idempotencyKey": "checkout_demo_001"
 * }
 */
export async function createOrderHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      amount,
      currency = "INR",
      grantId,
      merchant,
      description,
      idempotencyKey,
      intentId,
      receipt,
    } = req.body || {};

    // Derive userId from the verified Cognito JWT — never trust the body.
    const userId = req.user!.sub;

    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      console.log("[createOrderHandler] 400 Bad Request - Invalid amount. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "Invalid amount",
        message: "amount must be a valid number in paise",
      });
      return;
    }

    if (!Number.isInteger(amount)) {
      console.log("[createOrderHandler] 400 Bad Request - Non-integer amount. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "Invalid amount",
        message: "amount must be an integer number of paise",
      });
      return;
    }

    if (amount < 100) {
      console.log("[createOrderHandler] 400 Bad Request - Amount too low. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "Amount too low",
        message: "Minimum amount is 100 paise (₹1.00)",
      });
      return;
    }

    // ------------------------------------------------------------
    // 2. Validate grantId
    //
    // This is intentionally required.
    //
    // A checkout must be governed by an existing KavachPay grant.
    // We must NOT silently create an ungoverned payment.
    // ------------------------------------------------------------

    if (typeof grantId !== "string" || !grantId.trim()) {
      console.log("[createOrderHandler] 400 Bad Request - grantId required. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "grantId is required",
        message:
          "A KavachPay grant must be supplied to authorize this payment.",
      });
      return;
    }

    // ------------------------------------------------------------
    // 3. Validate merchant
    // ------------------------------------------------------------

    if (!merchant || typeof merchant !== "object") {
      console.log("[createOrderHandler] 400 Bad Request - Merchant required. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "Merchant information is required",
        message:
          "merchant must contain merchantId, name and category.",
      });
      return;
    }

    if (
      typeof merchant.merchantId !== "string" ||
      !merchant.merchantId.trim()
    ) {
      console.log("[createOrderHandler] 400 Bad Request - Invalid merchantId. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "Invalid merchant.merchantId",
      });
      return;
    }

    if (
      typeof merchant.name !== "string" ||
      !merchant.name.trim()
    ) {
      console.log("[createOrderHandler] 400 Bad Request - Invalid merchant.name. Body:", req.body);
      res.status(400).json({
        success: false,
        error: "Invalid merchant.name",
      });
      return;
    }

    if (
      typeof merchant.category !== "string" ||
      !merchant.category.trim()
    ) {
      res.status(400).json({
        success: false,
        error: "Invalid merchant.category",
      });
      return;
    }

    // ------------------------------------------------------------
    // 5. Idempotency key
    //
    // Prefer the client's key.
    //
    // For the demo checkout, generate one if omitted.
    // ------------------------------------------------------------

    const checkoutIdempotencyKey =
      typeof idempotencyKey === "string" &&
      idempotencyKey.trim()
        ? idempotencyKey.trim()
        : `checkout_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 10)}`;

    // ------------------------------------------------------------
    // 6. Convert paise → rupees
    // ------------------------------------------------------------

    const amountInRupees = amount / 100;

    // ------------------------------------------------------------
    // 7. Create KavachPay Intent
    // ------------------------------------------------------------

    const intentInput = {
      ...(intentId ? { intentId } : {}),
      userId,
      grantId,
      amount: amountInRupees,
      currency,
      merchant: {
        merchantId: merchant.merchantId.trim(),
        name: merchant.name.trim(),
        category: merchant.category.trim(),
      },
      ...(description ? { description } : {}),
      idempotencyKey: checkoutIdempotencyKey,
    };

    console.log(
      `[CheckoutHandler] Creating KavachPay intent ` +
        `for ₹${amountInRupees} ` +
        `(grant=${grantId}, merchant=${merchant.name})`
    );

    const intentResult = await intentService.createIntent(
      intentInput
    );

    const decision = intentResult.decision.decision;

    console.log(
      `[CheckoutHandler] Intent ${intentResult.intent.intentId} ` +
        `decision=${decision}`
    );

    // ------------------------------------------------------------
    // 8. DENY
    //
    // No Razorpay order should ever be created.
    // ------------------------------------------------------------

    if (decision === "DENY") {
      res.status(403).json({
        success: false,
        error: "Payment denied by KavachPay",
        intentId: intentResult.intent.intentId,
        intent: intentResult.intent,
        decision: intentResult.decision,
      });
      return;
    }

    // ------------------------------------------------------------
    // 9. STEP-UP
    //
    // Do NOT execute Razorpay yet.
    //
    // Frontend should call:
    //
    // POST /v0/intents/:id/approve
    //
    // after the human approves the transaction.
    // ------------------------------------------------------------

    if (decision === "STEP_UP") {
      res.status(202).json({
        success: true,
        requiresStepUp: true,
        intentId: intentResult.intent.intentId,
        intent: intentResult.intent,
        decision: intentResult.decision,
        message:
          "Additional approval is required before payment execution.",
      });
      return;
    }

    // ------------------------------------------------------------
    // 10. ALLOW must result in RESERVED
    //
    // IntentService is responsible for the atomic reservation.
    // PaymentService refuses anything that isn't RESERVED.
    // ------------------------------------------------------------

    if (intentResult.intent.status !== "RESERVED") {
      console.error(
        `[CheckoutHandler] Intent ${intentResult.intent.intentId} ` +
          `was allowed but is not RESERVED. ` +
          `status=${intentResult.intent.status}`
      );

      res.status(409).json({
        success: false,
        error: "Intent is not ready for payment execution",
        intentId: intentResult.intent.intentId,
        intent: intentResult.intent,
        decision: intentResult.decision,
      });
      return;
    }

    // ------------------------------------------------------------
    // 11. Execute through PaymentService
    //
    // PaymentService → RazorpayAdapter
    //
    // RazorpayAdapter creates:
    //
    // notes: {
    //   intentId,
    //   kavachpay: "true"
    // }
    //
    // This is the critical link that was missing before.
    // ------------------------------------------------------------

    console.log(
      `[CheckoutHandler] Executing KavachPay intent ` +
        `${intentResult.intent.intentId} through PaymentService`
    );

    const payment = await paymentService.execute(
      intentResult.intent.intentId
    );

    // ------------------------------------------------------------
    // 12. Return a FLAT response
    //
    // Keeps compatibility with the existing React Razorpay
    // Standard Checkout frontend.
    // ------------------------------------------------------------

    res.status(200).json({
      success: true,

      // Existing Razorpay frontend fields
      order_id: payment.razorpayOrderId,
      amount,
      currency,
      key_id: process.env.RAZORPAY_KEY_ID,

      // KavachPay information
      intentId: intentResult.intent.intentId,
      grantId,
      decision: intentResult.decision.decision,

      intent: intentResult.intent,
      decisionReceipt: intentResult.decision,

      payment: {
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
      },

      ...(receipt ? { receipt } : {}),
    });
  } catch (error) {
    console.error(
      "[CheckoutHandler] Error creating KavachPay-governed order:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create KavachPay payment";

    res.status(400).json({
      success: false,
      error: message,
    });
  }
}

/**
 * POST /api/verify-payment
 *
 * Request body:
 * {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string
 * }
 * (Also accepts order_id, payment_id, signature)
 *
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 * Return success only if signatures match
 */
export async function verifyPaymentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const orderId = req.body?.razorpay_order_id || req.body?.order_id;
    const paymentId = req.body?.razorpay_payment_id || req.body?.payment_id;
    const signature = req.body?.razorpay_signature || req.body?.signature;

    // Check for missing fields
    if (!orderId || !paymentId || !signature) {
      res.status(400).json({
        success: false,
        error: "Missing fields",
        message: "Missing required fields: order_id, payment_id, and razorpay_signature are required",
      });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      res.status(500).json({
        success: false,
        error: "Configuration error",
        message: "RAZORPAY_KEY_SECRET is not configured on the server",
      });
      return;
    }

    const isValid = verifySignature(orderId, paymentId, signature, secret);

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: "Signature mismatch",
        message: "Payment verification failed: signature does not match",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order_id: orderId,
      payment_id: paymentId,
    });
  } catch (error: any) {
    console.error("[CheckoutHandler] Error verifying payment signature:", error);
    res.status(500).json({
      success: false,
      error: "Verification error",
      message: error?.message || "Unexpected error verifying payment",
    });
  }
}

/**
 * GET /api/config
 * Returns public configuration (KEY_ID only, never KEY_SECRET).
 */
export function getCheckoutConfigHandler(
  _req: Request,
  res: Response
): void {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  res.json({
    key_id: keyId,
  });
}

  export async function executeOrderHandler(req: Request, res: Response): Promise<void> {
    try {
      const { intentId } = req.body;
      // Derive userId from the verified Cognito JWT — never trust the body.
      const userId = req.user!.sub;

      if (!intentId) { res.status(400).json({ success: false, error: 'intentId required' }); return; }
      
      const { intentRepository } = await import("../store/intent-repository.js");
      const intent = await intentRepository.getIntent(intentId);
      if (!intent) {
        res.status(404).json({ success: false, error: "Intent not found" });
        return;
      }
      if (intent.userId !== userId) {
        res.status(403).json({ success: false, error: "Not authorized to execute this intent" });
        return;
      }
    
    const payment = await paymentService.execute(intentId);
    res.status(200).json({ success: true, order_id: payment.razorpayOrderId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}


