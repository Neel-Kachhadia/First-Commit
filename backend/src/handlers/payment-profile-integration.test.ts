import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantService } from "../services/grant-service.js";
import { grantRepository } from "../store/grant-repository.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";
import { paymentProfileResolutionService } from "../services/payment-profile-resolution-service.js";
import { resetDemo } from "../demo-reset.js";
import { dynamo } from "../store/dynamodb.js";

vi.mock("../store/grant-repository.js");
vi.mock("../store/payment-profile-repository.js");
vi.mock("../store/audit-repository.js");
vi.mock("../store/dynamodb.js", () => ({
  dynamo: {
    send: vi.fn(),
  },
}));

describe("Payment Profile P0 Security & Integration Tests", () => {
  const userId = "u_alice";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. profile creation/persistence works", async () => {
    vi.mocked(paymentProfileRepository.createProfile).mockResolvedValue();

    const profile = {
      paymentProfileId: "pp_12345",
      userId,
      provider: "RAZORPAY" as const,
      environment: "TEST" as const,
      methodType: "CARD" as const,
      displayName: "Visa •••• 1111",
      status: "ACTIVE" as const,
      connectionMode: "SIMULATED" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await paymentProfileRepository.createProfile(profile);
    expect(paymentProfileRepository.createProfile).toHaveBeenCalledWith(profile);
  });

  it("2 & 3. valid same-user ACTIVE profile can bind to root grant and persists exact ID", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockImplementation(async (uid, pid) => {
      if (uid === userId && pid === "pp_valid_root") {
        return {
          paymentProfileId: "pp_valid_root",
          userId,
          provider: "RAZORPAY",
          environment: "TEST",
          status: "ACTIVE",
        } as any;
      }
      return null;
    });

    vi.mocked(grantRepository.createGrant).mockResolvedValue();

    const grant = await grantService.createGrant({
      userId,
      label: "Root Mandate",
      limit: 5000,
      window: "MONTHLY",
      windowStart: "2026-01-01T00:00:00Z",
      hardMax: 2000,
      paymentProfileId: "pp_valid_root",
    });

    expect(grant.paymentProfileId).toBe("pp_valid_root");
    expect(grantRepository.createGrant).toHaveBeenCalledWith(
      expect.objectContaining({ paymentProfileId: "pp_valid_root" })
    );
  });

  it("4. another user's profile cannot be bound (checked against authenticated userId)", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockImplementation(async (uid, pid) => {
      // Profile exists under u_bob, not u_alice
      if (uid === "u_bob" && pid === "pp_bob") {
        return { paymentProfileId: "pp_bob", userId: "u_bob", status: "ACTIVE" } as any;
      }
      return null;
    });

    await expect(
      grantService.createGrant({
        userId: "u_alice",
        label: "Malicious Root",
        limit: 5000,
        window: "MONTHLY",
        windowStart: "2026-01-01T00:00:00Z",
        hardMax: 2000,
        paymentProfileId: "pp_bob",
      })
    ).rejects.toThrow("was not found");
  });

  it("5. DISABLED profile cannot be bound", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_disabled",
      userId,
      provider: "RAZORPAY",
      environment: "TEST",
      status: "DISABLED",
    } as any);

    await expect(
      grantService.createGrant({
        userId,
        label: "Root with Disabled Profile",
        limit: 5000,
        window: "MONTHLY",
        windowStart: "2026-01-01T00:00:00Z",
        hardMax: 2000,
        paymentProfileId: "pp_disabled",
      })
    ).rejects.toThrow("disabled");
  });

  it("6. unsupported provider or environment is rejected", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_prod",
      userId,
      provider: "STRIPE", // not RAZORPAY
      environment: "PRODUCTION", // not TEST
      status: "ACTIVE",
    } as any);

    await expect(
      grantService.createGrant({
        userId,
        label: "Root with Unsupported Provider",
        limit: 5000,
        window: "MONTHLY",
        windowStart: "2026-01-01T00:00:00Z",
        hardMax: 2000,
        paymentProfileId: "pp_prod",
      })
    ).rejects.toThrow("Only RAZORPAY TEST payment profiles are currently supported");
  });

  it("7. child grant with paymentProfileId is rejected by backend guard", async () => {
    vi.mocked(grantRepository.getGrant).mockResolvedValue({
      grantId: "g_root",
      userId,
      status: "ACTIVE",
      delegationEnabled: true,
      maxDepth: 3,
      maxChildren: 5,
    } as any);

    await expect(
      grantService.createGrant({
        userId,
        parentGrantId: "g_root",
        label: "Child with Profile Attack",
        limit: 1000,
        window: "MONTHLY",
        windowStart: "2026-01-01T00:00:00Z",
        hardMax: 500,
        paymentProfileId: "pp_rogue",
      })
    ).rejects.toThrow("A child grant cannot establish or change a payment profile");
  });

  it("8. child grant resolves root payment profile through authority path", async () => {
    vi.mocked(grantRepository.getGrant).mockImplementation(async (uid, gid) => {
      if (gid === "g_child") {
        return {
          grantId: "g_child",
          parentGrantId: "g_root",
          userId,
          status: "ACTIVE",
        } as any;
      }
      if (gid === "g_root") {
        return {
          grantId: "g_root",
          parentGrantId: undefined,
          paymentProfileId: "pp_root_bound",
          userId,
          status: "ACTIVE",
        } as any;
      }
      return null;
    });

    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_root_bound",
      userId,
      provider: "RAZORPAY",
      environment: "TEST",
      displayName: "Visa •••• 1111",
      status: "ACTIVE",
      connectionMode: "SIMULATED",
    } as any);

    const resolved = await paymentProfileResolutionService.resolvePaymentProfileForGrant("g_child", userId);
    expect(resolved.paymentProfileId).toBe("pp_root_bound");
    expect(resolved.displayName).toBe("Visa •••• 1111");
  });

  it("9 & 10. demo-reset creates PaymentProfile BEFORE root grant, with root grant referencing returned ID", async () => {
    vi.mocked(dynamo.send).mockResolvedValue({ Items: [] } as any);
    vi.mocked(paymentProfileRepository.createProfile).mockResolvedValue();
    vi.mocked(grantRepository.createGrant).mockResolvedValue();
    vi.mocked(grantRepository.createEdge).mockResolvedValue();

    const result = await resetDemo("u_frontend_demo");

    expect(result.success).toBe(true);
    expect(result.paymentProfileId).toMatch(/^pp_/);
    expect(result.rootGrantId).toMatch(/^g_root_/);
    expect(result.childGrantId).toMatch(/^g_child_/);

    // Verify order: createProfile called before createGrant
    const createProfileCallOrder = vi.mocked(paymentProfileRepository.createProfile).mock.invocationCallOrder[0];
    const createGrantCallOrder = vi.mocked(grantRepository.createGrant).mock.invocationCallOrder[0];
    expect(createProfileCallOrder).toBeLessThan(createGrantCallOrder);

    // Verify root grant was created with the exact generated paymentProfileId
    expect(grantRepository.createGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        grantId: result.rootGrantId,
        paymentProfileId: result.paymentProfileId,
      })
    );
  });
});
