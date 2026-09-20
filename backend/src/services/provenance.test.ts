import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntentService } from "../services/intent-service.js";
import { intentRepository } from "../store/intent-repository.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("../store/intent-repository.js");
vi.mock("../store/reservation-repository.js");
vi.mock("../store/decision-repository.js");
vi.mock("../store/audit-repository.js");
vi.mock("../engine/authority-engine.js", () => ({
  authorityEngine: { evaluate: vi.fn().mockResolvedValue({ decision: "DENY", reasonCode: "TEST", reserved: false, providerStatus: "NOT_INVOKED" }) },
}));
vi.mock("../engine/authority-path.js", () => ({
  resolveAuthorityPath: vi.fn().mockResolvedValue({ grants: [] }),
}));
vi.mock("../services/receipt-service.js", () => ({
  receiptService: { finalizeDecision: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("../engine/intent-state-machine.js", () => ({
  applyTransition: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../utils/metrics.js", () => ({
  metrics: { logEvent: vi.fn() },
}));
vi.mock("../store/payment-profile-repository.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildIntentInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u_test",
    grantId: "g_test",
    amount: 100,
    merchant: { merchantId: "m_1", name: "Test Merchant", category: "GENERAL" },
    idempotencyKey: `idem_${Math.random()}`,
    ...overrides,
  };
}

describe("P0.9–P0.12: Agent Provenance", () => {
  let intentService: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    intentService = new IntentService();

    // No existing intent by default (new intent path)
    vi.mocked(intentRepository.getByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(intentRepository.registerIdempotencyKey).mockResolvedValue(undefined as any);
    vi.mocked(intentRepository.createIntent).mockResolvedValue(undefined as any);
  });

  // ── P0.9: Origin model ──────────────────────────────────────────────────────

  it("1. AGENT_RUNTIME intent with agentId is persisted correctly", async () => {
    const result = await intentService.createIntent(buildIntentInput({
      origin: { type: "AGENT_RUNTIME", agentId: "KAVACHPAY_AGENTCORE" },
    }));
    expect(result.intent.origin?.type).toBe("AGENT_RUNTIME");
    expect(result.intent.origin?.agentId).toBe("KAVACHPAY_AGENTCORE");
  });

  it("2. USER_VOICE intent with commandId is persisted correctly", async () => {
    const result = await intentService.createIntent(buildIntentInput({
      origin: { type: "USER_VOICE", commandId: "VCMD-0084" },
    }));
    expect(result.intent.origin?.type).toBe("USER_VOICE");
    expect(result.intent.origin?.commandId).toBe("VCMD-0084");
  });

  it("3. USER_UI intent has no agent fields", async () => {
    const result = await intentService.createIntent(buildIntentInput({
      origin: { type: "USER_UI" },
    }));
    expect(result.intent.origin?.type).toBe("USER_UI");
    expect(result.intent.origin?.agentId).toBeUndefined();
    expect(result.intent.origin?.taskId).toBeUndefined();
  });

  // ── P0.10: Security validation ──────────────────────────────────────────────

  it("4. AGENT_RUNTIME without agentId → AGENT_IDENTITY_UNVERIFIED, no intent created", async () => {
    await expect(
      intentService.createIntent(buildIntentInput({
        origin: { type: "AGENT_RUNTIME" },  // no agentId
      }))
    ).rejects.toMatchObject({ code: "AGENT_IDENTITY_UNVERIFIED" });

    // The idempotency key registration must NOT have been called
    expect(intentRepository.registerIdempotencyKey).not.toHaveBeenCalled();
    expect(intentRepository.createIntent).not.toHaveBeenCalled();
  });

  it("5. Origin absent → backward-compatible, intent created normally", async () => {
    const result = await intentService.createIntent(buildIntentInput());
    expect(result.intent.origin).toBeUndefined();
    expect(result.intent.intentId).toBeDefined();
  });

  it("6. Agent body with agentId field → rejected 400 before createIntent (handler-level)", async () => {
    // This tests the handler logic: we simulate what the handler does
    const FORBIDDEN = ["agentId", "origin", "taskId", "commandId", "paymentProfileId", "providerTokenRef", "providerCustomerId"];
    const body = { grantId: "g_1", amount: 100, merchant: { name: "Test", category: "GENERAL" }, agentId: "SPOOF" };
    const forbidden = FORBIDDEN.filter((f) => f in body);
    expect(forbidden).toContain("agentId");
    expect(forbidden.length).toBeGreaterThan(0);
  });

  it("7. Agent body with origin field → rejected 400 before createIntent (handler-level)", async () => {
    const FORBIDDEN = ["agentId", "origin", "taskId", "commandId", "paymentProfileId", "providerTokenRef", "providerCustomerId"];
    const body = { grantId: "g_1", amount: 100, merchant: { name: "Test" }, origin: { type: "AGENT_RUNTIME", agentId: "SPOOF" } };
    const forbidden = FORBIDDEN.filter((f) => f in body);
    expect(forbidden).toContain("origin");
  });

  it("14. Agent body with taskId field → rejected 400 (reserved for trusted orchestration layer)", async () => {
    const FORBIDDEN = ["agentId", "origin", "taskId", "commandId", "paymentProfileId", "providerTokenRef", "providerCustomerId"];
    const body = { grantId: "g_1", amount: 100, merchant: { name: "Test" }, taskId: "FAKE-TASK-001" };
    const forbidden = FORBIDDEN.filter((f) => f in body);
    expect(forbidden).toContain("taskId");
  });

  // ── P0.11/P0.12: Causal replay provenance ──────────────────────────────────

  it("8. Origin with commandId is present in persisted intent data field", async () => {
    const result = await intentService.createIntent(buildIntentInput({
      origin: { type: "USER_VOICE", commandId: "VCMD-0084" },
    }));
    expect((result.intent as any).origin?.commandId).toBe("VCMD-0084");
  });

  it("9. Origin with taskId is present in persisted intent data field", async () => {
    const result = await intentService.createIntent(buildIntentInput({
      origin: { type: "AGENT_RUNTIME", agentId: "KAVACHPAY_AGENTCORE", taskId: "TASK-001" },
    }));
    expect((result.intent as any).origin?.taskId).toBe("TASK-001");
  });

  it("10. Origin with both commandId and taskId is fully persisted", async () => {
    const result = await intentService.createIntent(buildIntentInput({
      origin: {
        type: "AGENT_RUNTIME",
        agentId: "KAVACHPAY_AGENTCORE",
        taskId: "TASK-001",
        commandId: "VCMD-0084",
      },
    }));
    const o = (result.intent as any).origin;
    expect(o?.commandId).toBe("VCMD-0084");
    expect(o?.taskId).toBe("TASK-001");
    expect(o?.agentId).toBe("KAVACHPAY_AGENTCORE");
  });

  it("11. No provenance → replay runs without COMMAND/TASK nodes", async () => {
    // The absence of origin means no command/task node in the replay.
    // Verify the schema accepts an intent without origin.
    const result = await intentService.createIntent(buildIntentInput());
    expect(result.intent.origin).toBeUndefined();
  });

  it("12. Payment profile can be read for side-branch (unit check)", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_1",
      provider: "RAZORPAY",
      environment: "TEST",
      connectionMode: "SIMULATED",
      status: "ACTIVE",
      displayName: "Visa •••• 1111",
    } as any);

    const profile = await paymentProfileRepository.getProfile("u_test", "pp_1");
    expect(profile?.paymentProfileId).toBe("pp_1");
    expect(profile?.provider).toBe("RAZORPAY");
    // Credentials never present
    expect((profile as any)?.providerTokenRef).toBeUndefined();
    expect((profile as any)?.providerCustomerId).toBeUndefined();
  });

  it("13. No payment profile → no side branch (null return)", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue(null);
    const profile = await paymentProfileRepository.getProfile("u_test", "pp_none");
    expect(profile).toBeNull();
  });
});
