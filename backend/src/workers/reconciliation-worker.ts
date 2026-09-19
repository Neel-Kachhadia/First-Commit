import { paymentService } from "../payments/payment-service.js";
import { reconciliationService } from "../services/reconciliation-service.js";
import { metrics } from "../utils/metrics.js";

/**
 * Minimum age (seconds) a stuck payment must reach before the reconciliation
 * worker processes it. This prevents the worker from immediately re-querying
 * Razorpay for payments that were just created (and are legitimately pending).
 */
const MIN_PAYMENT_AGE_SECONDS = 60;

/**
 * Sweeps for stuck payments and processes them.
 * This function can be invoked by a local scheduler or an AWS Lambda triggered by EventBridge.
 */
export async function runReconciliationSweep(): Promise<void> {
  console.log("[ReconciliationWorker] Starting reconciliation sweep...");
  try {
    const allStuck = await paymentService.findStuckPayments();

    // Filter out payments that are too new — give Razorpay time to settle.
    const cutoff = new Date(Date.now() - MIN_PAYMENT_AGE_SECONDS * 1000).toISOString();
    const stuckPayments = allStuck.filter(
      (p) => !p.createdAt || p.createdAt < cutoff
    );

    if (stuckPayments.length === 0) {
      const skipped = allStuck.length;
      if (skipped > 0) {
        console.log(
          `[ReconciliationWorker] ${skipped} payment(s) too new to reconcile (< ${MIN_PAYMENT_AGE_SECONDS}s). Skipping.`
        );
      } else {
        console.log("[ReconciliationWorker] No stuck payments found.");
      }
      return;
    }



    let successCount = 0;
    let retryCount = 0;
    let unknownCount = 0;
    let failCount = 0;

    for (const payment of stuckPayments) {
      try {
        const outcome = await reconciliationService.reconcile(payment.intentId);

        switch (outcome) {
          case "EXECUTED":
            successCount++;
            metrics.logEvent("RECONCILIATION_SUCCESS", { intentId: payment.intentId });
            break;
          case "FAILED":
            successCount++;
            metrics.logEvent("RECONCILIATION_SUCCESS", { intentId: payment.intentId, result: "FAILED" });
            break;
          case "RETRY":
            retryCount++;
            metrics.logEvent("RECONCILIATION_RETRY", { intentId: payment.intentId, reason: "PAYMENT_PENDING" });
            break;
          case "UNKNOWN":
          default:
            unknownCount++;
            metrics.logEvent("RECONCILIATION_RETRY", { intentId: payment.intentId, reason: "UNKNOWN" });
            break;
        }
      } catch (err: any) {
        failCount++;
        metrics.logEvent("RECONCILIATION_FAILURE", {
          intentId: payment.intentId,
          error: err.message,
        });
      }
    }

    console.log(
      `[ReconciliationWorker] Sweep complete: ${stuckPayments.length} checked, ${successCount} resolved, ${retryCount + unknownCount} pending.`
    );
  } catch (err: any) {
    console.error("[ReconciliationWorker] Critical error during sweep:", err);
    metrics.logEvent("RECONCILIATION_FAILURE", {
      error: "CRITICAL_SWEEP_ERROR",
      details: err.message,
    });
  }
}
