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

  // Run reconciliation only on interval (every 5 minutes)
  const reconciliationInterval = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      await runReconciliationSweep();
    } catch (e) {
      console.error("[LocalScheduler] Reconciliation error:", e);
    }
  }, reconciliationInterval);

  // Expiry sweep: run immediately, then every 20 seconds
  const runExpiry = async () => {
    try {
      await runExpirySweep();
    } catch (e) {
      console.error("[LocalScheduler] Expiry sweep error:", e);
    }
  };
  runExpiry();
  setInterval(runExpiry, 20000);

  // Invariant monitor: run immediately, then every 60 seconds
  const runInvariant = async () => {
    try {
      await runInvariantMonitor();
    } catch (e) {
      console.error("[LocalScheduler] Invariant monitor error:", e);
    }
  };
  runInvariant();
  setInterval(runInvariant, 60000);
}
