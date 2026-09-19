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

// Hoist mock functions so they are available inside vi.mock() factories
const { mockOrdersCreate, mockCreateIntent, mockPaymentExecute } = vi.hoisted(() => ({
  mockOrdersCreate: vi.fn(),
  mockCreateIntent: vi.fn(),
  mockPaymentExecute: vi.fn(),
}));

// Mock Razorpay SDK (still needed for verifyPaymentHandler)
vi.mock("razorpay", () => {
  return {
    default: class MockRazorpay {
      orders = { create: mockOrdersCreate };
      constructor(public options: any) {}
    },
  };
});

// Mock IntentService
vi.mock("../services/intent-service.js", () => ({
  IntentService: class {
    createIntent = mockCreateIntent;
  },
}));

// Mock PaymentService singleton
vi.mock("../payments/payment-service.js", () => ({
  paymentService: {
    execute: mockPaymentExecute,
  },
}));

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
  return { body, headers } as Request;
}

// Minimal valid create-order body
const VALID_BODY = {
  amount: 10000,
  currency: "INR",
  grantId: "g_test_grant",
  userId: "u_demo",
  merchant: {
    merchantId: "blinkit",
    name: "Blinkit",
    category: "GROCERY",
  },
  description: "Demo purchase",
  idempotencyKey: "idem_test_001",
};

// Shared intent result for the ALLOW path
const ALLOW_INTENT_RESULT = {
  intent: {
    intentId: "i_test_intent",
    status: "RESERVED",
    amount: 100,
    currency: "INR",
  },
  decision: { decision: "ALLOW", reserved: true },
  replayed: false,
};

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

    it("rejects missing grantId with 400", async () => {
      const req = mockRequest({ ...VALID_BODY, grantId: undefined });
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect((res as any).jsonData.error).toBe("grantId is required");
    });

    it("rejects missing merchant with 400", async () => {
      const req = mockRequest({ ...VALID_BODY, merchant: undefined });
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect((res as any).jsonData.error).toBe("Merchant information is required");
    });

    it("returns 403 when KavachPay denies the intent", async () => {
      mockCreateIntent.mockResolvedValue({
        intent: { intentId: "i_denied", status: "DENIED", amount: 100, currency: "INR" },
        decision: { decision: "DENY", reasonCode: "CAPACITY_EXCEEDED" },
        replayed: false,
      });

      const req = mockRequest(VALID_BODY);
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect((res as any).jsonData.error).toBe("Payment denied by KavachPay");
      // Razorpay must never be reached after DENY
      expect(mockPaymentExecute).not.toHaveBeenCalled();
    });

    it("returns 202 when KavachPay requires step-up approval", async () => {
      mockCreateIntent.mockResolvedValue({
        intent: { intentId: "i_stepup", status: "STEP_UP_REQUIRED", amount: 100, currency: "INR" },
        decision: { decision: "STEP_UP" },
        replayed: false,
      });

      const req = mockRequest(VALID_BODY);
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect((res as any).jsonData.requiresStepUp).toBe(true);
      // Razorpay must never be reached before step-up is approved
      expect(mockPaymentExecute).not.toHaveBeenCalled();
    });

    it("successfully creates a KavachPay-governed order and returns flat response", async () => {
      mockCreateIntent.mockResolvedValue(ALLOW_INTENT_RESULT);
      mockPaymentExecute.mockResolvedValue({
        success: true,
        razorpayOrderId: "order_kpay123",
        razorpayPaymentId: undefined,
      });

      const req = mockRequest(VALID_BODY);
      const res = mockResponse();

      await createOrderHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const data = (res as any).jsonData;
      expect(data.success).toBe(true);
      // Frontend-compatible flat fields
      expect(data.order_id).toBe("order_kpay123");
      expect(data.amount).toBe(10000);
      expect(data.currency).toBe("INR");
      expect(data.key_id).toBe(TEST_KEY_ID);
      // KavachPay fields
      expect(data.intentId).toBe("i_test_intent");
      expect(data.grantId).toBe("g_test_grant");
      expect(data.decision).toBe("ALLOW");
      // PaymentService called with correct intent ID
      expect(mockPaymentExecute).toHaveBeenCalledWith("i_test_intent");
    });

    it("converts paise to rupees before calling IntentService", async () => {
      mockCreateIntent.mockResolvedValue(ALLOW_INTENT_RESULT);
      mockPaymentExecute.mockResolvedValue({
        success: true,
        razorpayOrderId: "order_kpay456",
      });

      const req = mockRequest({ ...VALID_BODY, amount: 10000 }); // ₹100 in paise
      const res = mockResponse();

      await createOrderHandler(req, res);

      // IntentService should receive 100 (rupees), not 10000 (paise)
      expect(mockCreateIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100 })
      );
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
