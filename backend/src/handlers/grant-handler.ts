import type { Request, Response } from "express";

import {
  grantService,
} from "../services/grant-service.js";

export async function createGrantHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const grant =
      await grantService.createGrant(
        req.body
      );

    res.status(201).json({
      success: true,
      grant,
    });
  } catch (error) {
    console.error(
      "createGrantHandler error:",
      error
    );

    res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create grant",
    });
  }
}
