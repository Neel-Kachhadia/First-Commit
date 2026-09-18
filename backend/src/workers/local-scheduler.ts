import { runReconciliationSweep } from "./reconciliation-worker.js";
import { runExpirySweep } from "./expiry-worker.js";
import { runInvariantMonitor } from "./invariant-monitor.js";

/**
 * Local Scheduler (Development / Demo Only)
 *
 * In a real AWS deployment, these workers are triggered by
 * EventBridge Scheduler -> Lambda.
 * For this hackathon / local development, we run a setInterval loop
 * to visibly demonstrate the automation.
 *
 * Intervals:
 *  Reconciliation  — 5 minutes  (only processes payments > 60s old)
 *  Expiry          — 20 seconds (grants can expire any time)
 *  Invariant       — 60 seconds (health check; quiet when clean)
 */

let isRunning = false;

export function startLocalWorkers() {
  if (isRunning) return;
  isRunning = true;

  console.log("-----------------------------------------");
  console.log("Starting Local Workers (EventBridge mock)");
  console.log("-----------------------------------------");

  // Run once immediately on startup so you see state in the first sweep,
  // then every 5 minutes thereafter (300 seconds).
  const reconciliationInterval = 5 * 60 * 1000;

  const runReconciliation = async () => {
    try {
      await runReconciliationSweep();
    } catch (e) {
      console.error("[LocalScheduler] Reconciliation error:", e);
    }
  };

  setInterval(runReconciliation, reconciliationInterval);

  // Sweep for expired grants every 20 seconds
  setInterval(async () => {
    try {
      await runExpirySweep();
    } catch (e) {
      console.error("[LocalScheduler] Expiry sweep error:", e);
    }
  }, 20000);

  // Run invariant monitor every 60 seconds
  setInterval(async () => {
    try {
      await runInvariantMonitor();
    } catch (e) {
      console.error("[LocalScheduler] Invariant monitor error:", e);
    }
  }, 60000);
}
