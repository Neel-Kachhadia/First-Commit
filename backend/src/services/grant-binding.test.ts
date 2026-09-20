import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantService } from "./grant-service.js";
import { grantRepository } from "../store/grant-repository.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";

// Mock external dependencies to just test logic
vi.mock("../store/grant-repository.js");
vi.mock("../store/payment-profile-repository.js");
vi.mock("../store/audit-repository.js");

describe("Batch 2: Mandate Binding Rules", () => {
  const userId = "u_test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Rule 1: Valid binding for root mandate succeeds", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      status: "ACTIVE", provider: "RAZORPAY", environment: "TEST"
    } as any);
    
    vi.mocked(grantRepository.createGrant).mockResolvedValue();

    const grant = await grantService.createGrant({
      userId,
      label: "Root Mandate",
      limit: 1000,
      window: "MONTHLY",
      windowStart: "2026-01-01T00:00:00Z",
      hardMax: 500,
      paymentProfileId: "pp_valid"
    });

    expect(grant.paymentProfileId).toBe("pp_valid");
  });

  it("Rule 2: Creation with non-existent profile rejects", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue(null);

    await expect(grantService.createGrant({
      userId,
      label: "Root Mandate",
      limit: 1000,
      window: "MONTHLY",
      windowStart: "2026-01-01T00:00:00Z",
      hardMax: 500,
      paymentProfileId: "pp_not_found"
    })).rejects.toThrow("was not found");
  });

  it("Rule 4: Disabled profile rejects", async () => {
    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      status: "DISABLED", provider: "RAZORPAY", environment: "TEST"
    } as any);

    await expect(grantService.createGrant({
      userId,
      label: "Root Mandate",
      limit: 1000,
      window: "MONTHLY",
      windowStart: "2026-01-01T00:00:00Z",
      hardMax: 500,
      paymentProfileId: "pp_disabled"
    })).rejects.toThrow("disabled");
  });

  it("Rule 5: Child cannot switch profile", async () => {
    vi.mocked(grantRepository.getGrant).mockResolvedValue({
      grantId: "g_parent", status: "ACTIVE", delegationEnabled: true, maxDepth: 2, maxChildren: 2, limit: 2000, consumed: 0
    } as any);
    
    vi.mocked(grantRepository.listChildren).mockResolvedValue([]);

    await expect(grantService.createGrant({
      userId,
      parentGrantId: "g_parent",
      label: "Child Mandate",
      limit: 1000,
      window: "MONTHLY",
      windowStart: "2026-01-01T00:00:00Z",
      hardMax: 500,
      paymentProfileId: "pp_other"
    })).rejects.toThrow("child grant cannot establish");
  });

  it("Rule 9: Existing grant without Payment Profile remains valid", async () => {
    vi.mocked(grantRepository.createGrant).mockResolvedValue();

    const grant = await grantService.createGrant({
      userId,
      label: "Root Mandate No Profile",
      limit: 1000,
      window: "MONTHLY",
      windowStart: "2026-01-01T00:00:00Z",
      hardMax: 500,
    });

    expect(grant.paymentProfileId).toBeUndefined();
  });
});
