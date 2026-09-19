/**
 * KavachPay — WebhookService Tests
 *
 * Covers:
 *   1. Test B — Valid signature accepted vs Invalid/tampered signature rejected (400)
 *   2. Empty signature rejected
 *   3. Test C — Duplicate webhook (same x-razorpay-event-id) is a no-op (processed=false, duplicate=true)
 *   4. Test D — Failed webhook retry (previously FAILED record is retried, not skipped)
 *   5. State transitions:
 *        - payment.captured → intent EXECUTED + payment EXECUTED
 *        - payment.failed   → intent FAILED   + payment FAILED
 *        - order.paid       → intent EXECUTED + payment EXECUTED
 *   6. Concurrent duplicate race (ConditionalCheckFailedException) → treated as duplicate
 *   7. Test E — Amount mismatch: stored ₹1850 vs webhook 180000 paise → REJECT, intent != EXECUTED
 *   8. Test F — Order mismatch: stored order_test001 vs webhook order_mismatch → REJECT, intent != EXECUTED
 *   9. Currency mismatch: stored INR vs webhook USD → REJECT, intent != EXECUTED
 *  10. Missing payment record: PAYMENT#<intentId> not found → REJECT, intent != EXECUTED
 *  11. Non-RESERVED intent state: DENIED/FAILED/STEP_UP → REJECT, intent != EXECUTED
 *
 * All tests use mocked Razorpay adapter, PaymentService, IntentRepository, and DynamoDB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Module mocks — hoisted by vitest before imports
// ---------------------------------------------------------------------------

vi.mock("../store/dynamodb.js", () => ({
  dynamo: {
    send: vi.fn(),
  },
}));

vi.mock("../store/intent-repository.js", () => ({
  intentRepository: {
    updateStatus: vi.fn().mockResolvedValue(undefined),
    getIntent: vi.fn(),
  },
}));

vi.mock("./payment-service.js", () => ({
  paymentService: {
    updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
    getPaymentRecord: vi.fn(),
  },
}));

vi.mock("./razorpay-adapter.js", () => ({
  getRazorpayAdapter: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { dynamo } from "../store/dynamodb.js";
import { intentRepository } from "../store/intent-repository.js";
import { paymentService } from "./payment-service.js";
import { getRazorpayAdapter } from "./razorpay-adapter.js";
import { WebhookService } from "./webhook-service.js";
import type { RazorpayWebhookPayload, PaymentRecord } from "./types.js";
import type { Intent } from "../models/intent.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_WEBHOOK_SECRET = "test_webhook_secret_kavachpay";

function buildSignature(rawBody: string): string {
  return crypto
    .createHmac("sha256", TEST_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
}

function buildPayload(
  eventType: "payment.captured" | "payment.failed" | "order.paid",
  intentId = "i_test-intent-001",
  paymentId = "pay_test001",
  orderId = "order_test001",
  amountPaise = 185000,
  currency = "INR"
): RazorpayWebhookPayload {
  const isOrderPaid = eventType === "order.paid";
  return {
    event: eventType,
    payload: {
      ...(isOrderPaid ? {
        order: {
          entity: {
            id: orderId,
            amount: amountPaise,
            currency,
            notes: { intentId, kavachpay: "true" }
          }
        }
      } : {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: amountPaise,
            currency,
            status: eventType === "payment.failed" ? "failed" : "captured",
            notes: {
              intentId,
              kavachpay: "true",
            },
            ...(eventType === "payment.failed"
              ? {
                  error_code: "BAD_REQUEST_ERROR",
                  error_description: "Payment failed",
                }
              : {}),
          },
        },
      })
    },
  };
}

function buildPaymentRecord(
  intentId = "i_test-intent-001",
  amount = 1850,
  currency = "INR",
  razorpayOrderId = "order_test001"
): PaymentRecord {
  return {
    intentId,
    userId: "user_001",
    amount,
    currency,
    razorpayOrderId,
    status: "PAYMENT_CREATED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildIntent(
  intentId = "i_test-intent-001",
  status: Intent["status"] = "RESERVED",
  amount = 1850
): Intent {
  return {
    intentId,
    userId: "user_001",
    grantId: "grant_001",
    amount,
    currency: "INR",
    merchant: {
      merchantId: "merch_001",
      name: "Test Merchant",
      category: "grocery",
    },
    idempotencyKey: "idem_001",
    status,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WebhookService", () => {
  let webhookService: WebhookService;
  let mockAdapter: { verifyWebhookSignature: ReturnType<typeof vi.fn> };
  let mockDynamoSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Adapter computes real HMAC so we can test valid + invalid sigs
    mockAdapter = {
      verifyWebhookSignature: vi.fn((rawBody: string, sig: string) => {
        const expected = buildSignature(rawBody);
        return expected === sig;
      }),
    };

    vi.mocked(getRazorpayAdapter).mockReturnValue(mockAdapter as never);

    // Default: Payment record and intent exist and are valid
    vi.mocked(paymentService.getPaymentRecord).mockImplementation(async (id: string) => {
      return buildPaymentRecord(id, 1850, "INR", "order_test001");
    });

    vi.mocked(intentRepository.getIntent).mockImplementation(async (id: string) => {
      return buildIntent(id, "RESERVED", 1850);
    });

    // Default DynamoDB: no existing webhook record, successful puts/updates
    mockDynamoSend = vi.mocked(dynamo.send);
    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: null });
      }
      return Promise.resolve({});
    });

    webhookService = new WebhookService();
  });

  // ── 1. Valid signature ────────────────────────────────────────────────────

  it("accepts a valid webhook signature", async () => {
    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_001",
      payload
    );

    expect(result.processed).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  // ── 2. Test B: Invalid signature ──────────────────────────────────────────

  it("throws on an invalid (tampered) signature", async () => {
    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);
    const badSignature = buildSignature(rawBody + "_tampered");

    await expect(
      webhookService.processWebhook(rawBody, badSignature, "evt_002", payload)
    ).rejects.toThrow("Invalid Razorpay webhook signature.");
  });

  // ── 3. Empty signature ────────────────────────────────────────────────────

  it("throws when signature is empty", async () => {
    mockAdapter.verifyWebhookSignature.mockReturnValue(false);

    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);

    await expect(
      webhookService.processWebhook(rawBody, "", "evt_003", payload)
    ).rejects.toThrow("Invalid Razorpay webhook signature.");
  });

  // ── 4. Test C: Duplicate webhook (same eventId) ──────────────────────────

  it("returns duplicate:true and skips processing for a repeated eventId with PROCESSED status", async () => {
    const existingRecord = {
      eventId: "evt_004",
      eventType: "payment.captured",
      status: "PROCESSED",
      processedAt: new Date().toISOString(),
    };

    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: existingRecord });
      }
      return Promise.resolve({});
    });

    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_004",
      payload
    );

    expect(result.duplicate).toBe(true);
    expect(result.processed).toBe(false);

    // Neither intent nor payment status should be touched
    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(paymentService.updatePaymentStatus)).not.toHaveBeenCalled();
  });

  it("returns duplicate:true and skips processing for a concurrent eventId with PROCESSING status", async () => {
    const existingRecord = {
      eventId: "evt_concurrent",
      eventType: "payment.captured",
      status: "PROCESSING",
      processedAt: new Date().toISOString(),
    };

    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: existingRecord });
      }
      return Promise.resolve({});
    });

    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_concurrent",
      payload
    );

    expect(result.duplicate).toBe(true);
    expect(result.processed).toBe(false);
    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
  });

  // ── 5. Test D: Failed webhook retry ───────────────────────────────────────

  it("allows retry when previous webhook delivery was FAILED", async () => {
    const failedRecord = {
      eventId: "evt_retry_001",
      eventType: "payment.captured",
      status: "FAILED",
      processedAt: new Date().toISOString(),
    };

    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: failedRecord });
      }
      return Promise.resolve({});
    });

    const intentId = "i_test-retry-001";
    const payload = buildPayload("payment.captured", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_retry_001",
      payload
    );

    // Retry should succeed and NOT be skipped as duplicate
    expect(result.processed).toBe(true);
    expect(result.duplicate).toBe(false);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED",
      "RESERVED"
    );
  });

  // ── 6. State transitions ──────────────────────────────────────────────────

  it("transitions intent to EXECUTED on payment.captured", async () => {
    const intentId = "i_captured-001";
    const payload = buildPayload("payment.captured", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await webhookService.processWebhook(rawBody, signature, "evt_005", payload);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED",
      "RESERVED"
    );
    expect(vi.mocked(paymentService.updatePaymentStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED",
      "pay_test001",
      "PAYMENT_CREATED",
      "evt_005"
    );
  });

  it("transitions intent to FAILED on payment.failed", async () => {
    const intentId = "i_failed-001";
    const payload = buildPayload("payment.failed", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await webhookService.processWebhook(rawBody, signature, "evt_006", payload);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "FAILED",
      "RESERVED"
    );
    expect(vi.mocked(paymentService.updatePaymentStatus)).toHaveBeenCalledWith(
      intentId,
      "FAILED",
      "pay_test001",
      "PAYMENT_CREATED",
      "evt_006"
    );
  });

  it("transitions intent to EXECUTED on order.paid", async () => {
    const intentId = "i_orderpaid-001";
    const payload = buildPayload("order.paid", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await webhookService.processWebhook(rawBody, signature, "evt_007", payload);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED",
      "RESERVED"
    );
  });

  // ── 7. Concurrent race condition ──────────────────────────────────────────

  it("treats ConditionalCheckFailedException on PutCommand as duplicate when existing is PROCESSED", async () => {
    const conditionalError = new Error("Condition failed");
    conditionalError.name = "ConditionalCheckFailedException";

    let getCount = 0;
    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        getCount++;
        if (getCount === 1) {
          return Promise.resolve({ Item: null }); // initial check
        }
        return Promise.resolve({
          Item: { eventId: "evt_008", status: "PROCESSED" },
        }); // raced check
      }
      if (command.constructor.name === "PutCommand") {
        return Promise.reject(conditionalError);
      }
      return Promise.resolve({});
    });

    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_008",
      payload
    );

    expect(result.duplicate).toBe(true);
    expect(result.processed).toBe(false);
    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
  });

  // ── 7a. Concurrent different webhooks (order.paid vs payment.captured) ────

  it("handles concurrent order.paid and payment.captured gracefully without erroring", async () => {
    // Setup intent as EXECUTED (simulating that the first webhook, order.paid, already processed it)
    const intentId = "i_concurrent-diff";
    vi.mocked(intentRepository.getIntent).mockResolvedValue(
      buildIntent(intentId, "EXECUTED")
    );
    // Setup payment record to be EXECUTED, but without razorpayPaymentId (since order.paid doesn't provide it)
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      ...buildPaymentRecord(intentId),
      status: "EXECUTED",
      razorpayPaymentId: undefined,
    });

    const payload = buildPayload("payment.captured", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    // This webhook is payment.captured, different from the order.paid that theoretically just finished
    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_concurrent_payment",
      payload
    );

    // Should process successfully (idempotent path)
    expect(result.processed).toBe(true);
    expect(result.duplicate).toBe(false);

    // intent update should NOT be called because intent is already EXECUTED
    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();

    // payment status SHOULD be called to backfill razorpayPaymentId, since it was missing
    expect(vi.mocked(paymentService.updatePaymentStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED",
      "pay_test001",
      "EXECUTED",
      "evt_concurrent_payment"
    );
  });

  // ── 8. Test E: Amount mismatch ────────────────────────────────────────────

  it("rejects webhook and does NOT mark intent EXECUTED when amount does not match payment record", async () => {
    const intentId = "i_mismatch-amt-001";
    // Stored payment is ₹1850 (expected 185000 paise), but webhook has 180000 paise
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue(
      buildPaymentRecord(intentId, 1850, "INR", "order_test001")
    );

    const payload = buildPayload(
      "payment.captured",
      intentId,
      "pay_test001",
      "order_test001",
      180000 // 180000 paise != 185000 paise
    );
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await expect(
      webhookService.processWebhook(rawBody, signature, "evt_amt_err", payload)
    ).rejects.toThrow(/Payment amount mismatch/);

    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(paymentService.updatePaymentStatus)).not.toHaveBeenCalled();
  });

  // ── 9. Test F: Order mismatch ────────────────────────────────────────────

  it("rejects webhook and does NOT mark intent EXECUTED when razorpay order ID does not match", async () => {
    const intentId = "i_mismatch-order-001";
    // Stored order is order_123, webhook has order_456
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue(
      buildPaymentRecord(intentId, 1850, "INR", "order_123")
    );

    const payload = buildPayload(
      "payment.captured",
      intentId,
      "pay_test001",
      "order_456", // mismatch
      185000
    );
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await expect(
      webhookService.processWebhook(rawBody, signature, "evt_ord_err", payload)
    ).rejects.toThrow(/Razorpay order ID mismatch/);

    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
  });

  // ── 10. Currency mismatch ─────────────────────────────────────────────────

  it("rejects webhook when currency does not match payment record", async () => {
    const intentId = "i_mismatch-curr-001";
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue(
      buildPaymentRecord(intentId, 1850, "INR", "order_test001")
    );

    const payload = buildPayload(
      "payment.captured",
      intentId,
      "pay_test001",
      "order_test001",
      185000,
      "USD" // mismatch: USD vs INR
    );
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await expect(
      webhookService.processWebhook(rawBody, signature, "evt_curr_err", payload)
    ).rejects.toThrow(/Payment currency mismatch/);

    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
  });

  // ── 11. Payment record missing ────────────────────────────────────────────

  it("rejects webhook when payment record does not exist", async () => {
    const intentId = "i_nonexistent-pay-001";
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue(null);

    const payload = buildPayload("payment.captured", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await expect(
      webhookService.processWebhook(rawBody, signature, "evt_missing_pay", payload)
    ).rejects.toThrow(/Payment record PAYMENT#.* not found/);

    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
  });

  // ── 12. Non-RESERVED intent state ─────────────────────────────────────────

  it.each([
    "PENDING",
    "DENIED",
    "FAILED",
    "STEP_UP_REQUIRED",
  ] as Intent["status"][])(
    "rejects webhook when intent status is %s (not RESERVED)",
    async (nonReservedStatus) => {
      const intentId = "i_invalid-intent-status";
      vi.mocked(intentRepository.getIntent).mockResolvedValue(
        buildIntent(intentId, nonReservedStatus)
      );

      const payload = buildPayload("payment.captured", intentId);
      const rawBody = JSON.stringify(payload);
      const signature = buildSignature(rawBody);

      await expect(
        webhookService.processWebhook(rawBody, signature, "evt_status_err", payload)
      ).rejects.toThrow(/Invalid intent status transition/);

      expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
    }
  );

  it("treats webhook as idempotent success when intent is already EXECUTED", async () => {
    const intentId = "i_already-exec";
    vi.mocked(intentRepository.getIntent).mockResolvedValue(
      buildIntent(intentId, "EXECUTED")
    );
    // Setup payment record to be EXECUTED as well
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      ...buildPaymentRecord(intentId),
      status: "EXECUTED",
      razorpayPaymentId: "pay_test001",
    });

    const payload = buildPayload("payment.captured", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      "evt_idempotent",
      payload
    );

    expect(result.processed).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(paymentService.updatePaymentStatus)).not.toHaveBeenCalled();
  });
});
