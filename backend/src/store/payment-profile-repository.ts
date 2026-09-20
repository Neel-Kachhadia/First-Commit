import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";
import { PaymentProfile } from "../models/payment-profile.js";

export class PaymentProfileRepository {
  async createProfile(profile: PaymentProfile): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${profile.userId}`,
          SK: `PAYMENT_PROFILE#${profile.paymentProfileId}`,
          ...profile,
        },
      })
    );
  }

  async getProfile(userId: string, paymentProfileId: string): Promise<PaymentProfile | null> {
    const response = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `PAYMENT_PROFILE#${paymentProfileId}`,
        },
      })
    );

    return (response.Item as PaymentProfile) || null;
  }

  async getProfilesByUser(userId: string): Promise<PaymentProfile[]> {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": "PAYMENT_PROFILE#",
        },
      })
    );

    return (response.Items as PaymentProfile[]) || [];
  }

  async disableProfile(userId: string, paymentProfileId: string, updatedAt: string): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `PAYMENT_PROFILE#${paymentProfileId}`,
        },
        UpdateExpression: "SET #st = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#st": "status",
        },
        ExpressionAttributeValues: {
          ":status": "DISABLED",
          ":updatedAt": updatedAt,
        },
      })
    );
  }
}

export const paymentProfileRepository = new PaymentProfileRepository();
