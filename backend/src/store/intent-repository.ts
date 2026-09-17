import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";
import type { Intent } from "../models/intent.js";

export class IntentRepository {
  /**
   * Create an intent.
   *
   * intentId is unique, so an existing intent cannot
   * silently be overwritten.
   */
  async createIntent(
    intent: Intent
  ): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          PK: `INTENT#${intent.intentId}`,
          SK: "META",

          entityType: "INTENT",

          ...intent,
        },

        ConditionExpression:
          "attribute_not_exists(PK)",
      })
    );
  }

  /**
   * Retrieve an intent by ID.
   */
  async getIntent(
    intentId: string
  ): Promise<Intent | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `INTENT#${intentId}`,
          SK: "META",
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as Intent;
  }

  /**
   * Atomically change intent status.
   *
   * This prevents invalid state transitions caused
   * by concurrent requests.
   */
  async updateStatus(
    intentId: string,
    status: Intent["status"]
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `INTENT#${intentId}`,
          SK: "META",
        },

        UpdateExpression:
          "SET #status = :status",

        ExpressionAttributeNames: {
          "#status": "status",
        },

        ExpressionAttributeValues: {
          ":status": status,
        },

        ConditionExpression:
          "attribute_exists(PK)",
      })
    );
  }

  /**
   * Check whether an idempotency key has already
   * been used.
   *
   * We store it independently so the same payment
   * cannot be submitted under a different intent ID.
   */
  async getByIdempotencyKey(
    idempotencyKey: string
  ): Promise<Intent | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `IDEMPOTENCY#${idempotencyKey}`,
          SK: "INTENT",
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as Intent;
  }

  /**
   * Register an idempotency key.
   *
   * This must be called with a conditional write.
   */
  async registerIdempotencyKey(
    intent: Intent
  ): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          PK: `IDEMPOTENCY#${intent.idempotencyKey}`,
          SK: "INTENT",

          entityType: "IDEMPOTENCY",

          intentId: intent.intentId,
          userId: intent.userId,

          createdAt: intent.createdAt,
        },

        ConditionExpression:
          "attribute_not_exists(PK)",
      })
    );
  }
}

export const intentRepository =
  new IntentRepository();
