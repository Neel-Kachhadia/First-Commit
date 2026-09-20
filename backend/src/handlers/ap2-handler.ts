import type { Request, Response } from "express";

import {
  Ap2Adapter,
  type Ap2MandateInput,
} from "../adapters/ap2-adapter.js";

import {
  grantService,
} from "../services/grant-service.js";

const ap2Adapter = new Ap2Adapter();

export async function createAp2MandateHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const mandate = req.body as Ap2MandateInput;

    if (!mandate || typeof mandate !== "object") {
      res.status(400).json({
        success: false,
        error: "AP2 mandate payload is required.",
      });
      return;
    }

    const label =
      typeof req.body.label === "string" &&
      req.body.label.trim().length > 0
        ? req.body.label.trim()
        : "AP2 Mandate";

    const grantInput =
      ap2Adapter.normalizeMandate(
        mandate,
        label
      );

    const grant =
      await grantService.createGrant({
        ...grantInput,
        // Override mandate.principal_id with the verified JWT identity.
        // The calling system must authenticate as the correct Cognito user.
        userId: req.user!.sub,
      });

    res.status(201).json({
      success: true,
      sourceProtocol: "AP2",
      mandateRef: mandate.mandate_id,
      grant,
    });
  } catch (error) {
    console.error(
      "createAp2MandateHandler error:",
      error
    );

    res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to process AP2 mandate",
    });
  }
}
