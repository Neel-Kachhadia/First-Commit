/**
 * KavachPay — Webhook Handler
 *
 * Express handler for POST /v0/webhooks/razorpay
 *
 * IMPORTANT: This route must be registered BEFORE express.json() in app.ts
 * using express.raw({ type: 'application/json' }) as middleware.
 *
 * Razorpay requires the raw request body bytes for HMAC-SHA256
 * signature verification. Parsing with express.json() first would
 * mutate the body and invalidate the signature.
 *
 * @see https://razorpay.com/docs/webhooks/validate-test/
 *
 * Returns:
 *   200  — signature valid (even if processing fails; Razorpay retries on non-200)
 *   400  — missing or invalid signature
 *   500  — unexpected server error
 */

import type { Request, Response } from "express";
import { webhookService } from "../payments/webhook-service.js";
import type { RazorpayWebhookPayload } from "../payments/types.js";

export async function webhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  // The route uses express.raw(), so req.body is a Buffer.
  const rawBodyBuffer: Buffer = req.body as Buffer;

  if (!rawBodyBuffer || !Buffer.isBuffer(rawBodyBuffer)) {
    res.status(400).json({
      error: "Invalid request",
      message:
        "Request body is missing or not a raw buffer. " +
        "Ensure the route is configured with express.raw().",
    });
    return;
  }

  // Convert to UTF-8 string for HMAC computation.
  const rawBody = rawBodyBuffer.toString("utf8");

  // x-razorpay-signature — HMAC-SHA256 of raw body
  const signature = req.headers["x-razorpay-signature"];

  if (!signature || typeof signature !== "string") {
    console.warn("[WebhookHandler] Missing x-razorpay-signature header.");
    res.status(400).json({
      error: "Missing signature",
      message: "x-razorpay-signature header is required.",
    });
    return;
  }

  // x-razorpay-event-id — unique event identifier (idempotency key)
  const eventId = req.headers["x-razorpay-event-id"];

  if (!eventId || typeof eventId !== "string") {
    console.warn("[WebhookHandler] Missing x-razorpay-event-id header.");
    res.status(400).json({
      error: "Missing event ID",
      message: "x-razorpay-event-id header is required.",
    });
    return;
  }

  // Parse the body — we do this ourselves since express.raw() gives us a Buffer.
  let payload: RazorpayWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    res.status(400).json({
      error: "Invalid JSON",
      message: "Request body could not be parsed as JSON.",
    });
    return;
  }

  try {
    const result = await webhookService.processWebhook(
      rawBody,
      signature,
      eventId,
      payload
    );

    if (result.duplicate) {
      // Duplicate — still return 200 to prevent Razorpay from retrying.
      res.status(200).json({
        received: true,
        duplicate: true,
        message: "Event already processed.",
      });
      return;
    }

    res.status(200).json({
      received: true,
      duplicate: false,
      processed: result.processed,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid Razorpay webhook signature."
    ) {
      // Signature verification failed — this is a client error.
      res.status(400).json({
        error: "Signature verification failed",
        message: "The webhook signature does not match the payload.",
      });
      return;
    }

    // Unexpected server error — log but still try to return 200 if signature
    // was valid, so Razorpay doesn't retry indefinitely for a processing bug.
    console.error(
      "[WebhookHandler] Unexpected error during webhook processing:",
      error
    );

    res.status(500).json({
      error: "Internal server error",
      message: "Webhook received but processing encountered an error.",
    });
  }
}
