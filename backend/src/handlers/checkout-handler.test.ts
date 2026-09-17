import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import crypto from "crypto";
import {
  createOrderHandler,
  verifyPaymentHandler,
  getCheckoutConfigHandler,
  generatePaymentSignature,
  verifySignature,
} from "./checkout-handler.js";

const mockOrdersCreate = vi.fn();

// Mock Razorpay SDK
vi.mock("razorpay", () => {
  return {
    default: class MockRazorpay {
      orders = {
        create: mockOrdersCreate,
      };
      constructor(public options: any) {}
    },
  };
});

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

function mockRequest(body: any = {}, headers: any = {}): Request {
  return {
    body,
    headers,
  } as Request;
}

describe("Checkout Handler", () => {
  const originalEnv = process.env;
  const TEST_KEY_ID = "rzp_test_Td1IYeLXXcVTRj";
  const TEST_KEY_SECRET = "0lBJxm3dYIo1CEv42PVXWIKa";

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RAZORPAY_KEY_ID: TEST_KEY_ID,
      RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("POST /api/create-order", () => {
    it("rejects invalid or missing amount with 400", async () => {
      const req = mockRequest({ amount: "invalid" });
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect((res as any).jsonData.error).toBe("Invalid amount");
    });

    it("rejects amount less than 100 paise with 400", async () => {
      const req = mockRequest({ amount: 99 });
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect((res as any).jsonData.error).toBe("Amount too low");
    });

    it("successfully creates an order and returns order_id, amount, currency", async () => {
      const req = mockRequest({
        amount: 50000,
        currency: "INR",
        receipt: "rcpt_12345",
      });
      const res = mockResponse();

      const mockOrder = {
        id: "order_mock123",
        amount: 50000,
        currency: "INR",
        receipt: "rcpt_12345",
        status: "created",
      };

      // Mock orders.create
      mockOrdersCreate.mockResolvedValue(mockOrder);

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect((res as any).jsonData).toEqual({
        order_id: "order_mock123",
        amount: 50000,
        currency: "INR",
        key_id: TEST_KEY_ID,
      });
    });

    it("returns 401 when Razorpay authentication fails", async () => {
      const req = mockRequest({ amount: 50000 });
      const res = mockResponse();

      const authError = new Error("Authentication failed");
      (authError as any).statusCode = 401;
      mockOrdersCreate.mockRejectedValue(authError);

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect((res as any).jsonData.error).toBe("Razorpay authentication failed");
    });

    it("returns 500 when Razorpay API throws general error", async () => {
      const req = mockRequest({ amount: 50000 });
      const res = mockResponse();

      const apiError = new Error("Razorpay internal error");
      (apiError as any).statusCode = 500;
      mockOrdersCreate.mockRejectedValue(apiError);

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect((res as any).jsonData.error).toBe("Failed to create order");
    });
  });

  describe("POST /api/verify-payment", () => {
    it("rejects when fields are missing with 400", async () => {
      const req = mockRequest({
        razorpay_order_id: "order_123",
        // payment_id and signature missing
      });
      const res = mockResponse();

      await verifyPaymentHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect((res as any).jsonData.error).toBe("Missing fields");
    });

    it("rejects signature mismatch with 400 and does NOT verify", async () => {
      const req = mockRequest({
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_456",
        razorpay_signature: "tampered_signature_hex",
      });
      const res = mockResponse();

      await verifyPaymentHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect((res as any).jsonData.error).toBe("Signature mismatch");
      expect((res as any).jsonData.success).toBe(false);
    });

    it("accepts valid signature with 200", async () => {
      const orderId = "order_abc123";
      const paymentId = "pay_xyz789";
      const validSignature = generatePaymentSignature(orderId, paymentId, TEST_KEY_SECRET);

      const req = mockRequest({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      });
      const res = mockResponse();

      await verifyPaymentHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect((res as any).jsonData.success).toBe(true);
      expect((res as any).jsonData.order_id).toBe(orderId);
      expect((res as any).jsonData.payment_id).toBe(paymentId);
    });

    it("accepts alternate field names (order_id, payment_id, signature)", async () => {
      const orderId = "order_alternate";
      const paymentId = "pay_alternate";
      const validSignature = generatePaymentSignature(orderId, paymentId, TEST_KEY_SECRET);

      const req = mockRequest({
        order_id: orderId,
        payment_id: paymentId,
        signature: validSignature,
      });
      const res = mockResponse();

      await verifyPaymentHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect((res as any).jsonData.success).toBe(true);
    });
  });

  describe("GET /api/config", () => {
    it("returns public key_id and does NOT expose secret", () => {
      const req = mockRequest();
      const res = mockResponse();

      getCheckoutConfigHandler(req, res);

      expect((res as any).jsonData).toEqual({
        key_id: TEST_KEY_ID,
      });
      expect((res as any).jsonData.key_secret).toBeUndefined();
    });
  });

  describe("Signature helpers", () => {
    it("returns true for matching signature and false for non-matching", () => {
      const orderId = "order_test";
      const paymentId = "pay_test";
      const sig = generatePaymentSignature(orderId, paymentId, TEST_KEY_SECRET);

      expect(verifySignature(orderId, paymentId, sig, TEST_KEY_SECRET)).toBe(true);
      expect(verifySignature(orderId, paymentId, "wrong_signature", TEST_KEY_SECRET)).toBe(false);
      expect(verifySignature(orderId, paymentId, sig, "wrong_secret")).toBe(false);
    });
  });
});
