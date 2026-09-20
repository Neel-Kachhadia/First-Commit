import { describe, it, expect, vi, beforeEach } from "vitest";
import { paymentProfileResolutionService } from "./payment-profile-resolution-service.js";
import { grantRepository } from "../store/grant-repository.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";

vi.mock("../store/grant-repository.js");
vi.mock("../store/payment-profile-repository.js");

describe("PaymentProfileResolutionService", () => {
  const userId = "u_test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the profile for a root mandate (Valid binding)", async () => {
    vi.mocked(grantRepository.getGrant).mockResolvedValue({
      grantId: "g_root",
      paymentProfileId: "pp_1",
      parentGrantId: undefined,
    } as any);

    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_1",
      provider: "RAZORPAY",
      environment: "TEST",
      status: "ACTIVE",
    } as any);

    const profile = await paymentProfileResolutionService.resolvePaymentProfileForGrant("g_root", userId);
    expect(profile.paymentProfileId).toBe("pp_1");
  });

  it("throws PAYMENT_PROFILE_NOT_CONFIGURED if root lacks profile", async () => {
    vi.mocked(grantRepository.getGrant).mockResolvedValue({
      grantId: "g_root",
      paymentProfileId: undefined,
      parentGrantId: undefined,
    } as any);

    await expect(paymentProfileResolutionService.resolvePaymentProfileForGrant("g_root", userId))
      .rejects.toThrow("Payment profile is not configured");
  });

  it("traverses up from a child grant to find the root's profile", async () => {
    vi.mocked(grantRepository.getGrant).mockImplementation(async (uid, gid) => {
      if (gid === "g_child") return { grantId: "g_child", parentGrantId: "g_root" } as any;
      if (gid === "g_root") return { grantId: "g_root", paymentProfileId: "pp_1" } as any;
      return null;
    });

    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_1",
      provider: "RAZORPAY",
      environment: "TEST",
      status: "ACTIVE",
    } as any);

    const profile = await paymentProfileResolutionService.resolvePaymentProfileForGrant("g_child", userId);
    expect(profile.paymentProfileId).toBe("pp_1");
  });

  it("throws PAYMENT_PROFILE_NOT_FOUND if profile doesn't exist", async () => {
    vi.mocked(grantRepository.getGrant).mockResolvedValue({
      grantId: "g_root",
      paymentProfileId: "pp_999",
    } as any);

    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue(null);

    await expect(paymentProfileResolutionService.resolvePaymentProfileForGrant("g_root", userId))
      .rejects.toThrow("was not found");
  });

  it("throws if profile is DISABLED", async () => {
    vi.mocked(grantRepository.getGrant).mockResolvedValue({
      grantId: "g_root",
      paymentProfileId: "pp_1",
    } as any);

    vi.mocked(paymentProfileRepository.getProfile).mockResolvedValue({
      paymentProfileId: "pp_1",
      provider: "RAZORPAY",
      environment: "TEST",
      status: "DISABLED",
    } as any);

    await expect(paymentProfileResolutionService.resolvePaymentProfileForGrant("g_root", userId))
      .rejects.toThrow("disabled");
  });
});
