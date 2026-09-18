import type { Request, Response } from "express";
import { IntentService } from "../services/intent-service.js";

const intentService = new IntentService();

export async function createIntentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.sub || req.body.userId || "u_demo";
    const result = await intentService.createIntent({ ...req.body, userId });

    const statusCode =
      result.decision.decision === "DENY"
        ? 403
        : result.decision.decision === "STEP_UP"
          ? 202
          : 200;

    res.status(statusCode).json({
      success: true,
      replayed: result.replayed,
      intent: result.intent,
      decision: result.decision,
    });
  } catch (error) {
    console.error("createIntentHandler error:", error);

    res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create intent",
    });
  }
}

export async function approveIntentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const intentId = req.params.id as string;

    if (!intentId) {
      res.status(400).json({
        success: false,
        error: "Intent ID is required.",
      });
      return;
    }

    const result = await intentService.approveIntent(intentId);

    const statusCode =
      result.decision.decision === "DENY"
        ? 403
        : result.intent.status === "STEP_UP_REQUIRED"
          ? 202
          : 200;

    res.status(statusCode).json({
      success: true,
      replayed: result.replayed,
      intent: result.intent,
      decision: result.decision,
    });
  } catch (error) {
    console.error("approveIntentHandler error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to approve intent";

    const statusCode =
      message.includes("was not found")
        ? 404
        : message.includes("cannot be approved")
          ? 409
          : 400;

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
}

export async function denyIntentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const intentId = req.params.id as string;

    if (!intentId) {
      res.status(400).json({
        success: false,
        error: "Intent ID is required.",
      });
      return;
    }

    const intent = await intentService.denyIntent(intentId);
    res.status(200).json({ success: true, intent });
  } catch (error) {
    console.error("denyIntentHandler error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to deny intent";
    const statusCode = message.includes("was not found")
      ? 404
      : message.includes("cannot be denied")
        ? 409
        : 400;

    res.status(statusCode).json({ success: false, error: message });
  }
}

export async function listIntentsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.sub;

    const intents = await intentService.listUserIntents(userId);

    res.status(200).json({
      success: true,
      intents,
    });
  } catch (error) {
    console.error("listIntentsHandler error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list intents",
    });
  }
}
