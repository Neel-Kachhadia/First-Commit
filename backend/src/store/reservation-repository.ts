import {
  GetCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";
import type { Grant } from "./grant-repository.js";

export interface Reservation {
  intentId: string;
  userId: string;
  amount: number;
  grants: Grant[];
}

export type ReservationResult =
  | "RESERVED"
  | "ALREADY_RESERVED";

export class ReservationRepository {
  /**
   * Atomically reserve an amount across the complete
   * authority path.
   *
   * Example:
   *
   * Shopping
   *   ₹4,000
   *      ↓
   * Grocery
   *   ₹2,000
   *
   * A ₹500 reservation updates BOTH grants inside
   * one DynamoDB transaction.
   */
  async reserve(
    reservation: Reservation
  ): Promise<ReservationResult> {
    if (reservation.amount <= 0) {
      throw new Error(
        "Reservation amount must be greater than zero"
      );
    }

    if (reservation.grants.length === 0) {
      throw new Error(
        "Authority path cannot be empty"
      );
    }

    /*
     * Replay protection.
     *
     * If this intent was already reserved successfully,
     * don't attempt to reserve it a second time.
     */
    const existing =
      await this.getReservation(
        reservation.intentId
      );

    if (existing) {
      if (
        existing.amount !==
          reservation.amount ||
        existing.userId !==
          reservation.userId
      ) {
        throw new Error(
          "Existing reservation does not match the current request."
        );
      }

      return "ALREADY_RESERVED";
    }

    const now =
      new Date().toISOString();

    const transactItems: NonNullable<
      TransactWriteCommandInput["TransactItems"]
    > = [];

    /*
     * Reserve the requested amount on EVERY grant
     * in the authority path.
     *
     * DynamoDB evaluates all conditions atomically.
     */
    for (const grant of reservation.grants) {
      transactItems.push({
        Update: {
          TableName: TABLE_NAME,

          Key: {
            PK: `USER#${grant.userId}`,
            SK: `GRANT#${grant.grantId}`,
          },

          UpdateExpression: `
            SET #consumed = #consumed + :amount,
                updatedAt = :updatedAt
          `,

          ConditionExpression: `
            attribute_exists(PK)
            AND #status = :active
            AND #consumed <= :maxAllowedConsumed
          `,

          ExpressionAttributeNames: {
            "#status": "status",
            "#consumed": "consumed",
          },

          ExpressionAttributeValues: {
            ":amount": reservation.amount,
            ":maxAllowedConsumed": grant.limit - reservation.amount,
            ":active": "ACTIVE",
            ":updatedAt": now,
          },
        },
      });
    }

    /*
     * Record the reservation in the SAME transaction.
     *
     * If another request has already claimed this intent,
     * attribute_not_exists(PK) fails and ALL budget updates
     * are rolled back.
     */
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,

        Item: {
          PK: `INTENT#${reservation.intentId}`,
          SK: "RESERVATION",

          entityType: "RESERVATION",

          intentId:
            reservation.intentId,

          userId:
            reservation.userId,

          amount:
            reservation.amount,

          grantIds:
            reservation.grants.map(
              (grant) => grant.grantId
            ),

          status: "RESERVED",

          createdAt: now,
        },

        ConditionExpression:
          "attribute_not_exists(PK)",
      },
    });

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        await dynamo.send(
          new TransactWriteCommand({
            TransactItems: transactItems,
          })
        );
        return "RESERVED";
      } catch (error: any) {
        const isConflict =
          error.name === "TransactionCanceledException" &&
          error.CancellationReasons?.some(
            (r: any) => r.Code === "TransactionConflict"
          );

        if (isConflict && attempt < MAX_RETRIES) {
          attempt++;
          // Exponential backoff with jitter
          const delay = Math.pow(2, attempt) * 50 + Math.random() * 50;
          console.warn(`[ReservationRepository] TransactionConflict on reserve. Retrying attempt ${attempt}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isConflict) {
          console.warn(`[ReservationRepository] KAVACHPAY RESERVATION TRANSACTION CONFLICT LIMIT REACHED.`);
        } else {
          console.error(
            "[ReservationRepository] KAVACHPAY RESERVATION TRANSACTION FAILED:",
            error.name,
            error.message
          );
        }

        throw error;
      }
    }

    return "RESERVED";
  }

  /**
   * Retrieve an existing reservation.
   */
  async getReservation(
    intentId: string
  ): Promise<{
    intentId: string;
    userId: string;
    amount: number;
    grantIds: string[];
    status: string;
    createdAt: string;
  } | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `INTENT#${intentId}`,
          SK: "RESERVATION",
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as {
      intentId: string;
      userId: string;
      amount: number;
      grantIds: string[];
      status: string;
      createdAt: string;
    };
  }

  /**
   * Atomically release a reservation, restoring authority to the grants.
   * If the reservation does not exist or is already RELEASED, this is a no-op (returns true).
   */
  async release(intentId: string): Promise<boolean> {
    const reservation = await this.getReservation(intentId);
    
    if (!reservation) {
      return true; // Nothing to release
    }

    if (reservation.status === "RELEASED") {
      return true; // Already released
    }

    if (reservation.status !== "RESERVED") {
      throw new Error(`Cannot release reservation with status ${reservation.status}`);
    }

    const now = new Date().toISOString();
    const transactItems: NonNullable<TransactWriteCommandInput["TransactItems"]> = [];

    // Compensate all grants atomically
    for (const grantId of reservation.grantIds) {
      transactItems.push({
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${reservation.userId}`,
            SK: `GRANT#${grantId}`,
          },
          UpdateExpression: `
            SET #consumed = #consumed - :amount,
                updatedAt = :updatedAt
          `,
          ConditionExpression: `
            attribute_exists(PK)
            AND #consumed >= :amount
          `,
          ExpressionAttributeNames: {
            "#consumed": "consumed",
          },
          ExpressionAttributeValues: {
            ":amount": reservation.amount,
            ":updatedAt": now,
          },
        },
      });
    }

    // Update the reservation to RELEASED atomically
    transactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: {
          PK: `INTENT#${intentId}`,
          SK: "RESERVATION",
        },
        UpdateExpression: `
          SET #status = :released
        `,
        ConditionExpression: `
          attribute_exists(PK)
          AND #status = :reserved
        `,
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":released": "RELEASED",
          ":reserved": "RESERVED",
        },
      },
    });

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        await dynamo.send(
          new TransactWriteCommand({
            TransactItems: transactItems,
          })
        );
        return true;
      } catch (error: any) {
        const isConflict =
          error.name === "TransactionCanceledException" &&
          error.CancellationReasons?.some(
            (r: any) => r.Code === "TransactionConflict"
          );

        if (isConflict && attempt < MAX_RETRIES) {
          attempt++;
          const delay = Math.pow(2, attempt) * 50 + Math.random() * 50;
          console.warn(`[ReservationRepository] TransactionConflict on release. Retrying attempt ${attempt}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (
          error.name === "TransactionCanceledException" ||
          error.name === "ConditionalCheckFailedException"
        ) {
          console.warn(`[ReservationRepository] release transaction canceled for intent ${intentId}. Possibly already released concurrently.`);
          return false;
        }

        throw error;
      }
    }

    return false;
  }
}

export const reservationRepository =
  new ReservationRepository();
