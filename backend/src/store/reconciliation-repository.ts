import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";

export interface ReconciliationRecord {
  intentId: string;
  decisionId?: string;
  paymentId?: string;
  originalReceiptHash?: string;
  previousPaymentState: string;
  newPaymentState: string;
  razorpayOrderId?: string;
  razorpayObservedState: string;
  reconciliationTimestamp: string;
  reconciliationReason: string;
  
  /**
   * If a new receipt was generated during reconciliation,
   * we store the ID or hash here to maintain the audit trail.
   */
  reconciliationReceiptId?: string;
}

export class ReconciliationRepository {
  /**
   * Log a reconciliation event to DynamoDB.
   *
   * PK: PAYMENT#<intentId>
   * SK: RECONCILIATION#<timestamp>
   */
  async createReconciliationEvent(record: ReconciliationRecord): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `PAYMENT#${record.intentId}`,
          SK: `RECONCILIATION#${record.reconciliationTimestamp}`,
          entityType: "RECONCILIATION_EVENT",
          ...record,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }
}

export const reconciliationRepository = new ReconciliationRepository();
