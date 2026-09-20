import { dynamo } from "./store/dynamodb.js";
import { TABLE_NAME } from "./store/table.js";
import { ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { grantRepository } from "./store/grant-repository.js";
import { paymentProfileRepository } from "./store/payment-profile-repository.js";
import { auditRepository } from "./store/audit-repository.js";
import type { PaymentProfile } from "./models/payment-profile.js";

export interface DemoResetResult {
  success: boolean;
  message: string;
  paymentProfileId: string;
  rootGrantId: string;
  childGrantId: string;
  deletedCount: number;
}

export async function resetDemo(userId: string = "u_frontend_demo"): Promise<DemoResetResult> {
  console.log(`[demo-reset] Resetting demo state for user ${userId} on table ${TABLE_NAME}`);

  // 1. Delete existing items for user
  const scanCmd = new ScanCommand({ TableName: TABLE_NAME });
  const { Items } = await dynamo.send(scanCmd);

  let deletedCount = 0;
  if (Items && Items.length > 0) {
    for (const item of Items) {
      let belongsToUser = false;
      if (item.PK?.S === `USER#${userId}`) {
        belongsToUser = true;
      } else if (item.userId?.S === userId) {
        belongsToUser = true;
      }

      if (belongsToUser && item.PK && item.SK) {
        await dynamo.send(
          new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          })
        );
        deletedCount++;
      }
    }
  }

  console.log(`[demo-reset] Deleted ${deletedCount} previous item(s) for user ${userId}.`);

  const now = new Date().toISOString();

  // ── 2. CREATE PAYMENT PROFILE FIRST ──────────────────────────────────────────
  // Per architectural rule: profile FIRST, root grant SECOND.
  // Root grant's paymentProfileId must reference an already-persisted profile.
  const paymentProfileId = `pp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const demoProfile: PaymentProfile = {
    paymentProfileId,
    userId,
    provider: "RAZORPAY",
    environment: "TEST",
    methodType: "CARD",
    displayName: "Visa •••• 1111",
    status: "ACTIVE",
    connectionMode: "SIMULATED",
    createdAt: now,
    updatedAt: now,
  };

  await paymentProfileRepository.createProfile(demoProfile);
  console.log(`[demo-reset] 1/3: Seeded PaymentProfile FIRST -> ${paymentProfileId} (ACTIVE, SIMULATED, Razorpay TEST)`);

  // ── 3. CREATE ROOT GRANT SECOND WITH PAYMENT PROFILE ID ─────────────────────
  const rootGrantId = `g_root_${Date.now()}`;
  await grantRepository.createGrant({
    grantId: rootGrantId,
    userId,
    label: "Master Demo Authority",
    paymentProfileId, // Binds the actual persisted profile ID
    limit: 10000,
    consumed: 0,
    currency: "INR",
    category: "GENERAL",
    merchantAllow: [],
    delegationEnabled: true,
    window: "MONTHLY",
    windowStart: now,
    hardMax: 5000,
    createdAt: now,
    updatedAt: now,
    status: "ACTIVE",
    maxDepth: 3,
    maxChildren: 10,
  });
  console.log(`[demo-reset] 2/3: Seeded Root Grant SECOND -> ${rootGrantId} (bound to ${paymentProfileId})`);

  // ── 4. CREATE CHILD GRANT INHERITING ROOT AUTHORITY ──────────────────────────
  // Child grant does NOT establish a paymentProfileId (inherits via authority path).
  const childGrantId = `g_child_${Date.now()}`;
  await grantRepository.createGrant({
    grantId: childGrantId,
    userId,
    label: "Pharmacy Agent Mandate",
    parentGrantId: rootGrantId,
    // paymentProfileId is deliberately undefined — inherited from root
    limit: 2000,
    consumed: 0,
    currency: "INR",
    category: "HEALTHCARE",
    merchantAllow: ["Apollo Pharmacy", "MedPlus"],
    delegationEnabled: false,
    window: "MONTHLY",
    windowStart: now,
    hardMax: 1000,
    createdAt: now,
    updatedAt: now,
    status: "ACTIVE",
    maxDepth: 0,
    maxChildren: 0,
  });

  await grantRepository.createEdge({
    parentGrantId: rootGrantId,
    childGrantId,
    createdAt: now,
  });
  console.log(`[demo-reset] 3/3: Seeded Child Grant -> ${childGrantId} (inherits execution context via ${rootGrantId})`);

  await auditRepository.logEvent(
    userId,
    "DEMO_RESET",
    { rootGrantId, childGrantId, paymentProfileId, deletedCount },
    "SYSTEM"
  );

  return {
    success: true,
    message: "Demo environment reset complete",
    paymentProfileId,
    rootGrantId,
    childGrantId,
    deletedCount,
  };
}

// Direct CLI execution support
if (process.argv[1]?.replace(/\\/g, "/").endsWith("demo-reset.ts")) {
  const targetUser = process.env.DEMO_USER_ID || "u_frontend_demo";
  resetDemo(targetUser)
    .then((result) => {
      console.log("\n============================================================");
      console.log(" KAVACHPAY DEMO RESET COMPLETE");
      console.log("============================================================");
      console.log(`User:             ${targetUser}`);
      console.log(`Payment Profile:  ${result.paymentProfileId} (ACTIVE · SIMULATED)`);
      console.log(`Root Mandate:     ${result.rootGrantId}`);
      console.log(`Child Mandate:    ${result.childGrantId}`);
      console.log(`Deleted Items:    ${result.deletedCount}`);
      console.log("============================================================\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[demo-reset] FAILED:", err);
      process.exit(1);
    });
}
