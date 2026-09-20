import type { Request, Response } from "express";
import { grantRepository } from "../store/grant-repository.js";
import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { auditRepository } from "../store/audit-repository.js";

export async function resetDemoHandler(req: Request, res: Response): Promise<void> {
  try {
    // Derive userId from the verified Cognito JWT — never trust the body.
    const userId = req.user!.sub;

    console.log(`[DemoHandler] Resetting demo state for user ${userId} on table ${TABLE_NAME}`);

    const scanCmd = new ScanCommand({
      TableName: TABLE_NAME,
    });
    
    const { Items } = await dynamo.send(scanCmd);
    
    let deletedCount = 0;
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
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          });
          await dynamo.send(deleteCmd);
          deletedCount++;
        }
      }
    }

    console.log(`[DemoHandler] Deleted ${deletedCount} item(s) for user ${userId}.`);

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

    await auditRepository.logEvent(userId, "DEMO_RESET", { rootGrantId, deletedCount }, "SYSTEM");

    console.log(`[DemoHandler] Reset complete. Seeded root grant ${rootGrantId}.`);

    res.status(200).json({ success: true, message: "Demo environment reset", rootGrantId });
  } catch (err: any) {
    console.error("[DemoHandler] Error resetting demo:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
