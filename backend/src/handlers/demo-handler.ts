import type { Request, Response } from "express";
import { grantRepository } from "../store/grant-repository.js";
import { dynamo } from "../store/dynamodb.js";
import { ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

export async function resetDemoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    
    // Only allow for demo users
    if (userId !== "u_frontend_demo" && userId !== "u_demo") {
      res.status(403).json({ success: false, error: "Not authorized for demo reset" });
      return;
    }

    console.log("[DemoHandler] Resetting demo state for user ");

    const scanCmd = new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || "KavachPay",
    });
    
    const { Items } = await dynamo.send(scanCmd);
    
    if (Items && Items.length > 0) {
      for (const item of Items) {
        let belongsToUser = false;
        
        if (item.PK?.S === "USER#" + userId) {
          belongsToUser = true;
        } else if (item.userId?.S === userId) {
          belongsToUser = true;
        }

        if (belongsToUser) {
          const deleteCmd = new DeleteItemCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME || "KavachPay",
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          });
          await dynamo.send(deleteCmd);
        }
      }
    }

    // Seed the initial ROOT grant
    const rootGrantId = "g_root_" + Date.now();
    await grantRepository.createGrant({
      grantId: rootGrantId,
      userId,
      label: "Master Demo Authority",
      limit: 10000,
      currency: "INR",
      category: "GENERAL",
      merchantAllow: [],
      delegationEnabled: true,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: 5000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "ACTIVE",
      consumed: 0,
      maxDepth: 3,
      maxChildren: 10
    });

    console.log("[DemoHandler] Reset complete. Seeded root grant ");

    res.status(200).json({ success: true, message: "Demo environment reset", rootGrantId });
  } catch (err: any) {
    console.error("[DemoHandler] Error resetting demo:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
