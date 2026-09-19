import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  type ScanCommandOutput,
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
    status: Intent["status"],
    expectedStatus?: Intent["status"]
  ): Promise<void> {
    let conditionExpression = "attribute_exists(PK)";
    const expressionAttributeValues: Record<string, unknown> = {
      ":status": status,
    };

    if (expectedStatus) {
      conditionExpression += " AND #status = :expectedStatus";
      expressionAttributeValues[":expectedStatus"] = expectedStatus;
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `INTENT#${intentId}`,
          SK: "META",
        },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: conditionExpression,
      })
    );
  }

  /**
   * Update intent with decision metadata and status atomically.
   */
  async updateDecision(
    intentId: string,
    updates: {
      status: Intent["status"];
      reason?: string;
      reasonCode?: string;
      blockedItem?: string;
      blockedCategory?: string;
      matchedPolicy?: string;
      providerStatus?: "NOT_INVOKED" | "INVOKED" | "SKIPPED";
    },
    expectedStatus?: Intent["status"]
  ): Promise<void> {
    let conditionExpression = "attribute_exists(PK)";
    const expressionAttributeValues: Record<string, unknown> = {
      ":status": updates.status,
    };
    const expressionAttributeNames: Record<string, string> = {
      "#status": "status",
    };
    const setClauses: string[] = ["#status = :status"];

    if (updates.reason !== undefined) {
      setClauses.push("#reason = :reason");
      expressionAttributeNames["#reason"] = "reason";
      expressionAttributeValues[":reason"] = updates.reason;
    }
    if (updates.reasonCode !== undefined) {
      setClauses.push("#reasonCode = :reasonCode");
      expressionAttributeNames["#reasonCode"] = "reasonCode";
      expressionAttributeValues[":reasonCode"] = updates.reasonCode;
    }
    if (updates.blockedItem !== undefined) {
      setClauses.push("#blockedItem = :blockedItem");
      expressionAttributeNames["#blockedItem"] = "blockedItem";
      expressionAttributeValues[":blockedItem"] = updates.blockedItem;
    }
    if (updates.blockedCategory !== undefined) {
      setClauses.push("#blockedCategory = :blockedCategory");
      expressionAttributeNames["#blockedCategory"] = "blockedCategory";
      expressionAttributeValues[":blockedCategory"] = updates.blockedCategory;
    }
    if (updates.matchedPolicy !== undefined) {
      setClauses.push("#matchedPolicy = :matchedPolicy");
      expressionAttributeNames["#matchedPolicy"] = "matchedPolicy";
      expressionAttributeValues[":matchedPolicy"] = updates.matchedPolicy;
    }
    if (updates.providerStatus !== undefined) {
      setClauses.push("#providerStatus = :providerStatus");
      expressionAttributeNames["#providerStatus"] = "providerStatus";
      expressionAttributeValues[":providerStatus"] = updates.providerStatus;
    }

    if (expectedStatus) {
      conditionExpression += " AND #status = :expectedStatus";
      expressionAttributeValues[":expectedStatus"] = expectedStatus;
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `INTENT#${intentId}`,
          SK: "META",
        },
        UpdateExpression: `SET ${setClauses.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: conditionExpression,
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

  /**
   * List all intents for a user.
   * Paginates through all DynamoDB pages using LastEvaluatedKey.
   */
  async listUserIntents(userId: string): Promise<Intent[]> {
    const allItems: Intent[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const result: ScanCommandOutput = await dynamo.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: "userId = :userId AND entityType = :entityType",
          ExpressionAttributeValues: {
            ":userId": userId,
            ":entityType": "INTENT",
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      if (result.Items && result.Items.length > 0) {
        allItems.push(...(result.Items as Intent[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Sort descending by createdAt
    return allItems.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export const intentRepository =
  new IntentRepository();
