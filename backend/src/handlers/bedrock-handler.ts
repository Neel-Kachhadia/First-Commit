import type { Request, Response } from "express";

import {
  bedrockService,
} from "../services/bedrock-service.js";

export async function extractMandateHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const naturalLanguage = req.body?.naturalLanguage;

    if (
      typeof naturalLanguage !== "string" ||
      naturalLanguage.trim().length === 0
    ) {
      res.status(400).json({
        success: false,
        error: "naturalLanguage is required.",
      });
      return;
    }

    const mandate =
      await bedrockService.extractMandate(
        naturalLanguage
      );

    res.status(200).json({
      success: true,
      mandate,
    });
  } catch (error) {
    console.error(
      "extractMandateHandler error:",
      error
    );

    res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to extract mandate",
    });
  }
}
