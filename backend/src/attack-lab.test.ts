import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";

// Load environment variables for the AWS SDK to find DynamoDB (e.g., AWS_REGION, DYNAMODB_TABLE_NAME)
dotenv.config();

import { intentService } from "./services/intent-service.js";
import { grantService } from "./services/grant-service.js";
import { grantRepository } from "./store/grant-repository.js";

const generateSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("Attack Lab - Concurrency & Invariants", () => {
  const userId = `u_attack_${generateSuffix()}`;

  it("TEST 1: The Atomic Limit Wall", async () => {
    const suffix = generateSuffix();
    const grantLabel = `AttackGrant_${suffix}`;
    
    const grant = await grantService.createGrant({
      userId,
      label: grantLabel,
      limit: 1000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: 500
    });

    // Fire 10 concurrent intent creation requests, each for 200
    const promises = Array.from({ length: 10 }).map((_, i) =>
      intentService.createIntent({
        userId,
        grantId: grant.grantId,
        amount: 200,
        merchant: {
          merchantId: "m_test",
          name: "Test Merchant",
          category: "shopping"
        },
        idempotencyKey: `attack_idem_1_${suffix}_${i}`,
      })
    );

    const results = await Promise.all(promises);

    const reserved = results.filter(r => r.intent.status === "RESERVED");
    const denied = results.filter(r => r.intent.status === "DENIED");

    // Assertion: exactly 5 succeed, 5 fail
    expect(reserved).toHaveLength(5);
    expect(denied).toHaveLength(5);

    const finalGrant = await grantRepository.getGrant(userId, grant.grantId);
    
    // Assertion: consumed exactly 1000
    expect(finalGrant?.consumed).toBe(1000);
  });

  it("TEST 2: Concurrent Revocation Closure", async () => {
    const suffix = generateSuffix();
    
    const parentGrant = await grantService.createGrant({
      userId,
      label: `Parent_${suffix}`,
      limit: 5000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: 2000,
      delegationEnabled: true
    });

    const childGrant = await grantService.createGrant({
      userId,
      label: `Child_${suffix}`,
      limit: 2000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: 500,
      parentGrantId: parentGrant.grantId
    });

    // Revoke parent grant
    await grantService.revokeGrant(userId, parentGrant.grantId);

    // Fire 10 concurrent requests on child
    const promises = Array.from({ length: 10 }).map((_, i) =>
      intentService.createIntent({
        userId,
        grantId: childGrant.grantId,
        amount: 100,
        merchant: {
          merchantId: "m_test",
          name: "Test Merchant",
          category: "shopping"
        },
        idempotencyKey: `attack_idem_2_${suffix}_${i}`,
      })
    );

    const results = await Promise.all(promises);

    const denied = results.filter(r => r.intent.status === "DENIED");
    const reserved = results.filter(r => r.intent.status === "RESERVED");

    // Assertion: exactly 10 denied, 0 reserved
    expect(denied).toHaveLength(10);
    expect(reserved).toHaveLength(0);

    const reasons = new Set(results.map(r => r.decision.reasonCode));
    expect(reasons.has("GRANT_REVOKED")).toBe(true);
  });

  it("TEST 3: Idempotency Lock Collision", async () => {
    const suffix = generateSuffix();
    
    const grant = await grantService.createGrant({
      userId,
      label: `IdemGrant_${suffix}`,
      limit: 5000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      hardMax: 500
    });

    const idempotencyKey = `idem_lock_${suffix}`;

    // 100 concurrent requests with the SAME idempotency key
    const promises = Array.from({ length: 100 }).map(() =>
      intentService.createIntent({
        userId,
        grantId: grant.grantId,
        amount: 200,
        merchant: {
          merchantId: "m_test",
          name: "Test Merchant",
          category: "shopping"
        },
        idempotencyKey,
      }).catch(err => {
        console.error("Test 3 Error:", err);
        return null;
      })
    );

    const results = (await Promise.all(promises)).filter(r => r !== null) as any[];

    const original = results.filter(r => r.replayed === false);
    const replays = results.filter(r => r.replayed === true);

    // Assertion: exactly 1 creates a reservation, 99 hit idempotency lock
    expect(original).toHaveLength(1);
    expect(replays).toHaveLength(99);

    const finalGrant = await grantRepository.getGrant(userId, grant.grantId);
    
    // Assertion: consumed exactly 200 (only one successful creation/reservation)
    expect(finalGrant?.consumed).toBe(200);

    const intentIds = new Set(results.map(r => r.intent.intentId));
    
    // Assertion: all 100 calls converged on the same intent ID
    expect(intentIds.size).toBe(1);
  });
});

// ─── Delegation Invariant Tests ────────────────────────────────────────────────

import { assertTransition } from "./engine/intent-state-machine.js";

describe("Delegation Invariants", () => {
  const userId = `u_deleg_${generateSuffix()}`;

  it("TEST 4: maxDepth — rejects grant creation beyond depth limit", async () => {
    const root = await grantService.createGrant({
      userId,
      label: "Root",
      limit: 10000,
      hardMax: 5000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      delegationEnabled: true,
      maxDepth: 2,
      maxChildren: 10,
    });

    const child1 = await grantService.createGrant({
      userId,
      label: "Child 1",
      parentGrantId: root.grantId,
      limit: 4000,
      hardMax: 4000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      delegationEnabled: true,
      maxDepth: 0,
      maxChildren: 0,
    });

    // Attempting depth 3 (root=1, child1=2, child2=3) should fail
    await expect(
      grantService.createGrant({
        userId,
        label: "Child 2 (too deep)",
        parentGrantId: child1.grantId,
        limit: 1000,
        hardMax: 1000,
        window: "MONTHLY",
        windowStart: new Date().toISOString(),
        delegationEnabled: false,
        maxDepth: 0,
        maxChildren: 0,
      })
    ).rejects.toThrow(/MAX_DELEGATION_DEPTH_EXCEEDED|depth limit exceeded/i);
  });

  it("TEST 5: maxChildren — rejects excess child grants on parent", async () => {
    const root = await grantService.createGrant({
      userId,
      label: "Root",
      limit: 10000,
      hardMax: 5000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      delegationEnabled: true,
      maxDepth: 3,
      maxChildren: 2,
    });

    const makeChild = () =>
      grantService.createGrant({
        userId,
        label: "Child",
        parentGrantId: root.grantId,
        limit: 500,
        hardMax: 500,
        window: "MONTHLY",
        windowStart: new Date().toISOString(),
        delegationEnabled: false,
        maxDepth: 0,
        maxChildren: 0,
      });

    await makeChild(); // child 1
    await makeChild(); // child 2

    // Third child must be rejected
    await expect(makeChild()).rejects.toThrow(
      /MAX_DELEGATION_CHILDREN_EXCEEDED|children limit exceeded/i
    );
  });

  it("TEST 6: expired grant — authority engine returns GRANT_EXPIRED", async () => {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();

    const expired = await grantService.createGrant({
      userId,
      label: "Expired Grant",
      limit: 5000,
      hardMax: 5000,
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      delegationEnabled: false,
      maxDepth: 0,
      maxChildren: 0,
      expiresAt: oneSecondAgo,
    });

    const result = await intentService.createIntent({
      userId,
      grantId: expired.grantId,
      amount: 100,
      merchant: { merchantId: "m_exp", name: "Test", category: "GENERAL" },
      idempotencyKey: `exp_${generateSuffix()}`,
    });

    expect(result.decision.decision).toBe("DENY");
    expect(result.decision.reasonCode).toBe("GRANT_EXPIRED");
    expect(result.decision.reserved).toBe(false);
  });
});

// ─── State Machine Invariant Tests ─────────────────────────────────────────────

describe("Intent State Machine Invariants", () => {
  it("TEST 7: rejects invalid terminal transitions", () => {
    expect(() => assertTransition("EXECUTED", "RESERVED")).toThrow(
      /Invalid intent state transition/
    );
    expect(() => assertTransition("DENIED", "RESERVED")).toThrow(
      /Invalid intent state transition/
    );
    expect(() => assertTransition("EXECUTED", "PENDING")).toThrow(
      /Invalid intent state transition/
    );
  });

  it("TEST 8: accepts valid transitions", () => {
    expect(() => assertTransition("PENDING", "RESERVED")).not.toThrow();
    expect(() => assertTransition("PENDING", "STEP_UP_REQUIRED")).not.toThrow();
    expect(() => assertTransition("RESERVED", "PAYMENT_CREATED")).not.toThrow();
    expect(() => assertTransition("PAYMENT_CREATED", "EXECUTED")).not.toThrow();
    expect(() => assertTransition("PAYMENT_CREATED", "FAILED")).not.toThrow();
  });
});
