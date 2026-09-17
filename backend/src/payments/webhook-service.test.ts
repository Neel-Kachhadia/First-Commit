/**
 * KavachPay — WebhookService Tests
 *
 * Covers:
 *   1. Valid signature accepted
 *   2. Invalid/tampered signature rejected
 *   3. Empty signature rejected
 *   4. Duplicate webhook (same x-razorpay-event-id) is a no-op
 *   5. payment.captured → intent EXECUTED
 *   6. payment.failed   → intent FAILED
 *   7. order.paid       → intent EXECUTED
 *   8. Concurrent duplicate race (ConditionalCheckFailedException) → treated as duplicate
 *
 * All tests use mocked Razorpay adapter and DynamoDB — no live API calls.
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
  },
}));

vi.mock("./payment-service.js", () => ({
  paymentService: {
    updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
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
import type { RazorpayWebhookPayload } from "./types.js";

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
  orderId = "order_test001"
): RazorpayWebhookPayload {
  return {
    event: eventType,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: 185000,
          currency: "INR",
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
    },
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

    // Adapter that computes real HMAC so we can test valid + invalid sigs.
    mockAdapter = {
      verifyWebhookSignature: vi.fn((rawBody: string, sig: string) => {
        const expected = buildSignature(rawBody);
        return expected === sig;
      }),
    };

    vi.mocked(getRazorpayAdapter).mockReturnValue(mockAdapter as never);

    // Default DynamoDB: no existing webhook record, then successful writes.
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

  // ── 2. Invalid signature ──────────────────────────────────────────────────

  it("throws on an invalid (tampered) signature", async () => {
    const payload = buildPayload("payment.captured");
    const rawBody = JSON.stringify(payload);
    // Sign a different body — simulates tampering.
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

  // ── 4. Duplicate webhook (same eventId) ──────────────────────────────────

  it("returns duplicate:true and skips processing for a repeated eventId", async () => {
    const existingRecord = {
      eventId: "evt_004",
      eventType: "payment.captured",
      status: "PROCESSED",
      processedAt: new Date().toISOString(),
    };

    // GetCommand returns an existing record.
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

    // Neither intent nor payment status should be touched.
    expect(vi.mocked(intentRepository.updateStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(paymentService.updatePaymentStatus)).not.toHaveBeenCalled();
  });

  // ── 5. payment.captured → EXECUTED ───────────────────────────────────────

  it("transitions intent to EXECUTED on payment.captured", async () => {
    const intentId = "i_captured-001";
    const payload = buildPayload("payment.captured", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await webhookService.processWebhook(rawBody, signature, "evt_005", payload);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED"
    );
    expect(vi.mocked(paymentService.updatePaymentStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED",
      "pay_test001"
    );
  });

  // ── 6. payment.failed → FAILED ────────────────────────────────────────────

  it("transitions intent to FAILED on payment.failed", async () => {
    const intentId = "i_failed-001";
    const payload = buildPayload("payment.failed", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await webhookService.processWebhook(rawBody, signature, "evt_006", payload);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "FAILED"
    );
    expect(vi.mocked(paymentService.updatePaymentStatus)).toHaveBeenCalledWith(
      intentId,
      "FAILED",
      "pay_test001"
    );
  });

  // ── 7. order.paid → EXECUTED ─────────────────────────────────────────────

  it("transitions intent to EXECUTED on order.paid", async () => {
    const intentId = "i_orderpaid-001";
    const payload = buildPayload("order.paid", intentId);
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody);

    await webhookService.processWebhook(rawBody, signature, "evt_007", payload);

    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      intentId,
      "EXECUTED"
    );
  });

  // ── 8. Concurrent duplicate race ──────────────────────────────────────────

  it("treats ConditionalCheckFailedException on PutCommand as duplicate", async () => {
    const conditionalError = new Error("Condition failed");
    conditionalError.name = "ConditionalCheckFailedException";

    // GetCommand: no existing record. PutCommand: fails (concurrent write won).
    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: null });
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
});
