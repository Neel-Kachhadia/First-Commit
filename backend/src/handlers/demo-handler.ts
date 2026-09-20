import type { Request, Response } from "express";
import { resetDemo } from "../demo-reset.js";

export async function resetDemoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    
    // Only allow for demo users
    if (userId !== "u_frontend_demo" && userId !== "u_demo") {
      res.status(403).json({ success: false, error: "Not authorized for demo reset" });
      return;
    }

    const result = await resetDemo(userId);

    res.status(200).json(result);
  } catch (err: any) {
    console.error("[DemoHandler] Error resetting demo:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
