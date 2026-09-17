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

import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { intentRepository } from "../store/intent-repository.js";
import { getRazorpayAdapter } from "./razorpay-adapter.js";
import { paymentService } from "./payment-service.js";
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

    // 2. Idempotency check — have we already processed this eventId?
    const existing = await this.getWebhookRecord(eventId);

    if (existing) {
      console.log(
        `[WebhookService] Duplicate event ${eventId} (${existing.eventType}). ` +
          `Already processed at ${existing.processedAt}. Skipping.`
      );
      return { processed: false, duplicate: true };
    }

    const eventType = payload.event;
    const paymentEntity = payload.payload.payment?.entity;
    const orderEntity = payload.payload.order?.entity;

    // Extract the intentId from Razorpay order notes.
    // Both payment and order entities carry the notes we set in createPayment().
    const intentId =
      paymentEntity?.notes?.intentId ??
      orderEntity?.notes?.intentId;

    const razorpayPaymentId = paymentEntity?.id;
    const razorpayOrderId =
      paymentEntity?.order_id ?? orderEntity?.id;

    const now = new Date().toISOString();

    // 3. Record the event immediately (before processing) so concurrent
    //    duplicate deliveries don't race through to the state transition.
    //    We use attribute_not_exists(PK) to make this atomic.
    try {
      await this.createWebhookRecord({
        eventId,
        eventType,
        razorpayPaymentId,
        razorpayOrderId,
        intentId,
        status: "PROCESSED",
        processedAt: now,
      });
    } catch (err: unknown) {
      // Another concurrent request won the race — treat as duplicate.
      const isConditionalFail =
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException";

      if (isConditionalFail) {
        console.log(
          `[WebhookService] Concurrent duplicate for event ${eventId}. ` +
            `Ignoring.`
        );
        return { processed: false, duplicate: true };
      }

      throw err;
    }

    // 4. Route event to the correct state transition handler.
    try {
      switch (eventType) {
        case "payment.captured":
        case "order.paid":
          await this.handlePaymentCaptured(
            intentId,
            razorpayPaymentId,
            eventId,
            eventType
          );
          break;

        case "payment.failed":
          await this.handlePaymentFailed(
            intentId,
            razorpayPaymentId,
            eventId
          );
          break;

        default: {
          // Unexpected event type — log and ignore.
          const unhandled = eventType as string;
          console.log(
            `[WebhookService] Unhandled event type "${unhandled}" ` +
              `for event ${eventId}. No state change applied.`
          );
        }
      }
    } catch (processingError) {
      // Update webhook record to mark processing failure.
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
    eventType: string
  ): Promise<void> {
    if (!intentId) {
      console.warn(
        `[WebhookService] ${eventType} event ${eventId} has no intentId ` +
          `in order notes. Cannot update intent status.`
      );
      return;
    }

    // Update payment record status → EXECUTED
    await paymentService.updatePaymentStatus(
      intentId,
      "EXECUTED",
      razorpayPaymentId
    );

    // Update intent status → EXECUTED
    await intentRepository.updateStatus(intentId, "EXECUTED");

    console.log(
      `[WebhookService] Intent ${intentId} → EXECUTED ` +
        `(payment ${razorpayPaymentId ?? "unknown"}).`
    );
  }

  private async handlePaymentFailed(
    intentId: string | undefined,
    razorpayPaymentId: string | undefined,
    eventId: string
  ): Promise<void> {
    if (!intentId) {
      console.warn(
        `[WebhookService] payment.failed event ${eventId} has no intentId ` +
          `in order notes. Cannot update intent status.`
      );
      return;
    }

    // Update payment record status → FAILED
    await paymentService.updatePaymentStatus(
      intentId,
      "FAILED",
      razorpayPaymentId
    );

    // Update intent status → FAILED (existing IntentStatusSchema value)
    await intentRepository.updateStatus(intentId, "FAILED");

    console.log(
      `[WebhookService] Intent ${intentId} → FAILED ` +
        `(payment ${razorpayPaymentId ?? "unknown"}).`
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
    const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");

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
