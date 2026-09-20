import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";
import { grantRepository, type Grant } from "./grant-repository.js";

interface StopAllState {
  grantIds: string[];
  stoppedAt: string;
}

const controlKey = (userId: string) => ({ PK: `USER#${userId}`, SK: "CONTROL#STOP_ALL" });
const grantKey = (userId: string, grantId: string) => ({ PK: `USER#${userId}`, SK: `GRANT#${grantId}` });

export class StopAllRepository {
  async getState(userId: string): Promise<StopAllState | null> {
    const result = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: controlKey(userId) }));
    if (!result.Item || !Array.isArray(result.Item.grantIds)) return null;
    return {
      grantIds: result.Item.grantIds.filter((id: unknown): id is string => typeof id === "string"),
      stoppedAt: String(result.Item.stoppedAt ?? ""),
    };
  }

  async stop(userId: string): Promise<number> {
    if (await this.getState(userId)) throw new Error("Authority is already stopped.");
    const grants = await grantRepository.listUserGrants(userId);
    const active = grants.filter((grant) => grant.status === "ACTIVE");
    if (active.length === 0) return 0;
    if (active.length > 99) throw new Error("Too many grants to stop in one operation.");

    const now = new Date().toISOString();
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        ...active.map((grant) => ({
          Update: {
            TableName: TABLE_NAME,
            Key: grantKey(userId, grant.grantId),
            UpdateExpression: "SET #status = :revoked, updatedAt = :now",
            ConditionExpression: "#status = :active",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":revoked": "REVOKED", ":active": "ACTIVE", ":now": now },
          },
        })),
        {
          Put: {
            TableName: TABLE_NAME,
            Item: { ...controlKey(userId), entityType: "STOP_ALL", grantIds: active.map((grant) => grant.grantId), stoppedAt: now },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    }));
    return active.length;
  }

  async restore(userId: string): Promise<{ restored: number; skipped: number }> {
    const state = await this.getState(userId);
    if (!state) return { restored: 0, skipped: 0 };
    const grants = await Promise.all(state.grantIds.map((id) => grantRepository.getGrant(userId, id)));
    const restorable = grants.filter((grant): grant is Grant => grant?.status === "REVOKED" &&
      (!grant.expiresAt || Date.now() < new Date(grant.expiresAt).getTime()));
    if (restorable.length > 99) throw new Error("Too many grants to restore in one operation.");

    const now = new Date().toISOString();
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        ...restorable.map((grant) => ({
          Update: {
            TableName: TABLE_NAME,
            Key: grantKey(userId, grant.grantId),
            UpdateExpression: "SET #status = :active, updatedAt = :now",
            ConditionExpression: "#status = :revoked",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":active": "ACTIVE", ":revoked": "REVOKED", ":now": now },
          },
        })),
        { Delete: { TableName: TABLE_NAME, Key: controlKey(userId), ConditionExpression: "attribute_exists(PK)" } },
      ],
    }));
    return { restored: restorable.length, skipped: state.grantIds.length - restorable.length };
  }
}

export const stopAllRepository = new StopAllRepository();
