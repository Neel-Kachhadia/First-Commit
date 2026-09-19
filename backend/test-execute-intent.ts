import { randomUUID, createHmac } from "crypto";

const API_BASE = "https://lemeuc0zs0.execute-api.ap-south-1.amazonaws.com/dev";
const INTENT_ID = "i_aff7e593-fc30-415d-86ed-d7f95ebd3400"; // Based on earlier logs

async function run() {
  console.log("Executing intent...", INTENT_ID);
  
  const execRes = await fetch(`${API_BASE}/api/execute-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intentId: INTENT_ID, userId: "c1c39d4a-50c1-70e7-eaed-1e33baa2f9a6" }),
  });
  const execData = await execRes.json();
  
  if (!execData.success) {
    console.error("Execution failed:", execData);
    return;
  }
  
  const rzpOrderId = execData.order_id;
  console.log(`✅ Payment Executed! Order ID: ${rzpOrderId}`);
  
  console.log("\nSimulating Razorpay webhook (order.paid)...");
  const eventId = `ev_${randomUUID()}`;
  
  const webhookPayload = {
    entity: "event",
    account_id: "acc_test",
    event: "order.paid",
    contains: ["payment", "order"],
    payload: {
      payment: { entity: { id: `pay_${randomUUID()}`, amount: 100000, status: "captured", notes: { intentId: INTENT_ID } } },
      order: { entity: { id: rzpOrderId, amount: 100000, receipt: INTENT_ID, status: "paid", notes: { intentId: INTENT_ID } } }
    },
    created_at: Math.floor(Date.now() / 1000)
  };

  const rawBody = JSON.stringify(webhookPayload);
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
  console.log(`✅ Webhook processed! Response:`, webhookData);
}

run().catch(console.error);
