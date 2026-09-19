import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const ddb = DynamoDBDocumentClient.from(client);

async function run() {
  const res = await ddb.send(new ScanCommand({
    TableName: "kavachpay-dev",
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: {
      ":pk": "INTENT#"
    }
  }));
  
  const blinkitIntents = res.Items?.filter(i => i.merchant?.name === "Blinkit" || i.merchant?.merchantId === "Blinkit") || [];
  console.log(`Found ${blinkitIntents.length} Blinkit intents.`);
  
  if (blinkitIntents.length > 0) {
    const latest = blinkitIntents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    console.log("Latest Blinkit intent:", latest.intentId, "Status:", latest.status, "User:", latest.userId);
  }
}

run().catch(console.error);
