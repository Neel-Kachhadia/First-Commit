/**
 * KavachPay — Webhook Service
 *
 * Handles incoming Razorpay webhook events.
 *
 * Responsibilities:
 *   1. Signature verification — reject invalid HMAC-SHA256 signatures
 *   2. Idempotency — skip events already processed using x-razorpay-event-id
 *   3. State transitions:
 *        payment.captured → intent EXECUTED + payment EXECUTED
 *        payment.failed   → intent FAILED   + payment FAILED
 *        order.paid       → intent EXECUTED + payment EXECUTED
 *   4. Event logging in DynamoDB (PK: WEBHOOK#<eventId>, SK: META)
 *
 * This service does NOT:
 *   - Make authorization decisions
 *   - Modify grants, reservations, or authority paths
 *   - Touch engine/, store/reservation-repository.ts, or authority-engine.ts
 *
 * Idempotency key strategy:
 *   Primary: x-razorpay-event-id (Razorpay's unique event identifier)
 *   Secondary metadata stored: razorpayPaymentId + eventType
 *
 * @see https://razorpay.com/docs/webhooks/validate-test/
 */

import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { intentRepository } from "../store/intent-repository.js";
import { getRazorpayAdapter } from "./razorpay-adapter.js";
import { paymentService } from "./payment-service.js";
import { reservationRepository } from "../store/reservation-repository.js";
import type {
  RazorpayWebhookPayload,
  WebhookRecord,
  WebhookResult,
} from "./types.js";

export class WebhookService {
  /**
   * Process an incoming Razorpay webhook event.
   *
   * @param rawBody   Raw request body as a string (UTF-8).
   *                  Must be the unmodified bytes — not re-serialised JSON.
   * @param signature x-razorpay-signature header value
   * @param eventId   x-razorpay-event-id header value (idempotency key)
   * @param payload   Parsed webhook JSON payload
   */
  async processWebhook(
    rawBody: string,
    signature: string,
    eventId: string,
    payload: RazorpayWebhookPayload
  ): Promise<WebhookResult> {
    // 1. Verify signature — reject requests that don't match HMAC-SHA256.
    const adapter = getRazorpayAdapter();
    const valid = adapter.verifyWebhookSignature(rawBody, signature);

    if (!valid) {
      console.warn(
        `[WebhookService] Invalid signature for event ${eventId}. ` +
          `Rejecting.`
      );
      throw new Error("Invalid Razorpay webhook signature.");
    }

    const eventType = payload.event;
    const paymentEntity = payload.payload.payment?.entity;
    const orderEntity = payload.payload.order?.entity;

    // Extract the intentId from Razorpay order notes.
    const intentId =
      paymentEntity?.notes?.intentId ??
      orderEntity?.notes?.intentId;

    const razorpayPaymentId = paymentEntity?.id;
    const razorpayOrderId =
      paymentEntity?.order_id ?? orderEntity?.id;

    const now = new Date().toISOString();

    // 2. Lifecycle & Idempotency check:
    //    NEW EVENT -> PROCESSING -> PROCESSED (or FAILED)
    //    FAILED -> retry allowed -> PROCESSING -> PROCESSED
    //    PROCESSED -> duplicate -> return { processed: false, duplicate: true }
    //    PROCESSING -> concurrent -> return { processed: false, duplicate: true }
    const existing = await this.getWebhookRecord(eventId);

    if (existing) {
      if (existing.status === "PROCESSED") {
        console.log(
          `[WebhookService] Duplicate event ${eventId} (${existing.eventType}). ` +
            `Already processed at ${existing.processedAt}. Skipping.`
        );
        return { processed: false, duplicate: true };
      }

      if (existing.status === "PROCESSING") {
        console.log(
          `[WebhookService] Concurrent event ${eventId} (${existing.eventType}) is in PROCESSING state. Skipping.`
        );
        return { processed: false, duplicate: true };
      }

      // If existing.status === "FAILED", allow retry!
      console.log(
        `[WebhookService] Retrying previously FAILED event ${eventId}. Transitioning to PROCESSING.`
      );
      await this.updateWebhookRecordStatus(eventId, "PROCESSING");
    } else {
      // 3. New event: create record with status "PROCESSING"
      try {
        await this.createWebhookRecord({
          eventId,
          eventType,
          razorpayPaymentId,
          razorpayOrderId,
          intentId,
          status: "PROCESSING",
          processedAt: now,
        });
      } catch (err: unknown) {
        const isConditionalFail =
          err instanceof Error &&
          err.name === "ConditionalCheckFailedException";

        if (isConditionalFail) {
          const raced = await this.getWebhookRecord(eventId);
          if (raced && (raced.status === "PROCESSED" || raced.status === "PROCESSING")) {
            console.log(
              `[WebhookService] Concurrent duplicate for event ${eventId} (status: ${raced.status}). Ignoring.`
            );
            return { processed: false, duplicate: true };
          }
          if (raced && raced.status === "FAILED") {
            await this.updateWebhookRecordStatus(eventId, "PROCESSING");
          } else {
            return { processed: false, duplicate: true };
          }
        } else {
          throw err;
        }
      }
    }

    // 4. Route event to the correct state transition handler.
    try {
      switch (eventType) {
        case "payment.captured":
          await this.handlePaymentCaptured(
            intentId,
            razorpayPaymentId,
            eventId,
            payload
          );
          break;

        case "order.paid":
          await this.handleOrderPaid(
            intentId,
            eventId,
            payload
          );
          break;

        case "payment.failed":
          await this.handlePaymentFailed(
            intentId,
            razorpayPaymentId,
            eventId,
            payload
          );
          break;

        default: {
          const unhandled = eventType as string;
          console.log(
            `[WebhookService] Unhandled event type "${unhandled}" ` +
              `for event ${eventId}. No state change applied.`
          );
        }
      }

      // Transition to PROCESSED on successful state transition
      await this.updateWebhookRecordStatus(eventId, "PROCESSED");
    } catch (processingError) {
      // Update webhook record to mark processing failure (allows retry)
      await this.updateWebhookRecordStatus(eventId, "FAILED");

      console.error(
        `[WebhookService] Processing failed for event ${eventId}:`,
        processingError
      );

      throw processingError;
    }

    console.log(
      `[WebhookService] Event ${eventId} (${eventType}) processed successfully.`
    );

    return { processed: true, duplicate: false };
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private async handlePaymentCaptured(
    intentId: string | undefined,
    razorpayPaymentId: string | undefined,
    eventId: string,
    payload: RazorpayWebhookPayload
  ): Promise<void> {
    if (!intentId) {
      throw new Error(`[WebhookService] payment.captured event ${eventId} has no intentId in order notes.`);
    }
    if (!razorpayPaymentId) {
      throw new Error(`[WebhookService] payment.captured event ${eventId} missing payment entity id.`);
    }

    const paymentRecord = await paymentService.getPaymentRecord(intentId);
    if (!paymentRecord) {
      throw new Error(`[WebhookService] Payment record PAYMENT#${intentId} not found. Rejecting webhook.`);
    }

    const paymentEntity = payload.payload.payment?.entity;
    if (!paymentEntity) {
      throw new Error(`[WebhookService] payment.captured missing payment entity.`);
    }

    const webhookOrderId = paymentEntity.order_id;
    if (!webhookOrderId || webhookOrderId !== paymentRecord.razorpayOrderId) {
      throw new Error(
        `[WebhookService] Razorpay order ID mismatch for intent ${intentId}. ` +
          `Expected "${paymentRecord.razorpayOrderId}", received "${webhookOrderId}". Rejecting webhook.`
      );
    }

    const webhookAmount = paymentEntity.amount;
    const expectedPaise = Math.round(paymentRecord.amount * 100);
    if (webhookAmount === undefined || webhookAmount !== expectedPaise) {
      throw new Error(
        `[WebhookService] Payment amount mismatch for intent ${intentId}. ` +
          `Expected ${expectedPaise} paise, received ${webhookAmount} paise. Rejecting webhook.`
      );
    }

    const webhookCurrency = paymentEntity.currency;
    if (
      webhookCurrency &&
      paymentRecord.currency &&
      webhookCurrency.toUpperCase() !== paymentRecord.currency.toUpperCase()
    ) {
      throw new Error(
        `[WebhookService] Payment currency mismatch for intent ${intentId}. ` +
          `Expected "${paymentRecord.currency}", received "${webhookCurrency}". Rejecting webhook.`
      );
    }

    // Pre-check intent state
    const intent = await intentRepository.getIntent(intentId);
    if (!intent) {
      throw new Error(`[WebhookService] Intent ${intentId} not found in repository. Rejecting webhook.`);
    }
    if (intent.status !== "RESERVED" && intent.status !== "EXECUTED") {
      throw new Error(
        `[WebhookService] Invalid intent status transition for ${intentId}. ` +
          `Current status is "${intent.status}". Expected "RESERVED". Rejecting webhook.`
      );
    }

    // Try transitioning intent to EXECUTED conditionally
    if (intent.status === "RESERVED") {
      try {
        await intentRepository.updateStatus(intentId, "EXECUTED", "RESERVED");
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
        console.log(`[WebhookService] Intent ${intentId} already EXECUTED or no longer RESERVED.`);
      }
    }

    // Try transitioning payment to EXECUTED conditionally
    const needsPaymentUpdate = 
      paymentRecord.status === "PAYMENT_CREATED" || 
      (paymentRecord.status === "EXECUTED" && paymentRecord.razorpayPaymentId !== razorpayPaymentId);

    if (needsPaymentUpdate) {
      try {
        await paymentService.updatePaymentStatus(
          intentId,
          "EXECUTED",
          razorpayPaymentId,
          paymentRecord.status === "PAYMENT_CREATED" ? "PAYMENT_CREATED" : "EXECUTED"
        );
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
        console.log(`[WebhookService] Payment ${intentId} status condition failed. Likely processed concurrently or payment ID conflict.`);
      }
    }

    console.log(`[WebhookService] Intent ${intentId} processed (payment ${razorpayPaymentId}).`);
  }

  private async handleOrderPaid(
    intentId: string | undefined,
    eventId: string,
    payload: RazorpayWebhookPayload
  ): Promise<void> {
    if (!intentId) {
      throw new Error(`[WebhookService] order.paid event ${eventId} has no intentId.`);
    }

    const paymentRecord = await paymentService.getPaymentRecord(intentId);
    if (!paymentRecord) {
      throw new Error(`[WebhookService] Payment record not found. Rejecting webhook.`);
    }

    const orderEntity = payload.payload.order?.entity;
    if (!orderEntity) {
      throw new Error(`[WebhookService] order.paid missing order entity.`);
    }

    const webhookOrderId = orderEntity.id;
    if (!webhookOrderId || webhookOrderId !== paymentRecord.razorpayOrderId) {
      throw new Error(`[WebhookService] Razorpay order ID mismatch.`);
    }

    const webhookAmount = orderEntity.amount;
    const expectedPaise = Math.round(paymentRecord.amount * 100);
    if (webhookAmount === undefined || webhookAmount !== expectedPaise) {
      throw new Error(`[WebhookService] Payment amount mismatch.`);
    }

    // Pre-check intent state
    const intent = await intentRepository.getIntent(intentId);
    if (!intent) {
      throw new Error(`[WebhookService] Intent ${intentId} not found in repository. Rejecting webhook.`);
    }
    if (intent.status !== "RESERVED" && intent.status !== "EXECUTED") {
      throw new Error(
        `[WebhookService] Invalid intent status transition for ${intentId}. ` +
          `Current status is "${intent.status}". Expected "RESERVED". Rejecting webhook.`
      );
    }

    // Conditionally transition intent
    if (intent.status === "RESERVED") {
      try {
        await intentRepository.updateStatus(intentId, "EXECUTED", "RESERVED");
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
        console.log(`[WebhookService] Intent ${intentId} already EXECUTED or no longer RESERVED.`);
      }
    }

    // Conditionally transition payment
    if (paymentRecord.status === "PAYMENT_CREATED") {
      try {
        await paymentService.updatePaymentStatus(intentId, "EXECUTED", undefined, "PAYMENT_CREATED");
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
        console.log(`[WebhookService] Payment ${intentId} status condition failed. Likely processed concurrently.`);
      }
    }

    console.log(`[WebhookService] Intent ${intentId} processed (order.paid).`);
  }

  private async handlePaymentFailed(
    intentId: string | undefined,
    razorpayPaymentId: string | undefined,
    eventId: string,
    payload: RazorpayWebhookPayload
  ): Promise<void> {
    if (!intentId) {
      throw new Error(`[WebhookService] payment.failed event ${eventId} has no intentId.`);
    }

    const paymentRecord = await paymentService.getPaymentRecord(intentId);
    if (!paymentRecord) {
      throw new Error(`[WebhookService] Payment record PAYMENT#${intentId} not found on payment.failed.`);
    }

    const paymentEntity = payload.payload.payment?.entity;
    if (!paymentEntity) {
      throw new Error(`[WebhookService] payment.failed missing payment entity.`);
    }

    const webhookOrderId = paymentEntity.order_id;
    if (!webhookOrderId) {
      throw new Error(`[WebhookService] payment.failed missing order ID.`);
    }
    if (webhookOrderId !== paymentRecord.razorpayOrderId) {
      throw new Error(`[WebhookService] Razorpay order ID mismatch on payment.failed.`);
    }

    const webhookAmount = paymentEntity.amount;
    if (webhookAmount !== undefined) {
      const expectedPaise = Math.round(paymentRecord.amount * 100);
      if (webhookAmount !== expectedPaise) {
        throw new Error(`[WebhookService] Payment amount mismatch on payment.failed.`);
      }
    }

    const webhookCurrency = paymentEntity.currency;
    if (
      webhookCurrency &&
      paymentRecord.currency &&
      webhookCurrency.toUpperCase() !== paymentRecord.currency.toUpperCase()
    ) {
      throw new Error(`[WebhookService] Payment currency mismatch on payment.failed.`);
    }

    // Try transitioning payment to FAILED conditionally
    if (paymentRecord.status !== "FAILED") {
      try {
        await paymentService.updatePaymentStatus(intentId, "FAILED", razorpayPaymentId, paymentRecord.status);
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
        console.log(`[WebhookService] Payment ${intentId} already FAILED or status changed concurrently.`);
      }
    }

    // Pre-check intent state
    const intent = await intentRepository.getIntent(intentId);
    if (!intent) {
      throw new Error(`[WebhookService] Intent ${intentId} not found in repository. Rejecting webhook.`);
    }
    if (intent.status !== "RESERVED" && intent.status !== "FAILED") {
      throw new Error(
        `[WebhookService] Invalid intent status transition for ${intentId}. ` +
          `Current status is "${intent.status}". Expected "RESERVED". Rejecting webhook.`
      );
    }

    // Try transitioning intent to FAILED conditionally
    if (intent.status !== "FAILED") {
      try {
        await intentRepository.updateStatus(intentId, "FAILED", intent.status);
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
        console.log(`[WebhookService] Intent ${intentId} already FAILED or status changed concurrently.`);
      }
    }

    // Release reservation unconditionally (atomic release is idempotent)
    await reservationRepository.release(intentId);

    console.log(
      `[WebhookService] Intent ${intentId} → FAILED ` +
        `(payment ${razorpayPaymentId ?? "unknown"}). Reservation released.`
    );
  }

  // ---------------------------------------------------------------------------
  // DynamoDB helpers — webhook event log
  // ---------------------------------------------------------------------------

  private async createWebhookRecord(
    record: WebhookRecord
  ): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `WEBHOOK#${record.eventId}`,
          SK: "META",
          entityType: "WEBHOOK_EVENT",
          ...record,
        },
        // Atomic idempotency guard — fails if another process already wrote it.
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  private async getWebhookRecord(
    eventId: string
  ): Promise<WebhookRecord | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `WEBHOOK#${eventId}`,
          SK: "META",
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as WebhookRecord;
  }

  private async updateWebhookRecordStatus(
    eventId: string,
    status: WebhookRecord["status"]
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `WEBHOOK#${eventId}`,
          SK: "META",
        },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": status },
        ConditionExpression: "attribute_exists(PK)",
      })
    );
  }
}

export const webhookService = new WebhookService();
