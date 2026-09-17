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

export async function revokeGrantHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const grantId = req.params.id as string;

    if (!grantId) {
      res.status(400).json({
        success: false,
        error: "Grant ID is required.",
      });
      return;
    }

    // For now the demo user is u123.
    // Cognito caller identity will replace this later.
    const userId =
      typeof req.body?.userId === "string" &&
      req.body.userId.length > 0
        ? req.body.userId
        : "u123";

    const grant =
      await grantService.revokeGrant(
        userId,
        grantId
      );

    res.status(200).json({
      success: true,
      message: "Grant revoked successfully.",
      grant,
    });
  } catch (error) {
    console.error(
      "revokeGrantHandler error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to revoke grant";

    const statusCode =
      message.includes("was not found")
        ? 404
        : message.includes("already revoked")
          ? 409
          : 400;

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
}

export async function listGrantsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId =
      typeof req.query.userId === "string" && req.query.userId.length > 0
        ? req.query.userId
        : "u_demo"; // Default to demo user

    const grants = await grantService.listUserGrants(userId);

    res.status(200).json({
      success: true,
      grants,
    });
  } catch (error) {
    console.error("listGrantsHandler error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list grants",
    });
  }
}
