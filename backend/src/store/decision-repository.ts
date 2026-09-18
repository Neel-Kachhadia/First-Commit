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
   * Get all decisions for an intent, sorted chronologically.
   */
  async getDecisionsForIntent(
    intentId: string
  ): Promise<Decision[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        KeyConditionExpression:
          "PK = :pk AND begins_with(SK, :prefix)",

        ExpressionAttributeValues: {
          ":pk": `INTENT#${intentId}`,
          ":prefix": "DECISION#",
        },

        ScanIndexForward: true,
      })
    );

    const decisions =
      (result.Items ?? []) as Decision[];

    decisions.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

    return decisions;
  }

  /**
   * Store a cryptographically authenticated decision receipt.
   *
   * The receipt contains:
   *  - receiptHash: SHA-256 of the canonical decision payload
   *  - signature:   HMAC-SHA256 of the receiptHash
   *  - algorithm:   "HMAC-SHA256"
   *  - signedAt:    ISO timestamp of when the receipt was signed
   *  - authorityPath, stateBefore, stateAfter: optional enrichment
   */
  async createReceipt(
    decision: Decision,
    receiptHash: string,
    auth: {
      signature: string;
      algorithm: string;
      keyId?: string;
      signedAt: string;
      authorityPath?: string[];
      stateBefore?: Record<string, number>;
      stateAfter?: Record<string, number>;
    }
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
          userId: decision.userId,
          grantId: decision.grantId,

          decision: decision.decision,
          reasonCode: decision.reasonCode,

          amount: decision.amount,
          currency: decision.currency,
          effectiveCapacity: decision.effectiveCapacity,
          grantResidual: decision.grantResidual,
          reserved: decision.reserved,

          receiptHash,
          signature: auth.signature,
          algorithm: auth.algorithm,
          keyId: auth.keyId,
          signedAt: auth.signedAt,

          ...(auth.authorityPath && { authorityPath: auth.authorityPath }),
          ...(auth.stateBefore && { stateBefore: auth.stateBefore }),
          ...(auth.stateAfter && { stateAfter: auth.stateAfter }),

          createdAt: decision.createdAt,
        },

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }

  /**
   * Retrieve the stored receipt for a decision.
   */
  async getReceipt(
    intentId: string,
    decisionId: string
  ): Promise<{
    decisionId: string;
    intentId: string;
    receiptHash: string;
    signature: string;
    algorithm: string;
    signedAt: string;
    authorityPath?: string[];
    stateBefore?: Record<string, number>;
    stateAfter?: Record<string, number>;
    createdAt: string;
  } | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `INTENT#${intentId}`,
          SK: `RECEIPT#${decisionId}`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as any;
  }
}

export const decisionRepository =
  new DecisionRepository();
