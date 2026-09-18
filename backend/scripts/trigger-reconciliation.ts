import dotenv from "dotenv";
dotenv.config();

import { reconciliationService } from "../src/services/reconciliation-service.js";

async function main() {
  console.log("=========================================");
  console.log("KavachPay - Reconciliation Trigger (Demo)");
  console.log("=========================================\n");

  try {
    await reconciliationService.reconcileAllStuckPayments();
    console.log("\nReconciliation completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("\nReconciliation failed:", error);
    process.exit(1);
  }
}

main();
