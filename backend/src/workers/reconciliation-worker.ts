import { paymentService } from "../payments/payment-service.js";
import { reconciliationService } from "../services/reconciliation-service.js";
import { metrics } from "../utils/metrics.js";

/**
 * Sweeps for stuck payments and processes them.
 * This function can be invoked by a local scheduler or an AWS Lambda triggered by EventBridge.
 */
export async function runReconciliationSweep(): Promise<void> {
  console.log("[ReconciliationWorker] Starting reconciliation sweep...");
  try {
    const stuckPayments = await paymentService.findStuckPayments();
    
    if (stuckPayments.length === 0) {
      console.log("[ReconciliationWorker] No stuck payments found.");
      return;
    }

    console.log(`[ReconciliationWorker] Found ${stuckPayments.length} stuck payments. Processing...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const payment of stuckPayments) {
      try {
        await reconciliationService.reconcile(payment.intentId);
        successCount++;
        metrics.logEvent("RECONCILIATION_SUCCESS", { intentId: payment.intentId });
      } catch (err: any) {
        failCount++;
        metrics.logEvent("RECONCILIATION_FAILURE", { intentId: payment.intentId, error: err.message });
      }
    }

    console.log(`[ReconciliationWorker] Sweep complete. Success: ${successCount}, Fail: ${failCount}`);
  } catch (err: any) {
    console.error("[ReconciliationWorker] Critical error during sweep:", err);
    metrics.logEvent("RECONCILIATION_FAILURE", { error: "CRITICAL_SWEEP_ERROR", details: err.message });
  }
}
