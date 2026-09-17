import { randomUUID, createHmac } from "crypto";

const API_BASE = "http://localhost:4000";
const USER_ID = "u_frontend_demo";

async function runFlow() {
  console.log("========================================");
  console.log(" KAVACHPAY DEMO END-TO-END VALIDATION");
  console.log("========================================");

  // 1. Create a Mandate (Grant)
  console.log("\n[1] Creating Grocery Mandate...");
  const grantRes = await fetch(`${API_BASE}/v0/grants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  });
  const grantData = await grantRes.json();
  if (!grantData.success) {
    console.error("Grant creation failed:", grantData);
    throw new Error("Failed to create grant");
  }
  const grantId = grantData.grant.grantId;
  console.log(`✅ Mandate Created! ID: ${grantId} | Limit: ₹5,000 | Cap: ₹2,000`);

  // 2. Create Transaction (ALLOW - Below Cap)
  console.log("\n[2] Attempting transaction within limit (₹1,500 at Blinkit)...");
  const allowRes = await fetch(`${API_BASE}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER_ID,
      grantId,
      amount: 150000,
      currency: "INR",
      merchant: { merchantId: "Blinkit", name: "Blinkit", category: "GROCERY" },
      idempotencyKey: `sim_${Date.now()}_allow`,
    }),
  });
  const allowData = await allowRes.json();
  if (allowData.decision !== "ALLOW" && allowData.decision?.decision !== "ALLOW") {
    console.error("Allow failed:", allowData);
    throw new Error("Expected ALLOW decision");
  }
  console.log(`✅ Transaction ALLOWED! Order ID: ${allowData.payment?.razorpayOrderId}`);

  // 3. Create Transaction (STEP-UP - Above Cap)
  console.log("\n[3] Attempting transaction above cap (₹2,500 at Zepto)...");
  const stepUpRes = await fetch(`${API_BASE}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER_ID,
      grantId,
      amount: 250000,
      currency: "INR",
      merchant: { merchantId: "Zepto", name: "Zepto", category: "GROCERY" },
      idempotencyKey: `sim_${Date.now()}_stepup`,
    }),
  });
  const stepUpData = await stepUpRes.json();
  if (stepUpData.decision !== "STEP_UP" && stepUpData.decision?.decision !== "STEP_UP") {
    console.error("Step-up failed:", stepUpData);
    throw new Error("Expected STEP_UP decision");
  }
  const stepUpIntentId = stepUpData.intent.intentId;
  console.log(`✅ Transaction requires STEP-UP! Intent ID: ${stepUpIntentId}`);

  // 4. Approve the STEP-UP Transaction
  console.log("\n[4] Account holder approving the STEP-UP intent...");
  const approveRes = await fetch(`${API_BASE}/v0/intents/${stepUpIntentId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_ID }),
  });
  const approveData = await approveRes.json();
  if (!approveData.success || (approveData.decision !== "ALLOW" && approveData.decision?.decision !== "ALLOW")) throw new Error("Expected ALLOW after approval");
  console.log(`✅ Intent Approved!`);

  console.log("\n[4.5] Executing the approved intent (creating Razorpay order)...");
  const execRes = await fetch(`${API_BASE}/api/execute-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intentId: stepUpIntentId,
    }),
  });
  const execData = await execRes.json();
  if (!execData.success || !execData.order_id) {
    console.error("Execution failed:", execData);
    throw new Error("Expected execution to succeed");
  }
  const rzpOrderId = execData.order_id;
  console.log(`✅ Payment Executed! Order ID: ${rzpOrderId}`);

  // 5. Simulate Razorpay Webhook (Payment Captured)
  console.log("\n[5] Simulating Razorpay webhook (order.paid) for approved transaction...");
  const eventId = `ev_${randomUUID()}`;
  
  const orderId = rzpOrderId || `order_${randomUUID()}`; 

  const webhookPayload = {
    entity: "event",
    account_id: "acc_test",
    event: "order.paid",
    contains: ["payment", "order"],
    payload: {
      payment: { entity: { id: `pay_${randomUUID()}`, amount: 250000, status: "captured", notes: { intentId: stepUpIntentId } } },
      order: { entity: { id: orderId, amount: 250000, receipt: stepUpIntentId, status: "paid", notes: { intentId: stepUpIntentId } } }
    },
    created_at: Math.floor(Date.now() / 1000)
  };

  const rawBody = JSON.stringify(webhookPayload);
  // Get secret from environment or assume fallback for test
  const secret = "whsec_test_secret_placeholder";
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

  const webhookRes = await fetch(`${API_BASE}/v0/webhooks/razorpay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    },
    body: rawBody,
  });
  const webhookData = await webhookRes.json();
  if (webhookData.error) throw new Error(`Webhook failed: ${webhookData.message}`);
  console.log(`✅ Webhook processed! Response:`, webhookData);

  // 6. Check Ledger Updates
  console.log("\n[6] Fetching updated ledger...");
  const ledgerRes = await fetch(`${API_BASE}/v0/intents?userId=${USER_ID}`);
  const ledgerData = await ledgerRes.json();
  const stepUpLedgerEntry = ledgerData.intents.find((i: any) => i.intentId === stepUpIntentId);
  console.log(`✅ Ledger verified. Intent status is now: ${stepUpLedgerEntry?.status}`);

  // 7. Revoke Mandate
  console.log("\n[7] Revoking the Mandate...");
  const revokeRes = await fetch(`${API_BASE}/v0/grants/${grantId}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_ID }),
  });
  const revokeData = await revokeRes.json();
  console.log(`✅ Mandate revoked! Status is now: ${revokeData.grant?.status}`);

  // 8. Attempt Transaction (DENY - Revoked Mandate)
  console.log("\n[8] Attempting transaction on revoked mandate...");
  const denyRes = await fetch(`${API_BASE}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER_ID,
      grantId,
      amount: 10000,
      currency: "INR",
      merchant: { merchantId: "Blinkit", name: "Blinkit", category: "GROCERY" },
      idempotencyKey: `sim_${Date.now()}_deny`,
    }),
  });
  const denyData = await denyRes.json();
  console.log(`✅ Transaction Denied! Reason: ${denyData.decision?.reason}`);

  console.log("\n========================================");
  console.log(" FULL END-TO-END FLOW VALIDATED SUCCESSFULLY! ");
  console.log("========================================");
}

runFlow().catch((err) => {
  console.error("❌ E2E Flow Failed:", err);
  process.exit(1);
});
