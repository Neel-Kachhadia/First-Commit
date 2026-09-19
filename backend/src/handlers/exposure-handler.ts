import type { Request, Response } from "express";

import {
  exposureService,
} from "../services/exposure-service.js";

export async function getExposureHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.sub;

    const exposure =
      await exposureService.calculateExposure(
        userId
      );

    res.status(200).json({
      success: true,
      ...exposure,
    });
  } catch (error) {
    console.error(
      "getExposureHandler error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to calculate exposure",
    });
  }
}
