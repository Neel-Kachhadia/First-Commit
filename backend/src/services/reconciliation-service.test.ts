import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconciliationService } from "./reconciliation-service.js";
import { paymentService } from "../payments/payment-service.js";
import { intentRepository } from "../store/intent-repository.js";
import { reservationRepository } from "../store/reservation-repository.js";
import { getRazorpayAdapter } from "../payments/razorpay-adapter.js";
import { reconciliationRepository } from "../store/reconciliation-repository.js";
import { decisionRepository } from "../store/decision-repository.js";

// Mock dependencies
vi.mock("../payments/payment-service.js");
vi.mock("../store/intent-repository.js");
vi.mock("../store/reservation-repository.js");
vi.mock("../payments/razorpay-adapter.js");
vi.mock("../store/reconciliation-repository.js");
vi.mock("../store/decision-repository.js");

// We also mock ReceiptService to avoid actual KMS calls during these tests
vi.mock("./receipt-service.js", () => {
  return {
    ReceiptService: vi.fn().mockImplementation(() => {
      return {
        signReconciliationEvent: vi.fn().mockResolvedValue({
          receiptHash: "mocked-reconciliation-hash",
          signature: "mocked-signature",
          keyId: "mocked-key",
          signedAt: "2026-09-18T12:00:00Z",
          algorithm: "RSASSA_PSS_SHA_256",
        }),
      };
    }),
  };
});

describe("ReconciliationService", () => {
  const mockIntentId = "i_test";
  const mockRazorpayOrderId = "order_test";
  const mockDecisionId = "dec_test";
  
  let mockAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdapter = {
      getOrder: vi.fn(),
      getOrderPayments: vi.fn(),
    };

    vi.mocked(getRazorpayAdapter).mockReturnValue(mockAdapter);

    vi.mocked(intentRepository.getIntent).mockResolvedValue({
      intentId: mockIntentId,
      status: "PAYMENT_CREATED",
      userId: "u_test",
      decisionId: mockDecisionId,
      createdAt: "2026-09-18T12:00:00Z",
      updatedAt: "2026-09-18T12:00:00Z",
    } as any);

    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      intentId: mockIntentId,
      status: "PAYMENT_CREATED",
      razorpayOrderId: mockRazorpayOrderId,
      amount: 100,
      currency: "INR",
      userId: "u_test",
      createdAt: "2026-09-18T12:00:00Z",
      updatedAt: "2026-09-18T12:00:00Z",
    } as any);

    // Default: condition checks pass
    vi.mocked(intentRepository.updateStatus).mockResolvedValue();
    vi.mocked(paymentService.updatePaymentStatus).mockResolvedValue();
    vi.mocked(reconciliationRepository.createReconciliationEvent).mockResolvedValue();
  });

  it("captured + PAYMENT_CREATED → EXECUTED", async () => {
    mockAdapter.getOrder.mockResolvedValue({ status: "paid" });
    mockAdapter.getOrderPayments.mockResolvedValue([{ id: "pay_1", status: "captured" }]);

    const outcome = await reconciliationService.reconcile(mockIntentId);
    expect(outcome).toBe("EXECUTED");

    expect(intentRepository.updateStatus).toHaveBeenCalledWith(mockIntentId, "EXECUTED", "PAYMENT_CREATED");
    expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(mockIntentId, "EXECUTED", "pay_1", "PAYMENT_CREATED");
    
    // Receipt/Decision is NOT modified
    expect(decisionRepository.createDecision).not.toHaveBeenCalled();
    expect(decisionRepository.createReceipt).not.toHaveBeenCalled();

    // Reconcilation event is created
    expect(reconciliationRepository.createReconciliationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newPaymentState: "EXECUTED",
        razorpayObservedState: "captured",
      })
    );
  });

  it("failed + PAYMENT_CREATED → FAILED (and reservation released)", async () => {
    mockAdapter.getOrder.mockResolvedValue({ status: "attempted" });
    mockAdapter.getOrderPayments.mockResolvedValue([{ id: "pay_1", status: "failed" }]);

    const outcome = await reconciliationService.reconcile(mockIntentId);
    expect(outcome).toBe("FAILED");

    expect(intentRepository.updateStatus).toHaveBeenCalledWith(mockIntentId, "FAILED", "PAYMENT_CREATED");
    expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(mockIntentId, "FAILED", undefined, "PAYMENT_CREATED");
    expect(reservationRepository.release).toHaveBeenCalledWith(mockIntentId);

    expect(reconciliationRepository.createReconciliationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newPaymentState: "FAILED",
        razorpayObservedState: "Definitively failed payment(s), no capture",
      })
    );
  });

  it("already EXECUTED / FAILED → no-op", async () => {
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValueOnce({
      intentId: mockIntentId,
      status: "EXECUTED",
      razorpayOrderId: mockRazorpayOrderId,
    } as any);

    const outcome = await reconciliationService.reconcile(mockIntentId);
    expect(outcome).toBe("EXECUTED"); // terminal state treated as EXECUTED no-op

    expect(mockAdapter.getOrder).not.toHaveBeenCalled();
    expect(intentRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("missing Razorpay order → handled safely", async () => {
    mockAdapter.getOrder.mockRejectedValue({ statusCode: 404 });

    const outcome = await reconciliationService.reconcile(mockIntentId);

    expect(intentRepository.updateStatus).not.toHaveBeenCalled();
    // No longer writes a reconciliation event for transient errors — logs only
    expect(reconciliationRepository.createReconciliationEvent).not.toHaveBeenCalled();
    expect(outcome).toBe("UNKNOWN");
  });

  it("Razorpay API unavailable → retryable failure", async () => {
    mockAdapter.getOrder.mockRejectedValue(new Error("Network error"));

    const outcome = await reconciliationService.reconcile(mockIntentId);

    expect(intentRepository.updateStatus).not.toHaveBeenCalled();
    // No longer writes a reconciliation event for transient errors — logs only
    expect(reconciliationRepository.createReconciliationEvent).not.toHaveBeenCalled();
    expect(outcome).toBe("UNKNOWN");
  });

  it("duplicate reconciliation → idempotent", async () => {
    // If the concurrent process already set to EXECUTED while we read PAYMENT_CREATED,
    // the conditional check will fail.
    mockAdapter.getOrder.mockResolvedValue({ status: "paid" });
    mockAdapter.getOrderPayments.mockResolvedValue([{ id: "pay_1", status: "captured" }]);

    const conditionalError = new Error("Condition check failed");
    conditionalError.name = "ConditionalCheckFailedException";
    
    vi.mocked(intentRepository.updateStatus).mockRejectedValueOnce(conditionalError);

    await reconciliationService.reconcile(mockIntentId);
    
    // Should swallow the conditional error and skip payment update
    expect(paymentService.updatePaymentStatus).not.toHaveBeenCalled();
  });

  it("concurrent reconciliation cannot double-process", async () => {
    // Both reads happen at the same time and both see PAYMENT_CREATED
    // Both call razorpay and get 'captured'
    // First one succeeds:
    mockAdapter.getOrder.mockResolvedValue({ status: "paid" });
    mockAdapter.getOrderPayments.mockResolvedValue([{ id: "pay_1", status: "captured" }]);

    const conditionalError = new Error("Condition check failed");
    conditionalError.name = "ConditionalCheckFailedException";
    
    vi.mocked(paymentService.updatePaymentStatus).mockRejectedValueOnce(conditionalError);

    await reconciliationService.reconcile(mockIntentId);
    
    // It shouldn't crash, and it shouldn't log a new EXECUTED receipt if payment state update failed due to race.
    // In our implementation, it will log "already updated concurrently" and return.
    expect(reconciliationRepository.createReconciliationEvent).not.toHaveBeenCalled();
  });

  it("captured payment cannot be reverted to FAILED", async () => {
    // Even if Razorpay has a failed payment, if there is a captured payment, it remains captured.
    mockAdapter.getOrder.mockResolvedValue({ status: "paid" });
    mockAdapter.getOrderPayments.mockResolvedValue([
      { id: "pay_fail", status: "failed" },
      { id: "pay_cap", status: "captured" },
    ]);

    await reconciliationService.reconcile(mockIntentId);

    expect(intentRepository.updateStatus).toHaveBeenCalledWith(mockIntentId, "EXECUTED", "PAYMENT_CREATED");
  });

  it("reconciliation cannot modify original decision receipt", async () => {
    mockAdapter.getOrder.mockResolvedValue({ status: "paid" });
    mockAdapter.getOrderPayments.mockResolvedValue([{ id: "pay_1", status: "captured" }]);

    await reconciliationService.reconcile(mockIntentId);

    expect(decisionRepository.createReceipt).not.toHaveBeenCalled();
    expect(decisionRepository.createDecision).not.toHaveBeenCalled();
    
    // Only the reconciliation repository is written to
    expect(reconciliationRepository.createReconciliationEvent).toHaveBeenCalled();
  });
});
