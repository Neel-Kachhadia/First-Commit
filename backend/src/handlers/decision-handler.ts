import type { Request, Response } from "express";
import { decisionRepository } from "../store/decision-repository.js";

export async function getDecisionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const intentId = req.params.intentId as string;

    if (!intentId) {
      res.status(400).json({
        success: false,
        error: "Intent ID is required.",
      });
      return;
    }

    const decisions = await decisionRepository.getDecisionsForIntent(intentId);

    res.status(200).json({
      success: true,
      intentId,
      decisions: decisions
    });
  } catch (error) {
    console.error("getDecisionsHandler error:", error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve decisions",
    });
  }
}
