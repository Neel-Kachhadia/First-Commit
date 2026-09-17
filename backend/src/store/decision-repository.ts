import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";
import type { Decision } from "../models/decision.js";

export class DecisionRepository {
  /**
   * Persist a decision.
   *
   * A decision ID is immutable once created.
   */
  async createDecision(
    decision: Decision
  ): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          PK: `INTENT#${decision.intentId}`,
          SK: `DECISION#${decision.decisionId}`,

          entityType: "DECISION",

          ...decision,
        },

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }

  /**
   * Retrieve a specific decision.
   */
  async getDecision(
    intentId: string,
    decisionId: string
  ): Promise<Decision | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `INTENT#${intentId}`,
          SK: `DECISION#${decisionId}`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as Decision;
  }

  /**
   * Get the most recent decision for an intent.
   *
   * Decisions use:
   *
   * PK = INTENT#<intentId>
   * SK = DECISION#<decisionId>
   *
   * decisionId currently contains a UUID, so createdAt
   * is used as the ordering attribute.
   */
  async getLatestDecision(
    intentId: string
  ): Promise<Decision | null> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        KeyConditionExpression:
          "PK = :pk AND begins_with(SK, :prefix)",

        ExpressionAttributeValues: {
          ":pk": `INTENT#${intentId}`,
          ":prefix": "DECISION#",
        },

        ScanIndexForward: false,

        Limit: 20,
      })
    );

    const decisions =
      (result.Items ?? []) as Decision[];

    if (decisions.length === 0) {
      return null;
    }

    decisions.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    return decisions[0];
  }

  /**
   * Store a deterministic decision receipt.
   *
   * This is intentionally separate from the decision itself.
   * Later the receipt will contain a cryptographic hash/signature.
   */
  async createReceipt(
    decision: Decision,
    receiptHash: string
  ): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          PK: `INTENT#${decision.intentId}`,
          SK: `RECEIPT#${decision.decisionId}`,

          entityType: "DECISION_RECEIPT",

          decisionId: decision.decisionId,
          intentId: decision.intentId,

          decision: decision.decision,
          reasonCode: decision.reasonCode,

          receiptHash,

          createdAt: decision.createdAt,
        },

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }
}

export const decisionRepository =
  new DecisionRepository();
