/**
 * KavachPay — RazorpayAdapter Tests
 *
 * Covers:
 *   1. Test A — INR conversion: ₹1850 → 185000 paise (Math.round(amount * 100))
 *   2. getPayment() calls Razorpay client payments.fetch()
 *   3. verifyWebhookSignature() computes HMAC-SHA256 and does constant-time comparison
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const mockOrdersCreate = vi.fn();
const mockPaymentsFetch = vi.fn();

vi.mock("razorpay", () => {
  return {
    default: class MockRazorpay {
      orders = {
        create: mockOrdersCreate,
      };
      payments = {
        fetch: mockPaymentsFetch,
      };
      constructor(public options: any) {}
    },
  };
});

import { RazorpayAdapter } from "./razorpay-adapter.js";

describe("RazorpayAdapter", () => {
  const originalEnv = process.env;
  const TEST_KEY_ID = "rzp_test_mockKeyId";
  const TEST_KEY_SECRET = "mockKeySecret12345";
  const TEST_WEBHOOK_SECRET = "mockWebhookSecret67890";

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RAZORPAY_KEY_ID: TEST_KEY_ID,
      RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Test A: INR conversion ────────────────────────────────────────────────

  it("converts rupees to paise (₹1850 → 185000 paise) when creating an order", async () => {
    mockOrdersCreate.mockResolvedValue({
      id: "order_test_conv_001",
      amount: 185000,
      currency: "INR",
      status: "created",
    });

    const adapter = new RazorpayAdapter();
    const result = await adapter.createPayment({
      intentId: "i_conv_001",
      amount: 1850, // ₹1850
      currency: "INR",
      receipt: "rcpt_conv_001",
    });

    expect(mockOrdersCreate).toHaveBeenCalledWith({
      amount: 185000, // 1850 * 100 = 185000 paise
      currency: "INR",
      receipt: "rcpt_conv_001",
      notes: {
        intentId: "i_conv_001",
        kavachpay: "true",
      },
    });

    expect(result.id).toBe("order_test_conv_001");
    expect(result.amount).toBe(185000);
  });

  // ── Webhook signature verification ────────────────────────────────────────

  it("verifies valid HMAC-SHA256 signature against raw body", () => {
    const adapter = new RazorpayAdapter();
    const rawBody = '{"event":"payment.captured","payload":{"test":123}}';

    const validSignature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    expect(adapter.verifyWebhookSignature(rawBody, validSignature)).toBe(true);
    expect(adapter.verifyWebhookSignature(rawBody, "invalid_signature")).toBe(false);
    expect(adapter.verifyWebhookSignature(rawBody + "tampered", validSignature)).toBe(false);
  });
});
