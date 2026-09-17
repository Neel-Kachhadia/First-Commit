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
    // 1. Idempotency pre-check: If a payment record already exists for this intent,
    //    do NOT create another Razorpay order. Return the canonical record.
    const existingPayment = await this.getPaymentRecord(intentId);
    if (existingPayment) {
      console.log(
        `[PaymentService] Payment record already exists for intent ${intentId}. ` +
          `Returning existing Razorpay order: ${existingPayment.razorpayOrderId}`
      );
      return {
        success: true,
        razorpayOrderId: existingPayment.razorpayOrderId,
        razorpayPaymentId: existingPayment.razorpayPaymentId,
      };
    }

    // 2. Load the intent
    const intent = await intentRepository.getIntent(intentId);

    if (!intent) {
      throw new Error(
        `PaymentService.execute: Intent ${intentId} not found.`
      );
    }

    // 3. Only RESERVED intents can be executed.
    //    The Authority Engine is responsible for reaching this state.
    if (intent.status !== "RESERVED") {
      throw new Error(
        `PaymentService.execute: Intent ${intentId} cannot be executed because ` +
          `its current status is "${intent.status}". Expected "RESERVED".`
      );
    }

    const adapter = getRazorpayAdapter();
    const now = new Date().toISOString();

    // 4. Create the Razorpay order
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

    // 5. Persist the payment record with atomic conditional guard
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

    try {
      await this.createPaymentRecord(paymentRecord);
    } catch (err: unknown) {
      const isConditionalFail =
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException";

      if (isConditionalFail) {
        // Another concurrent execution won the race to write the PAYMENT record.
        // Return the canonical existing payment/order.
        console.log(
          `[PaymentService] Race condition detected for intent ${intentId}. ` +
            `Retrieving canonical payment record.`
        );
        const canonical = await this.getPaymentRecord(intentId);
        if (canonical) {
          return {
            success: true,
            razorpayOrderId: canonical.razorpayOrderId,
            razorpayPaymentId: canonical.razorpayPaymentId,
          };
        }
      }

      throw err;
    }

    // 6. Keep intent status at RESERVED until webhook confirmation
    await intentRepository.updateStatus(intentId, "RESERVED");

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
