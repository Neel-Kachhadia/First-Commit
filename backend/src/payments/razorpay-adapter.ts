/**
 * KavachPay — Razorpay Adapter
 *
 * Thin wrapper over the Razorpay SDK.
 *
 * Responsibilities:
 *   - createPayment()             → create a Razorpay order
 *   - getPayment()                → fetch a payment by ID
 *   - getOrder()                  → fetch a Razorpay order
 *   - getOrderPayments()          → fetch all payments for an order
 *   - verifyWebhookSignature()    → HMAC-SHA256 against raw body bytes
 *
 * No business logic lives here. All KavachPay orchestration
 * happens in payment-service.ts and webhook-service.ts.
 *
 * Currency boundary:
 *   Internal amounts are in rupees (INR).
 *   Razorpay requires amounts in paise.
 *   Conversion: Math.round(amount * 100) — adapter's responsibility.
 */

import Razorpay from "razorpay";
import crypto from "crypto";

export interface CreatePaymentParams {
  /** Intent ID — stored in the Razorpay order notes for traceability. */
  intentId: string;

  /** Amount in rupees (INR). Adapter converts to paise internally. */
  amount: number;

  currency: string;

  /** Short description surfaced in Razorpay dashboard. */
  receipt: string;
}

export interface RazorpayOrder {
  id: string;           // Razorpay order ID
  entity: string;
  amount: number;       // paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;           // Razorpay payment ID
  entity: string;
  amount: number;       // paise
  currency: string;
  status: string;
  order_id: string;
  notes: Record<string, string>;
  created_at: number;
  error_code?: string;
  error_description?: string;
}

export class RazorpayAdapter {
  private readonly client: Razorpay;
  private readonly webhookSecret: string;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

    if (!keyId || !keySecret || !webhookSecret) {
      throw new Error(
        "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET " +
          "must all be set as environment variables."
      );
    }

    this.client = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    this.webhookSecret = webhookSecret;
  }

  /**
   * Create a Razorpay order for a given payment intent.
   *
   * Converts rupees → paise at the PSP boundary.
   * Razorpay uses the smallest currency unit (paise for INR).
   */
  async createPayment(params: CreatePaymentParams): Promise<RazorpayOrder> {
    // Convert rupees to paise — Razorpay's required unit.
    // Math.round guards against floating-point imprecision.
    const amountInPaise = Math.round(params.amount * 100);

    const order = await this.client.orders.create({
      amount: amountInPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: {
        intentId: params.intentId,
        kavachpay: "true",
      },
    });

    return order as unknown as RazorpayOrder;
  }

  /**
   * Fetch a Razorpay order by its order ID.
   */
  async getOrder(razorpayOrderId: string): Promise<RazorpayOrder> {
    const order = await this.client.orders.fetch(razorpayOrderId);
    return order as unknown as RazorpayOrder;
  }

  /**
   * Fetch a Razorpay payment by its payment ID.
   */
  async getPayment(razorpayPaymentId: string): Promise<RazorpayPayment> {
    const payment = await this.client.payments.fetch(razorpayPaymentId);
    return payment as unknown as RazorpayPayment;
  }

  /**
   * Fetch all payments for a given Razorpay order.
   */
  async getOrderPayments(razorpayOrderId: string): Promise<RazorpayPayment[]> {
    const payments = await this.client.orders.fetchPayments(razorpayOrderId);
    return (payments as any).items as RazorpayPayment[];
  }

  /**
   * Verify a Razorpay webhook signature.
   *
   * Razorpay signs the raw request body with HMAC-SHA256 using the
   * webhook secret. The signature is sent in the X-Razorpay-Signature
   * header.
   *
   * IMPORTANT: rawBody must be the original bytes before any JSON
   * parsing. Pass Buffer.toString('utf8') or the raw string directly.
   *
   * @see https://razorpay.com/docs/webhooks/validate-test/
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    /*
     * Constant-time comparison prevents timing attacks.
     * crypto.timingSafeEqual requires equal-length buffers.
     */
    try {
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      const receivedBuffer = Buffer.from(signature, "hex");

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }
}

// Lazily initialized singleton — only constructed when first used,
// so missing env vars don't crash the process at import time.
let _adapter: RazorpayAdapter | null = null;

export function getRazorpayAdapter(): RazorpayAdapter {
  if (!_adapter) {
    _adapter = new RazorpayAdapter();
  }
  return _adapter;
}

// Exported for tests that need to inject a mock.
export { RazorpayAdapter as RazorpayAdapterClass };
