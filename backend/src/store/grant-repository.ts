import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";

export type GrantStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface Grant {
  grantId: string;
  userId: string;

  label: string;

  parentGrantId?: string;

  currency: string;
  limit: number;
  consumed: number;

  window: string;
  windowStart: string;

  hardMax?: number;
  stepUpAbove?: number;

  category?: string;

  merchantAllow?: string[];
  merchantDeny?: string[];

  delegationEnabled: boolean;
  maxDepth: number;
  maxChildren: number;

  expiresAt?: string;

  status: GrantStatus;

  evidence?: {
    sourceProtocol?: string;
    mandateRef?: string;
    signedBy?: string;
  };

  createdAt: string;
  updatedAt: string;
}

export interface GrantEdge {
  parentGrantId: string;
  childGrantId: string;

  createdAt: string;
}

function grantKey(userId: string, grantId: string) {
  return {
    PK: `USER#${userId}`,
    SK: `GRANT#${grantId}`,
  };
}

function edgeKey(parentGrantId: string, childGrantId: string) {
  return {
    PK: `GRANT#${parentGrantId}`,
    SK: `CHILD#${childGrantId}`,
  };
}

export class GrantRepository {
  async createGrant(grant: Grant): Promise<void> {
    const now = new Date().toISOString();

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          ...grantKey(grant.userId, grant.grantId),

          entityType: "GRANT",

          ...grant,

          consumed: grant.consumed ?? 0,

          createdAt: grant.createdAt ?? now,
          updatedAt: now,
        },

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }

  async getGrant(
    userId: string,
    grantId: string
  ): Promise<Grant | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: grantKey(userId, grantId),
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as Grant;
  }

  async listUserGrants(userId: string): Promise<Grant[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        KeyConditionExpression:
          "PK = :pk AND begins_with(SK, :prefix)",

        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":prefix": "GRANT#",
        },
      })
    );

    return (result.Items ?? []) as Grant[];
  }

  async createEdge(edge: GrantEdge): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          ...edgeKey(
            edge.parentGrantId,
            edge.childGrantId
          ),

          entityType: "GRANT_EDGE",

          parentGrantId: edge.parentGrantId,
          childGrantId: edge.childGrantId,

          createdAt:
            edge.createdAt ?? new Date().toISOString(),
        },

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }

  async listChildren(
    parentGrantId: string
  ): Promise<GrantEdge[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        KeyConditionExpression:
          "PK = :pk AND begins_with(SK, :prefix)",

        ExpressionAttributeValues: {
          ":pk": `GRANT#${parentGrantId}`,
          ":prefix": "CHILD#",
        },
      })
    );

    return (result.Items ?? []) as GrantEdge[];
  }

  async revokeGrant(
    userId: string,
    grantId: string
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,

        Key: grantKey(userId, grantId),

        UpdateExpression:
          "SET #status = :status, updatedAt = :updatedAt",

        ExpressionAttributeNames: {
          "#status": "status",
        },

        ExpressionAttributeValues: {
          ":status": "REVOKED",
          ":updatedAt": new Date().toISOString(),
        },

        ConditionExpression:
          "attribute_exists(PK)",
      })
    );
  }

  async consumeBudget(
    userId: string,
    grantId: string,
    amount: number
  ): Promise<void> {
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,

        Key: grantKey(userId, grantId),

        UpdateExpression:
          "SET consumed = consumed + :amount, updatedAt = :updatedAt",

        ExpressionAttributeNames: {
          "#status": "status",
          "#limit": "limit",
        },

        ExpressionAttributeValues: {
          ":amount": amount,
          ":active": "ACTIVE",
          ":updatedAt": new Date().toISOString(),
        },

        ConditionExpression: `
          attribute_exists(PK)
          AND #status = :active
          AND consumed + :amount <= #limit
        `,
      })
    );
  }
}

export const grantRepository = new GrantRepository();
