import { describe, expect, it } from "vitest";
import { authorityEngine } from "./authority-engine.js";
import type { Grant } from "../store/grant-repository.js";
import type { Intent } from "../models/intent.js";

function makeGrant(overrides: Partial<Grant> = {}): Grant {
  return {
    grantId: "g_retail",
    userId: "u_demo",
    label: "Retail Agent",
    currency: "INR",
    limit: 10000,
    consumed: 0,
    window: "WEEKLY",
    windowStart: "2026-09-14T00:00:00.000Z",
    stepUpAbove: 5000,
    hardMax: 10000,
    category: "HOUSEHOLD_SUPPLIES",
    merchantAllow: ["amazon", "zepto", "blinkit", "flipkart"],
    delegationEnabled: true,
    maxDepth: 2,
    maxChildren: 5,
    status: "ACTIVE",
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    blockedCategories: ["ALCOHOL"],
    blockedItems: [],
    ...overrides,
  };
}

function makeIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    intentId: "i_test_001",
    userId: "u_demo",
    grantId: "g_retail",
    amount: 1500,
    currency: "INR",
    merchant: {
      merchantId: "zepto",
      name: "Zepto",
      category: "HOUSEHOLD_SUPPLIES",
    },
    description: "Weekly household restocking",
    idempotencyKey: "idem_test_001",
    status: "PENDING",
    createdAt: "2026-09-19T10:00:00.000Z",
    ...overrides,
  };
}

describe("Item-Level Enforcement Guarantee", () => {
  it("strictly DENIES intent when items contain an explicitly blocked category (ALCOHOL)", async () => {
    const grant = makeGrant({
      blockedCategories: ["ALCOHOL"],
    });

    const intent = makeIntent({
      amount: 1500,
      items: [
        { name: "Notebooks", amount: 200 },
        { name: "Diaries", amount: 300 },
        { name: "Earphones", amount: 800 },
        { name: "Alcohol", category: "ALCOHOL", amount: 200 },
      ],
    });

    const decision = await authorityEngine.evaluate(intent, [grant]);

    expect(decision.decision).toBe("DENY");
    expect(decision.reasonCode).toBe("ITEM_BLOCKED");
    expect(decision.blockedCategory).toBe("ALCOHOL");
    expect(decision.providerStatus).toBe("NOT_INVOKED");
    expect(decision.reserved).toBe(false);
  });

  it("strictly DENIES intent when item name matches category keyword (e.g. beer/wine) under blockedCategories", async () => {
    const grant = makeGrant({
      blockedCategories: ["ALCOHOL"],
    });

    const intent = makeIntent({
      amount: 800,
      description: "Craft beer six pack",
      items: [
        { name: "Craft Beer" },
      ],
    });

    const decision = await authorityEngine.evaluate(intent, [grant]);

    expect(decision.decision).toBe("DENY");
    expect(decision.reasonCode).toBe("ITEM_BLOCKED");
    expect(decision.providerStatus).toBe("NOT_INVOKED");
    expect(decision.reserved).toBe(false);
  });

  it("strictly DENIES intent when matching an explicitly blocked item SKU", async () => {
    const grant = makeGrant({
      blockedCategories: [],
      blockedItems: ["gift card", "lottery"],
    });

    const intent = makeIntent({
      amount: 500,
      items: [
        { name: "Amazon Gift Card 500 INR" },
      ],
    });

    const decision = await authorityEngine.evaluate(intent, [grant]);

    expect(decision.decision).toBe("DENY");
    expect(decision.reasonCode).toBe("ITEM_BLOCKED");
    expect(decision.blockedItem).toBe("Amazon Gift Card 500 INR");
    expect(decision.providerStatus).toBe("NOT_INVOKED");
    expect(decision.reserved).toBe(false);
  });

  it("ALLOWS valid intent below threshold with no prohibited items", async () => {
    const grant = makeGrant({
      blockedCategories: ["ALCOHOL"],
      blockedItems: ["lottery"],
    });

    const intent = makeIntent({
      amount: 1500, // Below 5000 automatic threshold
      items: [
        { name: "Notebooks", amount: 300 },
        { name: "Diaries", amount: 400 },
        { name: "Earphones", amount: 800 },
      ],
    });

    const decision = await authorityEngine.evaluate(intent, [grant]);

    expect(decision.decision).toBe("ALLOW");
    expect(decision.reasonCode).toBe("AUTHORIZED");
    expect(decision.blockedCategory).toBeUndefined();
    expect(decision.blockedItem).toBeUndefined();
  });

  it("requires STEP_UP for valid items above automatic cap but within weekly limit", async () => {
    const grant = makeGrant({
      blockedCategories: ["ALCOHOL"],
    });

    const intent = makeIntent({
      amount: 6500, // > 5000 automatic threshold, < 10000 limit
      items: [
        { name: "Household Essentials", amount: 6500 },
      ],
    });

    const decision = await authorityEngine.evaluate(intent, [grant]);

    expect(decision.decision).toBe("STEP_UP");
    expect(decision.reasonCode).toBe("STEP_UP_REQUIRED");
  });

  it("DENIES if intent exceeds absolute weekly limit", async () => {
    const grant = makeGrant({
      blockedCategories: ["ALCOHOL"],
    });

    const intent = makeIntent({
      amount: 12000, // > 10000 limit
      items: [
        { name: "Household Bulk Supplies", amount: 12000 },
      ],
    });

    const decision = await authorityEngine.evaluate(intent, [grant]);

    expect(decision.decision).toBe("DENY");
    expect(decision.reasonCode).toBe("EFFECTIVE_CAPACITY_EXCEEDED");
  });
});
