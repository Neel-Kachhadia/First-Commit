import type { Request, Response } from "express";
import { resetDemo } from "../demo-reset.js";

export async function resetDemoHandler(req: Request, res: Response): Promise<void> {
  try {
    // Derive userId from the verified Cognito JWT — never trust the body.
    const userId = req.user!.sub;

    const result = await resetDemo(userId);

    res.status(200).json(result);
  } catch (err: any) {
    console.error("[DemoHandler] Error resetting demo:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
