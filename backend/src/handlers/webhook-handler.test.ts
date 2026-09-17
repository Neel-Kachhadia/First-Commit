/**
 * KavachPay — WebhookHandler Tests
 *
 * Covers:
 *   1. Invalid signature → HTTP 400
 *   2. Missing signature → HTTP 400
 *   3. Missing event ID → HTTP 400
 *   4. Invalid JSON body → HTTP 400
 *   5. Valid + successfully processed → HTTP 200
 *   6. Valid + already PROCESSED (duplicate) → HTTP 200
 *   7. Valid + processing failure → HTTP 500
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../payments/webhook-service.js", () => ({
  webhookService: {
    processWebhook: vi.fn(),
  },
}));

import { webhookService } from "../payments/webhook-service.js";
import { webhookHandler } from "./webhook-handler.js";

function mockResponse(): Response {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: any) => {
    res.jsonData = data;
    return res;
  });
  return res as Response;
}

function mockRequest(
  bodyBuffer: Buffer | any,
  headers: Record<string, string> = {}
): Request {
  return {
    body: bodyBuffer,
    headers,
  } as Request;
}

describe("WebhookHandler HTTP Responses", () => {
  const validPayload = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test001",
          order_id: "order_test001",
          amount: 185000,
          currency: "INR",
        },
      },
    },
  };
  const validRawBody = JSON.stringify(validPayload);
  const validBuffer = Buffer.from(validRawBody, "utf8");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTTP 400 when body is not a raw buffer", async () => {
    const req = mockRequest("not a buffer", {
      "x-razorpay-signature": "sig123",
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as any).jsonData.error).toBe("Invalid request");
  });

  it("returns HTTP 400 when x-razorpay-signature header is missing", async () => {
    const req = mockRequest(validBuffer, {
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as any).jsonData.error).toBe("Missing signature");
  });

  it("returns HTTP 400 when x-razorpay-event-id header is missing", async () => {
    const req = mockRequest(validBuffer, {
      "x-razorpay-signature": "sig123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as any).jsonData.error).toBe("Missing event ID");
  });

  it("returns HTTP 400 when request body cannot be parsed as JSON", async () => {
    const req = mockRequest(Buffer.from("invalid json{{{", "utf8"), {
      "x-razorpay-signature": "sig123",
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as any).jsonData.error).toBe("Invalid JSON");
  });

  it("returns HTTP 400 when signature verification fails", async () => {
    vi.mocked(webhookService.processWebhook).mockRejectedValue(
      new Error("Invalid Razorpay webhook signature.")
    );

    const req = mockRequest(validBuffer, {
      "x-razorpay-signature": "bad_sig",
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as any).jsonData.error).toBe("Signature verification failed");
  });

  it("returns HTTP 200 when webhook is valid and processed successfully", async () => {
    vi.mocked(webhookService.processWebhook).mockResolvedValue({
      processed: true,
      duplicate: false,
    });

    const req = mockRequest(validBuffer, {
      "x-razorpay-signature": "good_sig",
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as any).jsonData).toEqual({
      received: true,
      duplicate: false,
      processed: true,
    });
  });

  it("returns HTTP 200 when webhook is already PROCESSED (duplicate)", async () => {
    vi.mocked(webhookService.processWebhook).mockResolvedValue({
      processed: false,
      duplicate: true,
    });

    const req = mockRequest(validBuffer, {
      "x-razorpay-signature": "good_sig",
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as any).jsonData.duplicate).toBe(true);
  });

  it("returns HTTP 500 when processing encounters an error", async () => {
    vi.mocked(webhookService.processWebhook).mockRejectedValue(
      new Error("Payment amount mismatch for intent i_123")
    );

    const req = mockRequest(validBuffer, {
      "x-razorpay-signature": "good_sig",
      "x-razorpay-event-id": "evt123",
    });
    const res = mockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect((res as any).jsonData.error).toBe("Internal server error");
  });
});
