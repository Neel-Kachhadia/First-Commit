/**
 * KavachPay — PaymentService Tests
 *
 * Covers:
 *   1. execute() on a RESERVED intent creates a Razorpay order and returns success
 *   2. execute() on non-RESERVED statuses throws
 *   3. execute() on missing intent throws
 *   4. Payment record stored with correct DynamoDB key pattern (PK: PAYMENT#<intentId>)
 *   5. Razorpay failure → intent FAILED, success:false returned
 *   6. Paise conversion — adapter receives rupee amount (adapter does the ×100)
 *   7. updatePaymentStatus() sends an UpdateCommand to DynamoDB
 *
 * All tests use mocked Razorpay adapter and DynamoDB — no live API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
    getIntent: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
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
import { getRazorpayAdapter } from "./razorpay-adapter.js";
import { PaymentService } from "./payment-service.js";
import type { Intent } from "../models/intent.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIntent(
  status: Intent["status"] = "RESERVED",
  amount = 1850
): Intent {
  return {
    intentId: "i_test-pay-001",
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

describe("PaymentService", () => {
  let paymentService: PaymentService;
  let mockAdapter: {
    createPayment: ReturnType<typeof vi.fn>;
    getPayment: ReturnType<typeof vi.fn>;
  };
  let mockDynamoSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdapter = {
      createPayment: vi.fn().mockResolvedValue({
        id: "order_test001",
        entity: "order",
        amount: 185000,
        amount_paid: 0,
        amount_due: 185000,
        currency: "INR",
        receipt: "kpay_i_test-pay-001",
        status: "created",
        notes: { intentId: "i_test-pay-001", kavachpay: "true" },
        created_at: Date.now(),
      }),
      getPayment: vi.fn(),
    };

    vi.mocked(getRazorpayAdapter).mockReturnValue(mockAdapter as never);

    mockDynamoSend = vi.mocked(dynamo.send);
    mockDynamoSend.mockResolvedValue({});

    paymentService = new PaymentService();
  });

  // ── 1. Successful execute() on RESERVED intent ────────────────────────────

  it("creates a Razorpay order and returns success for a RESERVED intent", async () => {
    vi.mocked(intentRepository.getIntent).mockResolvedValue(buildIntent("RESERVED"));

    const result = await paymentService.execute("i_test-pay-001");

    expect(result.success).toBe(true);
    expect(result.razorpayOrderId).toBe("order_test001");
    expect(result.error).toBeUndefined();
  });

  // ── 2. execute() on non-RESERVED statuses throws ──────────────────────────

  it.each([
    "PENDING",
    "EXECUTED",
    "DENIED",
    "FAILED",
    "STEP_UP_REQUIRED",
  ] as Intent["status"][])(
    "throws when intent status is %s (not RESERVED)",
    async (status) => {
      vi.mocked(intentRepository.getIntent).mockResolvedValue(
        buildIntent(status)
      );

      await expect(
        paymentService.execute("i_test-pay-001")
      ).rejects.toThrow(/cannot be executed because its current status/);
    }
  );

  // ── 3. execute() when intent is not found ─────────────────────────────────

  it("throws when the intent does not exist", async () => {
    vi.mocked(intentRepository.getIntent).mockResolvedValue(null);

    await expect(paymentService.execute("i_nonexistent")).rejects.toThrow(
      /not found/
    );
  });

  // ── 4. DynamoDB key pattern for payment record ────────────────────────────

  it("stores payment record with PK: PAYMENT#<intentId> and SK: META", async () => {
    vi.mocked(intentRepository.getIntent).mockResolvedValue(buildIntent("RESERVED"));

    await paymentService.execute("i_test-pay-001");

    // Find the PutCommand call with our expected key.
    const putCall = mockDynamoSend.mock.calls.find((args) => {
      const cmd = args[0] as { input?: { Item?: { PK?: string } } };
      return cmd.input?.Item?.PK === "PAYMENT#i_test-pay-001";
    });

    expect(putCall).toBeDefined();

    const item = (putCall![0] as { input: { Item: Record<string, unknown> } })
      .input.Item;

    expect(item.SK).toBe("META");
    expect(item.entityType).toBe("PAYMENT");
    expect(item.intentId).toBe("i_test-pay-001");
  });

  // ── 5. Razorpay failure → intent FAILED, success:false ───────────────────

  it("marks intent FAILED and returns success:false when Razorpay order creation fails", async () => {
    vi.mocked(intentRepository.getIntent).mockResolvedValue(buildIntent("RESERVED"));
    mockAdapter.createPayment.mockRejectedValue(
      new Error("Razorpay API error: Bad Request")
    );

    const result = await paymentService.execute("i_test-pay-001");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Razorpay API error/);
    expect(vi.mocked(intentRepository.updateStatus)).toHaveBeenCalledWith(
      "i_test-pay-001",
      "FAILED"
    );
  });

  // ── 6. Adapter receives rupee amount (adapter does the ×100 conversion) ───

  it("passes rupee amount to the adapter (not paise)", async () => {
    const intent = buildIntent("RESERVED", 1850);
    vi.mocked(intentRepository.getIntent).mockResolvedValue(intent);

    await paymentService.execute("i_test-pay-001");

    expect(mockAdapter.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1850,   // rupees — adapter internally converts to 185000 paise
        currency: "INR",
        intentId: "i_test-pay-001",
      })
    );
  });

  // ── 7. updatePaymentStatus() ──────────────────────────────────────────────

  it("updatePaymentStatus() sends an UpdateCommand targeting PAYMENT#<intentId>", async () => {
    await paymentService.updatePaymentStatus(
      "i_test-pay-001",
      "EXECUTED",
      "pay_abc123"
    );

    const updateCall = mockDynamoSend.mock.calls.find((args) => {
      const cmd = args[0] as { input?: { Key?: { PK?: string } } };
      return cmd.input?.Key?.PK === "PAYMENT#i_test-pay-001";
    });

    expect(updateCall).toBeDefined();
  });
});
