import "dotenv/config";
import { ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";
import { grantService } from "../services/grant-service.js";
import { intentService } from "../services/intent-service.js";
import { intentRepository } from "../store/intent-repository.js";
import { authorityEngine } from "../engine/authority-engine.js";
import { decisionRepository } from "../store/decision-repository.js";
import { reservationRepository } from "../store/reservation-repository.js";
import { receiptService } from "../services/receipt-service.js";
import { applyTransition } from "../engine/intent-state-machine.js";

// Real Cognito sub for bhandariarnav06@gmail.com
const DEMO_USER = "a1f3edba-9001-7015-b00f-64cd2f3f49e5";

async function clearDemoState() {
  console.log(`\nClearing existing state for ${DEMO_USER}...`);
  let lastEvaluatedKey: any = undefined;
  let deletedCount = 0;

  do {
    const scanResult = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResult.Items || [];
    for (const item of items) {
      // Find items belonging to the demo user. They either have userId set,
      // or the PK/SK contains the user ID (e.g., USER#u_frontend_demo).
      if (
        item.userId === DEMO_USER ||
        (item.PK && item.PK.includes(DEMO_USER)) ||
        (item.SK && item.SK.includes(DEMO_USER))
      ) {
        await dynamo.send(
          new DeleteCommand({
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

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`✓ Deleted ${deletedCount} records for ${DEMO_USER}.`);
}

async function seedDemoData() {
  console.log(`\nSeeding new state for ${DEMO_USER}...`);

  // 1. Payment Profile
  const profileId = "PAYPROF-DEMO";
  const now = new Date().toISOString();
  await paymentProfileRepository.createProfile({
    userId: DEMO_USER,
    paymentProfileId: profileId,
    provider: "RAZORPAY",
    environment: "TEST",
    methodType: "CARD",
    displayName: "Visa •••• 1111",
    status: "ACTIVE",
    connectionMode: "SIMULATED",
    createdAt: now,
    updatedAt: now,
  });
  console.log(`✓ Created Payment Profile: ${profileId}`);

  // 2. Root Mandates (with paymentProfileId bound)
  const rootGrants = [
    { name: "Shopping Mandate", budget: 20000, categories: ["RETAIL", "GENERAL"] },
    { name: "Travel Mandate", budget: 50000, categories: ["TRAVEL", "FLIGHTS"] },
    { name: "Food Mandate", budget: 10000, categories: ["FOOD", "GROCERY"] },
    { name: "Subscription Mandate", budget: 5000, categories: ["SOFTWARE", "ENTERTAINMENT"] },
  ];

  const rootGrantIds: Record<string, string> = {};

  for (const root of rootGrants) {
    const grant = await grantService.createGrant({
      userId: DEMO_USER,
      label: root.name,
      limit: root.budget,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: root.budget,
      stepUpAbove: root.name === "Shopping Mandate" ? 5000 : (root.name === "Travel Mandate" ? 40000 : undefined),
      currency: "INR",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      delegationEnabled: true,
      blockedCategories: root.name === "Shopping Mandate" ? ["ALCOHOL"] : [],
      paymentProfileId: profileId, // bind payment profile to root mandate
    });
    rootGrantIds[root.name] = grant.grantId;
  }
  console.log(`✓ Created ${rootGrants.length} Root Mandates`);

  // 3. Delegations (Agents)
  const agents = [
    { name: "Shopping Agent", root: "Shopping Mandate", budget: 15000 },
    { name: "Grocery Agent", root: "Shopping Mandate", budget: 5000 },
    { name: "Travel Agent", root: "Travel Mandate", budget: 50000 },
    { name: "Food Delivery Agent", root: "Food Mandate", budget: 3000 },
    { name: "Subscription Agent", root: "Subscription Mandate", budget: 5000 },
  ];

  const agentGrantIds: Record<string, string> = {};

  for (const agent of agents) {
    const parentGrantId = rootGrantIds[agent.root];
    const grant = await grantService.createGrant({
      userId: DEMO_USER,
      parentGrantId,
      label: agent.name,
      limit: agent.budget,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: agent.budget,
      currency: "INR",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      delegationEnabled: true,
    });
    agentGrantIds[agent.name] = grant.grantId;
  }
  console.log(`✓ Created ${agents.length} Delegations`);

  // 4. Intents & Decisions
  const intentSpecs = [
    // 5 APPROVED
    { agent: "Grocery Agent", amount: 1500, merchant: "Blinkit", category: "GROCERY", targetState: "APPROVED" },
    { agent: "Grocery Agent", amount: 2000, merchant: "Zepto", category: "GROCERY", targetState: "APPROVED" },
    { agent: "Subscription Agent", amount: 649, merchant: "Netflix", category: "ENTERTAINMENT", targetState: "APPROVED" },
    { agent: "Travel Agent", amount: 1200, merchant: "Uber", category: "TRAVEL", targetState: "APPROVED" },
    { agent: "Shopping Agent", amount: 4500, merchant: "Amazon", category: "RETAIL", targetState: "APPROVED" },
    
    // 2 STEP_UP_REQUIRED
    { agent: "Shopping Agent", amount: 8000, merchant: "Flipkart", category: "RETAIL", targetState: "STEP_UP" },
    { agent: "Travel Agent", amount: 45000, merchant: "MakeMyTrip", category: "FLIGHTS", targetState: "STEP_UP" },
    
    // 3 DENIED
    { agent: "Food Delivery Agent", amount: 4000, merchant: "Zomato", category: "FOOD" }, // budget exceeded (Agent limit is 3000)
    { agent: "Subscription Agent", amount: 6000, merchant: "Spotify", category: "ENTERTAINMENT" }, // exceeds budget of 5000
    { agent: "Shopping Agent", amount: 2000, merchant: "Liquor Store", category: "ALCOHOL" }, // unapproved category
    
    // 2 RESERVED/AUTHORIZED (these will naturally be RESERVED if budget allows)
    { agent: "Travel Agent", amount: 3500, merchant: "Ola", category: "TRAVEL" },
    { agent: "Food Delivery Agent", amount: 800, merchant: "Swiggy", category: "FOOD" },
  ];

  let approvedCount = 0;
  let stepUpCount = 0;
  let deniedCount = 0;
  let authorizedCount = 0;

  for (let i = 0; i < intentSpecs.length; i++) {
    const spec = intentSpecs[i];
    const grantId = agentGrantIds[spec.agent];

    const result = await intentService.createIntent({
      userId: DEMO_USER,
      grantId,
      amount: spec.amount,
      currency: "INR",
      merchant: {
        merchantId: spec.merchant.toLowerCase().replace(/\s+/g, "-"),
        name: spec.merchant,
        category: spec.category,
      },
      description: `Payment for ${spec.merchant}`,
      idempotencyKey: `demo_idem_${Date.now()}_${i}`,
      origin: {
        type: "AGENT_RUNTIME",
        agentId: "KAVACHPAY_AGENTCORE",
        taskId: `DEMO-TASK-00${i + 1}`, // Simulate some valid future orchestration task
        commandId: `DEMO-CMD-00${i + 1}`,
      },
    });

    // We rely on the natural execution of the authority engine within createIntent.
    const decisionStatus = result.decision.decision;
    
    if (decisionStatus === "ALLOW") {
      approvedCount++; 
    } else if (decisionStatus === "DENY") {
      deniedCount++;
    } else if (decisionStatus === "STEP_UP") {
      stepUpCount++;
    }
  }
  
  console.log(`✓ Created 12 Intents (${approvedCount} Approved, ${stepUpCount} Step-up, ${deniedCount} Denied, ${authorizedCount} Authorized)`);

  console.log(`\n────────────────────────────`);
  console.log(`KavachPay Demo Reset`);
  console.log(`────────────────────────────`);
  console.log(`User: ${DEMO_USER}\n`);
  console.log(`Agents:             ${agents.length}`);
  console.log(`Root mandates:      ${rootGrants.length}`);
  console.log(`Delegations:        ${agents.length}`);
  console.log(`Intents:           ${intentSpecs.length}`);
  console.log(`Approved:           ${approvedCount}`);
  console.log(`Step-up:            ${stepUpCount}`);
  console.log(`Denied:             ${deniedCount}`);
  console.log(`Authorized:         ${authorizedCount}\n`);
  // exposure sum of approved + authorized
  const exposure = intentSpecs
    .filter(i => i.targetState === "APPROVED" || i.targetState === "AUTHORIZED")
    .reduce((acc, i) => acc + i.amount, 0);
  console.log(`Exposure:           ₹${exposure}`);
  console.log(`Payment Profiles:   1`);
  console.log(`Causal Replays:    ${intentSpecs.length}\n`);
  console.log(`✓ DynamoDB reset for ${DEMO_USER}`);
  console.log(`✓ Demo data seeded`);
  console.log(`✓ Ready for presentation`);
}

async function main() {
  try {
    await clearDemoState();
    await seedDemoData();
    process.exit(0);
  } catch (err) {
    console.error("Demo reset failed:", err);
    process.exit(1);
  }
}

main();
