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
      const cmd = args[0] as { input?: { Item?: { PK?: string; SK?: string } } };
      return (
        cmd.input?.Item?.PK === "PAYMENT#i_test-pay-001" &&
        cmd.input?.Item?.SK === "META"
      );
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

  // ── 8. Test G: Duplicate execute() idempotency ─────────────────────────────

  it("returns existing payment record on duplicate execute() without creating another Razorpay order", async () => {
    const existingPaymentRecord = {
      intentId: "i_test-pay-001",
      userId: "user_001",
      amount: 1850,
      currency: "INR",
      razorpayOrderId: "order_test001",
      status: "PAYMENT_CREATED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Simulate DB state: first call has no payment record, PutCommand saves it,
    // subsequent calls return the saved payment record.
    let hasPaymentRecord = false;
    vi.mocked(intentRepository.getIntent).mockResolvedValue(buildIntent("RESERVED"));

    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        if (hasPaymentRecord) {
          return Promise.resolve({ Item: existingPaymentRecord });
        }
        return Promise.resolve({ Item: null });
      }
      if (command.constructor.name === "PutCommand") {
        hasPaymentRecord = true;
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    const firstResult = await paymentService.execute("i_test-pay-001");
    expect(firstResult.success).toBe(true);
    expect(firstResult.razorpayOrderId).toBe("order_test001");
    expect(mockAdapter.createPayment).toHaveBeenCalledTimes(1);

    // Second call: payment record already exists in DB
    const secondResult = await paymentService.execute("i_test-pay-001");
    expect(secondResult.success).toBe(true);
    expect(secondResult.razorpayOrderId).toBe("order_test001");

    // Must NOT have created a second Razorpay order
    expect(mockAdapter.createPayment).toHaveBeenCalledTimes(1);
  });

  // ── 9. Concurrent race condition on PutCommand ────────────────────────────

  it("handles race condition where PutCommand encounters ConditionalCheckFailedException and returns canonical payment", async () => {
    const canonicalRecord = {
      intentId: "i_test-pay-001",
      userId: "user_001",
      amount: 1850,
      currency: "INR",
      razorpayOrderId: "order_canonical_won_race",
      status: "PAYMENT_CREATED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const conditionalError = new Error("Conditional check failed");
    conditionalError.name = "ConditionalCheckFailedException";

    vi.mocked(intentRepository.getIntent).mockResolvedValue(buildIntent("RESERVED"));

    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        // Initial pre-check returns null; post-race retrieval returns canonical
        return Promise.resolve({ Item: canonicalRecord });
      }
      if (command.constructor.name === "PutCommand") {
        return Promise.reject(conditionalError);
      }
      return Promise.resolve({});
    });

    // We simulate initial getPaymentRecord returning null, but PutCommand failing
    let getCallCount = 0;
    mockDynamoSend.mockImplementation((cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === "GetCommand") {
        getCallCount++;
        if (getCallCount === 1) {
          return Promise.resolve({ Item: null }); // initial check
        }
        return Promise.resolve({ Item: canonicalRecord }); // canonical record retrieval
      }
      if (command.constructor.name === "PutCommand") {
        return Promise.reject(conditionalError);
      }
      return Promise.resolve({});
    });

    const result = await paymentService.execute("i_test-pay-001");

    expect(result.success).toBe(true);
    expect(result.razorpayOrderId).toBe("order_canonical_won_race");
  });
});
