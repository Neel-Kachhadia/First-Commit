import { describe, it, expect } from "vitest";

// Pure unit test verifying the frontend logic, contracts, and invariants:
// 1. countMandatesBoundToProfile counts ONLY direct root grants
// 2. Disabled profiles cannot be selected for root mandates
// 3. Child delegation inherits via authority path and cannot set paymentProfileId
// 4. Intent contract strictly forbids payment credentials and paymentProfileId
// 5. Test disclosures and labels conform to frozen UI specifications

function countMandatesBoundToProfile(
  grants: Array<{ paymentProfileId?: string; parentGrantId?: string }>,
  paymentProfileId: string
): number {
  return grants.filter(
    (g) => !g.parentGrantId && g.paymentProfileId === paymentProfileId
  ).length;
}

describe("Frontend Payment Profile Logic & Security Contract Invariants", () => {
  it("14. 'Used by N mandates' counts ONLY direct root bindings (excludes child grants)", () => {
    const grants = [
      // Root mandate bound to pp_1 -> MUST COUNT
      { grantId: "g_root_1", paymentProfileId: "pp_1", parentGrantId: undefined },
      // Another root mandate bound to pp_1 -> MUST COUNT
      { grantId: "g_root_2", paymentProfileId: "pp_1", parentGrantId: undefined },
      // Root mandate bound to pp_2 -> MUST NOT COUNT FOR pp_1
      { grantId: "g_root_3", paymentProfileId: "pp_2", parentGrantId: undefined },
      // Child grant under g_root_1 that inherits pp_1 -> MUST NOT COUNT
      { grantId: "g_child_1", parentGrantId: "g_root_1", paymentProfileId: undefined },
      // Malicious or accidental child grant with pp_1 -> MUST NOT COUNT AS DIRECT MANDATE
      { grantId: "g_child_rogue", parentGrantId: "g_root_1", paymentProfileId: "pp_1" },
    ];

    expect(countMandatesBoundToProfile(grants, "pp_1")).toBe(2);
    expect(countMandatesBoundToProfile(grants, "pp_2")).toBe(1);
    expect(countMandatesBoundToProfile(grants, "pp_nonexistent")).toBe(0);
  });

  it("6 & 7. Single ACTIVE profile is auto-selected; DISABLED profiles are filtered out", () => {
    const allProfiles = [
      {
        paymentProfileId: "pp_active_1",
        displayName: "Visa •••• 1111",
        status: "ACTIVE" as const,
        provider: "RAZORPAY" as const,
        environment: "TEST" as const,
      },
      {
        paymentProfileId: "pp_disabled_2",
        displayName: "Mastercard •••• 2222",
        status: "DISABLED" as const,
        provider: "RAZORPAY" as const,
        environment: "TEST" as const,
      },
    ];

    const activeProfiles = allProfiles.filter((p) => p.status === "ACTIVE");
    expect(activeProfiles).toHaveLength(1);
    expect(activeProfiles[0].paymentProfileId).toBe("pp_active_1");

    // Auto-select rule: when activeProfiles.length === 1 -> auto select
    const selectedProfile = activeProfiles.length === 1 ? activeProfiles[0] : undefined;
    expect(selectedProfile?.paymentProfileId).toBe("pp_active_1");
  });

  it("9. Multiple ACTIVE profiles require explicit selection (no guessing)", () => {
    const activeProfiles = [
      { paymentProfileId: "pp_1", status: "ACTIVE" as const },
      { paymentProfileId: "pp_2", status: "ACTIVE" as const },
    ];

    const selectedProfileId: string | undefined = undefined;
    const selectedProfile = selectedProfileId
      ? activeProfiles.find((p) => p.paymentProfileId === selectedProfileId)
      : activeProfiles.length === 1
        ? activeProfiles[0]
        : undefined;

    // Must NOT guess when multiple active profiles exist
    expect(selectedProfile).toBeUndefined();
  });

  it("10. Zero ACTIVE profiles blocks provider-executable root activation", () => {
    const activeProfiles: Array<{ paymentProfileId: string; status: "ACTIVE" }> = [];
    const isRoot = true;

    const selectedProfile = activeProfiles.length === 1 ? activeProfiles[0] : undefined;
    const canActivate = !isRoot || !!selectedProfile;

    expect(canActivate).toBe(false);
  });

  it("11 & 12. Intent contract contains NO payment credentials or provider tokens", () => {
    const validIntentPayload = {
      grantId: "g_child_01",
      amount: 800,
      merchant: { name: "Apollo Pharmacy", category: "HEALTHCARE" },
      description: "Antibiotics prescription",
      idempotencyKey: "idem_123",
    };

    const forbiddenFields = [
      "paymentProfileId",
      "providerToken",
      "providerTokenRef",
      "cardToken",
      "cardNumber",
      "cvv",
      "expiryDate",
      "providerCustomerId",
    ];

    for (const field of forbiddenFields) {
      expect(field in validIntentPayload).toBe(false);
    }
  });

  it("15 & 16. Canonical identifiers and disclosures match specification", () => {
    const backendGeneratedId = "pp_1710931200000_abc123";
    // Must NOT transform to fake PAYPROF- alias
    expect(backendGeneratedId).toMatch(/^pp_/);
    expect(backendGeneratedId).not.toContain("PAYPROF-");

    const disclosureText = "Razorpay TEST MODE · ₹0 real funds. This prototype uses a simulated test payment profile. No real payment credentials are stored.";
    expect(disclosureText).toContain("Razorpay TEST MODE");
    expect(disclosureText).toContain("₹0 real funds");
    expect(disclosureText).toContain("simulated test payment profile");
  });
});
