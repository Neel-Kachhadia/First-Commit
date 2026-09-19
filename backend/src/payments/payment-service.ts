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
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { intentRepository } from "../store/intent-repository.js";
import { reservationRepository } from "../store/reservation-repository.js";
import { getRazorpayAdapter } from "./razorpay-adapter.js";
import type {
  IPaymentService,
  PaymentRecord,
  PaymentResult,
  PaymentStatus,
  PaymentLockStatus,
  PaymentExecutionLock,
} from "./types.js";

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
    // 1. Idempotency pre-check
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

    // 2. Load the intent and validate BEFORE acquiring lock
    const intent = await intentRepository.getIntent(intentId);

    if (!intent) {
      throw new Error(
        `PaymentService.execute: Intent ${intentId} not found.`
      );
    }

    if (intent.status !== "RESERVED") {
      throw new Error(
        `PaymentService.execute: Intent ${intentId} cannot be executed because ` +
          `its current status is "${intent.status}". Expected "RESERVED".`
      );
    }

    // 3. Acquire lock
    const lockAcquired = await this.acquireExecutionLock(intentId);

    if (!lockAcquired) {
      const lock = await this.getExecutionLock(intentId);
      
      // Handle stale locks
      if (lock && lock.status === "CREATING") {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        if (lock.updatedAt < fiveMinutesAgo) {
          console.warn(`[PaymentService] Lock for intent ${intentId} is stale. Failing lock and releasing reservation.`);
          await this.updateExecutionLock(intentId, "FAILED");
          await reservationRepository.release(intentId);
          await intentRepository.updateStatus(intentId, "FAILED");
          return {
            success: false,
            error: "Previous payment execution timed out. Reservation released.",
          };
        }
      }

      // Check if it was successfully completed in the meantime
      const canonical = await this.getPaymentRecord(intentId);
      if (canonical) {
        return {
          success: true,
          razorpayOrderId: canonical.razorpayOrderId,
          razorpayPaymentId: canonical.razorpayPaymentId,
        };
      }

      throw new Error(
        `PaymentService.execute: Payment execution already in progress for intent ${intentId}.`
      );
    }

    // 4. We hold the lock. Create Razorpay order and payment record.
    const adapter = getRazorpayAdapter();
    const now = new Date().toISOString();
    let razorpayOrderId: string;

    try {
      const order = await adapter.createPayment({
        intentId,
        amount: intent.amount,
        currency: intent.currency,
        receipt: `kpay_${intentId.substring(0, 16)}`,
      });

      razorpayOrderId = order.id;

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
        await this.updateExecutionLock(intentId, "COMPLETED");
      } catch (err: unknown) {
        const isConditionalFail =
          err instanceof Error &&
          err.name === "ConditionalCheckFailedException";

        if (isConditionalFail) {
          console.log(
            `[PaymentService] Race condition detected for intent ${intentId}. Retrieving canonical payment record.`
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

    } catch (error: unknown) {
      console.error(`[PaymentService] Execution failed for intent ${intentId}:`, error);

      // Explicit failure handling
      await this.updateExecutionLock(intentId, "FAILED");
      await reservationRepository.release(intentId);
      await intentRepository.updateStatus(intentId, "FAILED");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Razorpay order creation failed",
      };
    }

    console.log(
      `[PaymentService] Payment created for intent ${intentId}. Razorpay order: ${razorpayOrderId}`
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
    razorpayPaymentId?: string,
    expectedStatus?: PaymentStatus,
    providerWebhookEventId?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const updates = [
      "#status = :status",
      "updatedAt = :updatedAt",
    ];

    const expressionValues: Record<string, unknown> = {
      ":status": status,
      ":updatedAt": now,
    };

    const expressionAttributeNames: Record<string, string> = {
      "#status": "status",
    };

    if (razorpayPaymentId) {
      updates.push("razorpayPaymentId = :paymentId");
      expressionValues[":paymentId"] = razorpayPaymentId;
    }

    if (providerWebhookEventId) {
      updates.push("providerWebhookEventId = :webhookEventId");
      expressionValues[":webhookEventId"] = providerWebhookEventId;
    }

    const updateExpression = `SET ${updates.join(", ")}`;

    let conditionExpression = "attribute_exists(PK)";

    if (expectedStatus) {
      conditionExpression += " AND #status = :expectedStatus";
      expressionValues[":expectedStatus"] = expectedStatus;
    }

    if (razorpayPaymentId) {
      conditionExpression += " AND (attribute_not_exists(razorpayPaymentId) OR razorpayPaymentId = :paymentId)";
    }

    if (providerWebhookEventId) {
      conditionExpression +=
        " AND (attribute_not_exists(providerWebhookEventId) OR providerWebhookEventId = :webhookEventId)";
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PAYMENT#${intentId}`,
          SK: "META",
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionValues,
        ConditionExpression: conditionExpression,
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getExecutionLock(intentId: string): Promise<PaymentExecutionLock | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PAYMENT#${intentId}`,
          SK: "LOCK",
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as PaymentExecutionLock;
  }

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

  private async acquireExecutionLock(
    intentId: string
  ): Promise<boolean> {
    const now = new Date().toISOString();

    const lock: PaymentExecutionLock = {
      intentId,
      status: "CREATING",
      createdAt: now,
      updatedAt: now,
    };

    try {
      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `PAYMENT#${intentId}`,
            SK: "LOCK",
            entityType: "PAYMENT_LOCK",
            ...lock,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        })
      );

      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      ) {
        return false;
      }

      throw error;
    }
  }

  private async updateExecutionLock(
    intentId: string,
    status: PaymentLockStatus
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PAYMENT#${intentId}`,
          SK: "LOCK",
        },
        UpdateExpression:
          "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(PK)",
      })
    );
  }

  /**
   * Find payments that are stuck in a non-terminal state (e.g. PAYMENT_CREATED).
   * 
   * Uses the entityType-status-index GSI if available, gracefully falling back
   * to a full table Scan if the index is not yet provisioned.
   */
  async findStuckPayments(): Promise<PaymentRecord[]> {
    try {
      // 1. Try querying via the GSI
      const result = await dynamo.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "entityType-status-index",
          KeyConditionExpression: "entityType = :et AND #status = :st",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":et": "PAYMENT",
            ":st": "PAYMENT_CREATED",
          },
        })
      );
      
      return (result.Items || []) as PaymentRecord[];
    } catch (error: any) {
      // If the index doesn't exist or isn't active, ValidationException is thrown
      if (error.name === "ValidationException") {
        console.warn("[PaymentService] GSI entityType-status-index not available. Falling back to Scan.");
        
        const result = await dynamo.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "entityType = :et AND #status = :st",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":et": "PAYMENT",
              ":st": "PAYMENT_CREATED",
            },
          })
        );
        
        return (result.Items || []) as PaymentRecord[];
      }
      
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
