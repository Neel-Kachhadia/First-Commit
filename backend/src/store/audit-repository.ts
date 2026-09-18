import {
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";

export type AuditEventType =
  | "GRANT_CREATED"
  | "GRANT_REVOKED"
  | "GRANT_EXPIRED"
  | "INTENT_CREATED"
  | "DECISION_MADE"
  | "RESERVATION_CREATED"
  | "RESERVATION_RELEASED"
  | "PAYMENT_CREATED"
  | "PAYMENT_EXECUTED"
  | "PAYMENT_FAILED"
  | "DEMO_RESET"
  | "DEMO_SCENARIO_RUN";

export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  userId: string;
  timestamp: string;
  actor?: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

export class AuditRepository {
  /**
   * Write an immutable audit event.
   *
   * Key pattern: PK = AUDIT#<userId>, SK = <timestamp>#<eventId>
   * Monotonic SK ensures events are listed in chronological order.
   */
  async logEvent(
    userId: string,
    eventType: AuditEventType,
    metadata?: Record<string, unknown>,
    actor?: string,
    target?: string
  ): Promise<AuditEvent> {
    const eventId = `evt_${randomUUID()}`;
    const timestamp = new Date().toISOString();

    const event: AuditEvent = {
      eventId,
      eventType,
      userId,
      timestamp,
      ...(actor && { actor }),
      ...(target && { target }),
      ...(metadata && { metadata }),
    };

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,

        Item: {
          PK: `AUDIT#${userId}`,
          SK: `${timestamp}#${eventId}`,

          entityType: "AUDIT_EVENT",

          ...event,
        },

        // Audit records are immutable — reject overwrites
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    return event;
  }

  /**
   * List recent audit events for a user, newest first.
   */
  async listEvents(
    userId: string,
    limit = 50
  ): Promise<AuditEvent[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        KeyConditionExpression:
          "PK = :pk",

        ExpressionAttributeValues: {
          ":pk": `AUDIT#${userId}`,
        },

        ScanIndexForward: false, // newest first

        Limit: limit,
      })
    );

    return (result.Items ?? []) as AuditEvent[];
  }
}

export const auditRepository = new AuditRepository();
