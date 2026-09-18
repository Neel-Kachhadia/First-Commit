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
 */

let isRunning = false;

export function startLocalWorkers() {
  if (isRunning) return;
  isRunning = true;

  console.log("-----------------------------------------");
  console.log("Starting Local Workers (EventBridge mock)");
  console.log("-----------------------------------------");

  // Reconcile payments every 15 seconds for fast demo visibility
  setInterval(async () => {
    try {
      await runReconciliationSweep();
    } catch (e) {
      console.error(e);
    }
  }, 15000);

  // Sweep for expired grants every 20 seconds
  setInterval(async () => {
    try {
      await runExpirySweep();
    } catch (e) {
      console.error(e);
    }
  }, 20000);

  // Run invariant monitor every 30 seconds
  setInterval(async () => {
    try {
      await runInvariantMonitor();
    } catch (e) {
      console.error(e);
    }
  }, 30000);
}
