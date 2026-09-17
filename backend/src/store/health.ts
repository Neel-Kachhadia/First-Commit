import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { TABLE_NAME } from "./table";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

export async function checkDynamoDB() {
  const result = await client.send(
    new DescribeTableCommand({
      TableName: TABLE_NAME,
    })
  );

  return {
    tableName: result.Table?.TableName,
    status: result.Table?.TableStatus,
  };
}
