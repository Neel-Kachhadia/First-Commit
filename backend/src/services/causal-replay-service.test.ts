import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../store/intent-repository.js", () => ({
  intentRepository: {
    getIntent: vi.fn(),
  },
}));

vi.mock("../store/decision-repository.js", () => ({
  decisionRepository: {
    getDecisionsForIntent: vi.fn(),
    getReceipt: vi.fn(),
  },
}));

vi.mock("../store/grant-repository.js", () => ({
  grantRepository: {
    getGrant: vi.fn(),
  },
}));

vi.mock("../payments/payment-service.js", () => ({
  paymentService: {
    getPaymentRecord: vi.fn(),
  },
}));

import { causalReplayService } from "./causal-replay-service.js";
import { intentRepository } from "../store/intent-repository.js";
import { decisionRepository } from "../store/decision-repository.js";
import { grantRepository } from "../store/grant-repository.js";
import { paymentService } from "../payments/payment-service.js";

// Helper functions for mock data
function mockIntent(overrides: Record<string, any> = {}) {
  return {
    intentId: "i_test",
    userId: "u_test",
    grantId: "g_test",
    amount: 100,
    currency: "INR",
    merchant: { merchantId: "m_test", name: "Test Merchant", category: "test" },
    status: "RESERVED",
    providerStatus: "NOT_INVOKED",
    idempotencyKey: "test-idem-key",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

function mockDecision(overrides: Record<string, any> = {}) {
  return {
    decisionId: "dec_test",
    intentId: "i_test",
    userId: "u_test",
    grantId: "g_test",
    decision: "ALLOW",
    amount: 100,
    currency: "INR",
    reasonCode: "AUTHORIZED",
    reason: "test",
    matchedPolicy: "test",
    reserved: true,
    effectiveCapacity: 1000,
    grantResidual: 1000,
    providerStatus: "NOT_INVOKED",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

function mockGrant(overrides: Record<string, any> = {}) {
  return {
    grantId: "g_test",
    userId: "u_test",
    parentGrantId: null,
    label: "Test Grant",
    limit: 1000,
    consumed: 0,
    currency: "INR",
    window: "MONTHLY",
    status: "ACTIVE",
    windowStart: new Date().toISOString(),
    delegationEnabled: false,
    maxDepth: 1,
    maxChildren: 10,
    category: "GROCERIES",
    merchantAllow: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

describe("CausalReplayService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks for a successful ALLOW path without provider execution
    vi.mocked(intentRepository.getIntent).mockResolvedValue(mockIntent());
    vi.mocked(decisionRepository.getDecisionsForIntent).mockResolvedValue([mockDecision()]);
    vi.mocked(decisionRepository.getReceipt).mockResolvedValue(null);
    vi.mocked(grantRepository.getGrant).mockImplementation(async (userId, grantId) => {
      if (grantId === "g_test") return mockGrant();
      return null;
    });
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue(null);
  });

  // 1. DENIED → NOT_INVOKED
  it("reconstructs DENIED → NOT_INVOKED correctly", async () => {
    vi.mocked(decisionRepository.getDecisionsForIntent).mockResolvedValue([
      mockDecision({ decision: "DENIED", reasonCode: "LIMIT_EXCEEDED", providerStatus: "NOT_INVOKED" }),
    ]);

    const result = await causalReplayService.replay("i_test", "u_test");

    expect(result.outcome.decision).toBe("DENIED");
    expect(result.outcome.providerInvoked).toBe(false);
    expect(result.outcome.providerStatus).toBe("NOT_INVOKED");

    // Check that provider result node is NOT_INVOKED and execution node does not exist
    const providerNode = result.nodes.find((n) => n.id.startsWith("provider-result:"));
    expect(providerNode).toBeDefined();
    expect(providerNode?.status).toBe("NOT_INVOKED");
    
    const executionNode = result.nodes.find((n) => n.type === "EXECUTION");
    expect(executionNode).toBeUndefined();

    // Check that decision caused provider result
    const edge = result.edges.find(e => e.from === "decision:dec_test" && e.to === providerNode?.id);
    expect(edge).toBeDefined();
    expect(edge?.type).toBe("EXECUTED_BY");
  });

  // 2. STEP_UP_REQUIRED → NOT_INVOKED
  it("reconstructs STEP_UP_REQUIRED → NOT_INVOKED correctly", async () => {
    vi.mocked(decisionRepository.getDecisionsForIntent).mockResolvedValue([
      mockDecision({ decision: "STEP_UP_REQUIRED", reasonCode: "STEP_UP_THRESHOLD_EXCEEDED", providerStatus: "NOT_INVOKED" }),
    ]);

    const result = await causalReplayService.replay("i_test", "u_test");

    expect(result.outcome.decision).toBe("STEP_UP_REQUIRED");
    expect(result.outcome.providerInvoked).toBe(false);
    expect(result.outcome.providerStatus).toBe("NOT_INVOKED");

    const providerNode = result.nodes.find((n) => n.id.startsWith("provider-result:"));
    expect(providerNode).toBeDefined();
    expect(providerNode?.status).toBe("NOT_INVOKED");
  });

  // 3. ALLOW → PAYMENT_CREATED
  it("reconstructs ALLOW → PAYMENT_CREATED correctly", async () => {
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      intentId: "i_test",
      userId: "u_test",
      amount: 100,
      currency: "INR",
      razorpayOrderId: "order_test",
      status: "PAYMENT_CREATED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await causalReplayService.replay("i_test", "u_test");

    expect(result.outcome.decision).toBe("ALLOW");
    expect(result.outcome.providerInvoked).toBe(true);
    expect(result.outcome.providerStatus).toBe("PAYMENT_CREATED");

    const executionNode = result.nodes.find((n) => n.type === "EXECUTION");
    expect(executionNode).toBeDefined();
    expect(executionNode?.status).toBe("PAYMENT_CREATED");

    const providerNode = result.nodes.find((n) => n.id.startsWith("provider:"));
    expect(providerNode).toBeDefined();
    expect(providerNode?.status).toBe("PAYMENT_CREATED");
  });

  // 4. ALLOW → EXECUTED
  it("reconstructs ALLOW → EXECUTED correctly", async () => {
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      intentId: "i_test",
      userId: "u_test",
      amount: 100,
      currency: "INR",
      razorpayOrderId: "order_test",
      razorpayPaymentId: "pay_test",
      status: "EXECUTED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await causalReplayService.replay("i_test", "u_test");

    expect(result.outcome.decision).toBe("ALLOW");
    expect(result.outcome.providerInvoked).toBe(true);
    expect(result.outcome.providerStatus).toBe("EXECUTED");

    const providerNode = result.nodes.find((n) => n.id.startsWith("provider:"));
    expect(providerNode?.status).toBe("EXECUTED");
  });

  // 5. ALLOW → FAILED
  it("reconstructs ALLOW → FAILED correctly", async () => {
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      intentId: "i_test",
      userId: "u_test",
      amount: 100,
      currency: "INR",
      razorpayOrderId: "order_test",
      razorpayPaymentId: "pay_test",
      status: "FAILED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await causalReplayService.replay("i_test", "u_test");

    expect(result.outcome.decision).toBe("ALLOW");
    expect(result.outcome.providerInvoked).toBe(true);
    expect(result.outcome.providerStatus).toBe("FAILED");

    const providerNode = result.nodes.find((n) => n.id.startsWith("provider:"));
    expect(providerNode?.status).toBe("FAILED");
  });

  // 6. webhook-linked successful payment
  it("reconstructs webhook-linked successful payment", async () => {
    vi.mocked(paymentService.getPaymentRecord).mockResolvedValue({
      intentId: "i_test",
      userId: "u_test",
      amount: 100,
      currency: "INR",
      razorpayOrderId: "order_test",
      razorpayPaymentId: "pay_test",
      providerWebhookEventId: "evt_test",
      status: "EXECUTED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await causalReplayService.replay("i_test", "u_test");

    expect(result.chain.providerWebhook).toBe("webhook:evt_test");
    
    const webhookNode = result.nodes.find((n) => n.type === "PROVIDER_WEBHOOK");
    expect(webhookNode).toBeDefined();
    expect(webhookNode?.data?.eventId).toBe("evt_test");
    expect(webhookNode?.status).toBe("VERIFIED");

    const providerNode = result.nodes.find((n) => n.id.startsWith("provider:"));
    
    const edge = result.edges.find((e) => e.from === providerNode?.id && e.to === webhookNode?.id);
    expect(edge).toBeDefined();
    expect(edge?.type).toBe("CONFIRMED_BY");
  });

  // 7. replay cannot expose another user's intent
  it("prevents exposing another user's intent", async () => {
    vi.mocked(intentRepository.getIntent).mockResolvedValue(mockIntent({ userId: "u_different" }));

    await expect(causalReplayService.replay("i_test", "u_test")).rejects.toThrow(
      "Intent does not belong to the requested user."
    );
  });
});
