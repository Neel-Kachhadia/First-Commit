import { randomUUID } from "crypto";
import { causalReplayService } from "./src/services/causal-replay-service.js";

const API_BASE = "http://localhost:4000";
const USER_ID = "u_frontend_demo";

async function runFlow() {
  console.log("========================================");
  console.log(" KAVACHPAY DENY REPLAY VALIDATION");
  console.log("========================================\n");

  // [1] Create Grant
  console.log("[1] Creating Grocery Mandate...");
  const grantRes = await fetch(`${API_BASE}/v0/grants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER_ID,
      label: "Demo Grocery Mandate",
      userId: USER_ID,
      label: "Demo Grocery Mandate",
      limit: 5000,
      currency: "INR",
      stepUpAbove: 2000,
      hardMax: 5000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      merchantAllow: ["Blinkit", "Zepto", "Swiggy Instamart"],
      category: "GROCERY"
    })
  });
  
  const grantData = await grantRes.json();
  if (!grantData.success) {
    console.error("Grant creation failed:", grantData);
    throw new Error("Failed to create grant");
  }
  const grantId = grantData.grant.grantId;
  console.log(`✅ Mandate Created! ID: ${grantId}\n`);

  // [2] Attempt transaction that should be DENIED
  console.log("[2] Attempting transaction at unapproved merchant (LiquorStore)...");
  const denyRes = await fetch(`${API_BASE}/v0/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER_ID,
      grantId: grantId,
      amount: 1000,
      currency: "INR",
      idempotencyKey: randomUUID(),
      merchant: { merchantId: "LiquorStore", name: "Local Liquor", category: "ALCOHOL" }
    })
  });
  
  const denyData = await denyRes.json();
  console.log(denyData);
  const denyIntentId = denyData.intent?.intentId;
  console.log(`✅ Transaction Result: ${denyData.decision?.decision} (Reason: ${denyData.decision?.reasonCode}) | Intent ID: ${denyIntentId}\n`);

  // [3] Fetch Replay
  console.log("[3] Fetching Replay JSON...");
  const replay = await causalReplayService.replay(denyIntentId, USER_ID);
  console.log(JSON.stringify(replay, null, 2));
}

runFlow().catch(console.error);
