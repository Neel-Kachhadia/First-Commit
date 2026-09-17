/**
 * KavachPay — Payment Service
 *
 * Orchestrates payment creation and status transitions.
 *
 * This service:
 *   - Assumes the intent is already RESERVED (Authority Engine has decided ALLOW)
 *   - Creates a Razorpay order
 *   - Persists the payment record to DynamoDB
 *   - Updates intent status via intentRepository (existing method)
 *
 * This service does NOT:
 *   - Evaluate authorization (that is the Authority Engine's job)
 *   - Modify grants, reservations, or authority paths
 *   - Touch engine/, store/reservation-repository.ts, or authority-engine.ts
 *
 * DynamoDB key pattern for payment records:
 *   PK: PAYMENT#<intentId>
 *   SK: META
 */

import { randomUUID } from "crypto";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { intentRepository } from "../store/intent-repository.js";
import { getRazorpayAdapter } from "./razorpay-adapter.js";
import type { IPaymentService, PaymentRecord, PaymentResult, PaymentStatus } from "./types.js";

export class PaymentService implements IPaymentService {
  /**
   * Execute a payment for a RESERVED intent.
   *
   * Flow:
   *   1. Load intent from DynamoDB
   *   2. Validate status is RESERVED
   *   3. Create Razorpay order
   *   4. Persist payment record (PAYMENT_CREATED)
   *   5. Update intent status → PAYMENT_CREATED
   *   6. Return PaymentResult
   *
   * @param intentId The KavachPay intent ID
   */
  async execute(intentId: string): Promise<PaymentResult> {
    // 1. Load the intent
    const intent = await intentRepository.getIntent(intentId);

    if (!intent) {
      throw new Error(
        `PaymentService.execute: Intent ${intentId} not found.`
      );
    }

    // 2. Only RESERVED intents can be executed.
    //    The Authority Engine is responsible for reaching this state.
    if (intent.status !== "RESERVED") {
      throw new Error(
        `PaymentService.execute: Intent ${intentId} cannot be executed because ` +
          `its current status is "${intent.status}". Expected "RESERVED".`
      );
    }

    const adapter = getRazorpayAdapter();
    const now = new Date().toISOString();

    // 3. Create the Razorpay order
    let razorpayOrderId: string;

    try {
      const order = await adapter.createPayment({
        intentId,
        amount: intent.amount,
        currency: intent.currency,
        receipt: `kpay_${intentId.substring(0, 16)}`,
      });

      razorpayOrderId = order.id;
    } catch (error) {
      console.error(
        `[PaymentService] Razorpay order creation failed for intent ${intentId}:`,
        error
      );

      // Mark intent as FAILED
      await intentRepository.updateStatus(intentId, "FAILED");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Razorpay order creation failed",
      };
    }

    // 4. Persist the payment record
    const paymentRecord: PaymentRecord = {
      intentId,
      userId: intent.userId,
      amount: intent.amount,
      currency: intent.currency,
      razorpayOrderId,
      status: "PAYMENT_CREATED",
      createdAt: now,
      updatedAt: now,
    };

    await this.createPaymentRecord(paymentRecord);

    // 5. Update intent status → PAYMENT_CREATED
    //    Uses the existing intentRepository.updateStatus() method.
    await intentRepository.updateStatus(intentId, "RESERVED");
    // Note: We keep intent at RESERVED here; it transitions to EXECUTED/FAILED
    // only when the Razorpay webhook arrives. This matches the state machine:
    //   RESERVED → PAYMENT_CREATED (payment record) → EXECUTED/FAILED (webhook)
    // The intent status update to EXECUTED/FAILED is done by WebhookService.

    console.log(
      `[PaymentService] Payment created for intent ${intentId}. ` +
        `Razorpay order: ${razorpayOrderId}`
    );

    return {
      success: true,
      razorpayOrderId,
    };
  }

  /**
   * Retrieve a stored payment record by intent ID.
   */
  async getPaymentRecord(intentId: string): Promise<PaymentRecord | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PAYMENT#${intentId}`,
          SK: "META",
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as PaymentRecord;
  }

  /**
   * Update a payment record's status and optionally set the
   * Razorpay payment ID (available only after capture).
   */
  async updatePaymentStatus(
    intentId: string,
    status: PaymentStatus,
    razorpayPaymentId?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const updateExpression = razorpayPaymentId
      ? "SET #status = :status, razorpayPaymentId = :paymentId, updatedAt = :updatedAt"
      : "SET #status = :status, updatedAt = :updatedAt";

    const expressionValues: Record<string, unknown> = {
      ":status": status,
      ":updatedAt": now,
    };

    if (razorpayPaymentId) {
      expressionValues[":paymentId"] = razorpayPaymentId;
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PAYMENT#${intentId}`,
          SK: "META",
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: expressionValues,
        ConditionExpression: "attribute_exists(PK)",
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async createPaymentRecord(
    record: PaymentRecord
  ): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `PAYMENT#${record.intentId}`,
          SK: "META",
          entityType: "PAYMENT",
          ...record,
        },
        // Prevent overwriting an existing payment record for this intent.
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }
}

export const paymentService = new PaymentService();
