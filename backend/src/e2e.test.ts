import { describe, it, expect } from "vitest";
import { randomUUID, createHmac } from "crypto";
import { ap2Adapter } from "./adapters/ap2-adapter.js";
import { grantService } from "./services/grant-service.js";
import { intentService } from "./services/intent-service.js";
import { paymentService } from "./payments/payment-service.js";
import { WebhookService } from "./payments/webhook-service.js";
import { grantRepository } from "./store/grant-repository.js";
import { intentRepository } from "./store/intent-repository.js";

// Load env vars
import { config } from "dotenv";
config();

describe("End-to-End Production Lifecycle", () => {
  it("executes the complete money-control flow", async () => {
    const userId = `u_${randomUUID()}`;
    const intentId = `i_${randomUUID()}`;
    const amount = 2000;
    
    console.log("--------------------------------------------------");
    console.log("1. Creating AP2 Mandate");
    const mandate = {
      mandate_id: `ap2_${randomUUID()}`,
      agent_id: "test-agent",
      principal_id: userId,
      limits: {
        total_budget: 10000,
        transaction_maximum: 5000,
        currency: "INR",
      },
      rules: {
        allowed_merchants: ["Blinkit"],
        allowed_categories: ["GROCERY"],
      },
      validity: {
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    console.log("AP2 mandate response:", JSON.stringify(mandate, null, 2));

    const grantInput = ap2Adapter.normalizeMandate(mandate, "E2E Test Mandate");
    const grant = await grantService.createGrant(grantInput);
    
    console.log("Grant ID:", grant.grantId);

    // 2. Inspect grant
    expect(grant.grantId).toBeDefined();
    expect(grant.limit).toBe(10000);
    expect(grant.merchantAllow).toContain("Blinkit");
    expect(grant.evidence?.sourceProtocol).toBe("AP2");
    
    // Check initial exposure
    expect(grant.consumed).toBe(0);
    console.log("Exposure before:", grant.consumed);

    // 3. Create Intent and Authorize
    console.log("3. Creating Intent:", intentId);
    console.log("Intent ID:", intentId);
    const intentRes = await intentService.createIntent({
      intentId,
      userId,
      grantId: grant.grantId,
      amount,
      currency: "INR",
      merchant: {
        merchantId: "Blinkit",
        name: "Blinkit",
        category: "GROCERY"
      },
      description: "Grocery purchase",
      idempotencyKey: `idem_${randomUUID()}`,
    });

    console.log("Authorization decision:", intentRes.decision.decision);
    expect(intentRes.decision.decision).toBe("ALLOW");
    
    const dbIntent = await intentRepository.getIntent(intentId);
    expect(dbIntent?.status).toBe("RESERVED");
    console.log("Reservation amount:", amount);

    // 5. Exposure (Increases by reserved amount)
    const afterResGrant = await grantRepository.getGrant(userId, grant.grantId);
    expect(afterResGrant?.consumed).toBe(amount);

    // 6. Execute payment -> Razorpay test order created
    console.log("6. Executing payment via Razorpay sandbox");
    const paymentResult = await paymentService.execute(intentId);
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.razorpayOrderId).toBeDefined();
    console.log("Razorpay order ID:", paymentResult.razorpayOrderId);

    // 7. Payment record
    const pRecord = await paymentService.getPaymentRecord(intentId);
    expect(pRecord).toBeDefined();
    expect(pRecord?.razorpayOrderId).toBe(paymentResult.razorpayOrderId);
    expect(pRecord?.status).toBe("PAYMENT_CREATED");
    console.log("Payment record:", JSON.stringify(pRecord, null, 2));

    // 8. Webhook validation
    const eventId = `evt_${randomUUID()}`;
    console.log("Webhook event ID:", eventId);
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_${randomUUID()}`,
            order_id: paymentResult.razorpayOrderId!,
            amount: amount * 100, // paise
            currency: "INR",
            status: "captured",
            notes: {
              intentId,
              kavachpay: "true"
            }
          }
        }
      }
    };
    
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "whsec_test_secret_placeholder";
    const rawBody = JSON.stringify(payload);
    const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    
    const webhookService = new WebhookService();
    const whResult = await webhookService.processWebhook(rawBody, signature, eventId, payload as any);
    
    expect(whResult.processed).toBe(true);
    expect(whResult.duplicate).toBe(false);

    // 9. Settlement
    const finalIntent = await intentRepository.getIntent(intentId);
    expect(finalIntent?.status).toBe("EXECUTED");
    console.log("Final intent status:", finalIntent?.status);
    
    const finalPayment = await paymentService.getPaymentRecord(intentId);
    expect(finalPayment?.status).toBe("EXECUTED");
    console.log("Final payment status:", finalPayment?.status);
    
    const finalGrant = await grantRepository.getGrant(userId, grant.grantId);
    expect(finalGrant?.consumed).toBe(amount);
    console.log("Exposure after:", finalGrant?.consumed);

    // 10. Replay same webhook
    const whResult2 = await webhookService.processWebhook(rawBody, signature, eventId, payload as any);
    expect(whResult2.processed).toBe(false);
    expect(whResult2.duplicate).toBe(true);
    console.log("Duplicate webhook result:", JSON.stringify(whResult2, null, 2));
    
    const doubleGrant = await grantRepository.getGrant(userId, grant.grantId);
    expect(doubleGrant?.consumed).toBe(amount);
    console.log("--------------------------------------------------");
  }, 10000); // give it 10 seconds timeout due to network call
});
