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
 * {
 *   order_id: string,
 *   amount: number,
 *   currency: string,
 *   key_id: string
 * }
 */
export async function createOrderHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { amount, currency = "INR", receipt } = req.body || {};

    // Validate amount
    if (typeof amount !== "number" || isNaN(amount)) {
      res.status(400).json({
        success: false,
        error: "Invalid amount",
        message: "amount must be a valid number in paise",
      });
      return;
    }

    if (amount < 100) {
      res.status(400).json({
        success: false,
        error: "Amount too low",
        message: "Minimum amount is 100 paise (₹1.00)",
      });
      return;
    }

    let razorpay: Razorpay;
    try {
      razorpay = getRazorpayClient();
    } catch (err) {
      res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: err instanceof Error ? err.message : "Razorpay credentials missing",
      });
      return;
    }

    const orderReceipt = receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: orderReceipt,
      notes: {
        integration: "razorpay_standard_checkout",
      },
    });

    res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("[CheckoutHandler] Error creating Razorpay order:", error);

    // Auth failures from Razorpay API
    if (error?.statusCode === 401 || error?.status === 401) {
      res.status(401).json({
        success: false,
        error: "Razorpay authentication failed",
        message: error?.error?.description || error.message || "Unauthorized",
      });
      return;
    }

    // General Razorpay API / Server errors
    res.status(500).json({
      success: false,
      error: "Failed to create order",
      message: error?.error?.description || error?.message || "Razorpay API error",
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
