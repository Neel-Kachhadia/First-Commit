import { paymentService } from "../payments/payment-service.js";
import { intentRepository } from "../store/intent-repository.js";
import { reservationRepository } from "../store/reservation-repository.js";
import { getRazorpayAdapter } from "../payments/razorpay-adapter.js";
import { reconciliationRepository } from "../store/reconciliation-repository.js";
import { ReceiptService } from "./receipt-service.js";
import { metrics } from "../utils/metrics.js";

const receiptService = new ReceiptService();

/** Outcomes returned to the worker so it can emit the right metric. */
export type ReconciliationOutcome = "EXECUTED" | "FAILED" | "RETRY" | "UNKNOWN";

export class ReconciliationService {
  /**
   * Reconcile a stuck payment.
   * Ensures that KavachPay's state for the intent exactly matches Razorpay's authoritative state.
   */
  async reconcile(intentId: string): Promise<ReconciliationOutcome> {
    const payment = await paymentService.getPaymentRecord(intentId);
    if (!payment) {
      console.log(`[Reconciliation] Intent ${intentId} has no payment record. Skipping.`);
      return "UNKNOWN";
    }

    if (payment.status === "EXECUTED" || payment.status === "FAILED") {
      console.log(`[Reconciliation] Intent ${intentId} already in terminal state ${payment.status}. Idempotent no-op.`);
      return "EXECUTED";
    }

    const adapter = getRazorpayAdapter();
    let order;
    let payments;

    try {
      order = await adapter.getOrder(payment.razorpayOrderId);
    } catch (err: any) {
      if (err.statusCode === 404 || err.error?.code === "BAD_REQUEST_ERROR") {
        console.log(`[Reconciliation] Intent ${intentId}: Razorpay order not found. Will retry next sweep.`);
        return "UNKNOWN";
      }
      console.log(`[Reconciliation] Intent ${intentId}: Razorpay API unavailable. Will retry next sweep.`);
      return "UNKNOWN";
    }

    try {
      payments = await adapter.getOrderPayments(payment.razorpayOrderId);
    } catch (err: any) {
      console.log(`[Reconciliation] Intent ${intentId}: Razorpay payments API unavailable. Will retry next sweep.`);
      return "UNKNOWN";
    }

    let observedState = "UNKNOWN";
    let action: "EXECUTED" | "FAILED" | "RETRY" = "RETRY";
    let capturedPaymentId: string | undefined;

    const hasCaptured = payments.some((p: any) => p.status === "captured");
    const hasAuthorized = payments.some((p: any) => p.status === "authorized");
    const hasFailed = payments.some((p: any) => p.status === "failed");
    const hasCreated = payments.some((p: any) => p.status === "created");

    if (order.status === "paid" || hasCaptured) {
      observedState = "captured";
      action = "EXECUTED";
      const capturedPayment = payments.find((p: any) => p.status === "captured" || p.status === "authorized");
      capturedPaymentId = capturedPayment?.id;
    } else if (hasFailed && !hasCaptured && !hasAuthorized && !hasCreated) {
      observedState = "Definitively failed payment(s), no capture";
      action = "FAILED";
    } else if (order.status === "created" || order.status === "attempted") {
      observedState = "Pending";
      action = "RETRY";
    } else {
      observedState = "Ambiguous payment state";
      action = "RETRY";
    }

    if (action === "EXECUTED") {
      // 1. Update Intent status conditionally
      try {
        await intentRepository.updateStatus(intentId, "EXECUTED", "PAYMENT_CREATED");
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.log(`[Reconciliation] Intent ${intentId} already updated concurrently.`);
          return "EXECUTED";
        }
        throw err;
      }

      // 2. Update Payment status conditionally
      try {
        await paymentService.updatePaymentStatus(
          intentId,
          "EXECUTED",
          capturedPaymentId,
          "PAYMENT_CREATED"
        );
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.log(`[Reconciliation] Payment ${intentId} already updated concurrently.`);
          return "EXECUTED";
        }
        throw err;
      }

      const record = {
        intentId,
        paymentId: capturedPaymentId,
        previousPaymentState: payment.status,
        newPaymentState: "EXECUTED",
        razorpayOrderId: payment.razorpayOrderId,
        razorpayObservedState: observedState,
        reconciliationTimestamp: new Date().toISOString(),
        reconciliationReason: "State repaired based on Razorpay order/payment status",
      };

      const signed = await receiptService.signReconciliationEvent(record);
      
      await reconciliationRepository.createReconciliationEvent({
        ...record,
        reconciliationReceiptId: signed.receiptHash
      });

      console.log(`[Reconciliation] Intent ${intentId} repaired to EXECUTED.`);
      return "EXECUTED";

    } else if (action === "FAILED") {
      // 1. Unconditionally release reservation
      await reservationRepository.release(intentId);

      // 2. Update Intent status conditionally
      try {
        await intentRepository.updateStatus(intentId, "FAILED", "PAYMENT_CREATED");
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.log(`[Reconciliation] Intent ${intentId} already updated concurrently.`);
          return "FAILED";
        }
        throw err;
      }

      // 3. Update Payment status conditionally
      try {
        await paymentService.updatePaymentStatus(
          intentId,
          "FAILED",
          undefined,
          "PAYMENT_CREATED"
        );
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.log(`[Reconciliation] Payment ${intentId} already updated concurrently.`);
          return "FAILED";
        }
        throw err;
      }

      const record = {
        intentId,
        previousPaymentState: payment.status,
        newPaymentState: "FAILED",
        razorpayOrderId: payment.razorpayOrderId,
        razorpayObservedState: observedState,
        reconciliationTimestamp: new Date().toISOString(),
        reconciliationReason: "Payment definitively failed. State repaired and reservation released.",
      };

      const signed = await receiptService.signReconciliationEvent(record);

      await reconciliationRepository.createReconciliationEvent({
        ...record,
        reconciliationReceiptId: signed.receiptHash
      });

      console.log(`[Reconciliation] Intent ${intentId} repaired to FAILED. Reservation released.`);
      return "FAILED";
    } else {
      // Pending — Razorpay payment not yet resolved. Do NOT write a KMS-signed receipt
      // on every sweep. Just log and signal RETRY.
      console.log(`[Reconciliation] Intent ${intentId} remains PAYMENT_CREATED (${observedState}). Will retry next sweep.`);
      return "RETRY";
    }
  }

  private async logReconciliation(
    intentId: string,
    prevState: string,
    newState: string,
    observedState: string,
    reason: string,
    razorpayOrderId?: string
  ): Promise<void> {
    const intent = await intentRepository.getIntent(intentId);
    const record = {
      intentId,

      previousPaymentState: prevState,
      newPaymentState: newState,
      razorpayOrderId,
      razorpayObservedState: observedState,
      reconciliationTimestamp: new Date().toISOString(),
      reconciliationReason: reason,
    };
    const signed = await receiptService.signReconciliationEvent(record);
    await reconciliationRepository.createReconciliationEvent({
      ...record,
      reconciliationReceiptId: signed.receiptHash
    });
  }

  async reconcileAllStuckPayments(): Promise<void> {
    console.log(`[Reconciliation] Finding stuck payments...`);
    const stuck = await paymentService.findStuckPayments();
    console.log(`[Reconciliation] Found ${stuck.length} stuck payment(s).`);

    for (const payment of stuck) {
      await this.reconcile(payment.intentId);
    }
  }
}

export const reconciliationService = new ReconciliationService();
