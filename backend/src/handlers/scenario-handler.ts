import type { Request, Response } from "express";
import { randomUUID } from "crypto";

import { grantService } from "../services/grant-service.js";
import { intentService } from "../services/intent-service.js";
import { reservationRepository } from "../store/reservation-repository.js";
import { auditRepository } from "../store/audit-repository.js";


// ─── Scenario helpers ────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

async function makeRootGrant(userId: string, opts?: {
  limit?: number;
  hardMax?: number;
  maxDepth?: number;
  maxChildren?: number;
  expiresAt?: string;
}) {
  return grantService.createGrant({
    userId,
    label: "Scenario Root",
    limit: opts?.limit ?? 10000,
    hardMax: opts?.hardMax ?? 5000,
    window: "MONTHLY",
    windowStart: new Date().toISOString(),
    currency: "INR",
    delegationEnabled: true,
    maxDepth: opts?.maxDepth ?? 3,
    maxChildren: opts?.maxChildren ?? 5,
    expiresAt: opts?.expiresAt,
  });
}

async function makeChildGrant(
  userId: string,
  parentGrantId: string,
  opts?: { limit?: number; hardMax?: number; category?: string; expiresAt?: string; delegationEnabled?: boolean }
) {
  return grantService.createGrant({
    userId,
    label: "Scenario Child",
    parentGrantId,
    limit: opts?.limit ?? 3000,
    hardMax: opts?.hardMax ?? opts?.limit ?? 3000,
    window: "MONTHLY",
    windowStart: new Date().toISOString(),
    currency: "INR",
    category: opts?.category,
    delegationEnabled: opts?.delegationEnabled ?? false,
    maxDepth: 0,
    maxChildren: 0,
    expiresAt: opts?.expiresAt,
  });
}

async function fireIntent(userId: string, grantId: string, amount: number, category = "GENERAL") {
  return intentService.createIntent({
    userId,
    grantId,
    amount,
    merchant: {
      merchantId: uid("m"),
      name: "Scenario Merchant",
      category,
    },
    idempotencyKey: uid("idem"),
    description: "Scenario test intent",
  });
}

// ─── Scenario definitions ─────────────────────────────────────────────────────

const SCENARIOS: Record<
  string,
  (userId: string, trace: string[]) => Promise<Record<string, unknown>>
> = {
  /**
   * happy-path
   * Root → Shopping → Grocery, execute a passing payment.
   */
  "happy-path": async (userId, trace) => {
    trace.push("Creating root grant (₹10,000)");
    const root = await makeRootGrant(userId, { limit: 10000, hardMax: 5000 });

    trace.push("Creating shopping child grant (₹5,000)");
    const shopping = await makeChildGrant(userId, root.grantId, {
      limit: 5000,
      hardMax: 5000,
      delegationEnabled: true,
    });

    trace.push("Creating grocery grandchild grant (₹2,000)");
    const grocery = await makeChildGrant(userId, shopping.grantId, {
      limit: 2000,
      hardMax: 2000,
      category: "GROCERY",
    });

    trace.push("Firing ₹800 grocery intent → expect ALLOW + RESERVED");
    const result = await fireIntent(userId, grocery.grantId, 800, "GROCERY");

    return {
      scenario: "happy-path",
      rootGrantId: root.grantId,
      shoppingGrantId: shopping.grantId,
      groceryGrantId: grocery.grantId,
      decision: result.decision.decision,
      reasonCode: result.decision.reasonCode,
      reserved: result.decision.reserved,
      receiptHash: result.decision.receiptHash,
      trace,
    };
  },

  /**
   * budget-exceeded
   * Consume full budget, then attempt another.
   */
  "budget-exceeded": async (userId, trace) => {
    trace.push("Creating root grant (₹1,000 total)");
    const root = await makeRootGrant(userId, { limit: 1000, hardMax: 1000 });

    trace.push("Firing ₹900 intent → expect ALLOW + RESERVED");
    const first = await fireIntent(userId, root.grantId, 900);

    trace.push("Firing ₹200 intent against same grant → expect DENY (budget exceeded)");
    const second = await fireIntent(userId, root.grantId, 200);

    return {
      scenario: "budget-exceeded",
      rootGrantId: root.grantId,
      firstDecision: { decision: first.decision.decision, reasonCode: first.decision.reasonCode, reserved: first.decision.reserved },
      secondDecision: { decision: second.decision.decision, reasonCode: second.decision.reasonCode, reserved: second.decision.reserved },
      trace,
    };
  },

  /**
   * category-deny
   * Grocery grant, attempt with wrong category.
   */
  "category-deny": async (userId, trace) => {
    trace.push("Creating root grant");
    const root = await makeRootGrant(userId);

    trace.push("Creating GROCERY-scoped child grant");
    const grocery = await makeChildGrant(userId, root.grantId, { category: "GROCERY" });

    trace.push("Firing intent with category ELECTRONICS → expect SCOPE_DENIED");
    const result = await intentService.createIntent({
      userId,
      grantId: grocery.grantId,
      amount: 500,
      merchant: { merchantId: uid("m"), name: "Electronics Store", category: "ELECTRONICS" },
      idempotencyKey: uid("idem"),
    });

    return {
      scenario: "category-deny",
      grantCategory: "GROCERY",
      intentCategory: "ELECTRONICS",
      decision: result.decision.decision,
      reasonCode: result.decision.reasonCode,
      trace,
    };
  },

  /**
   * expired-grant
   * Grant with expiresAt in the past, attempt payment.
   */
  "expired-grant": async (userId, trace) => {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();

    trace.push(`Creating grant expired at ${oneSecondAgo}`);
    const root = await makeRootGrant(userId, { expiresAt: oneSecondAgo });

    trace.push("Firing intent → expect GRANT_EXPIRED");
    const result = await fireIntent(userId, root.grantId, 500);

    return {
      scenario: "expired-grant",
      expiresAt: oneSecondAgo,
      decision: result.decision.decision,
      reasonCode: result.decision.reasonCode,
      trace,
    };
  },

  /**
   * delegation-overflow
   * Try to create a grant at depth exceeding maxDepth.
   */
  "delegation-overflow": async (userId, trace) => {
    trace.push("Creating root grant with maxDepth=2");
    const root = await makeRootGrant(userId, { maxDepth: 2, maxChildren: 10 });

    trace.push("Creating depth-1 child (allowed)");
    const child1 = await makeChildGrant(userId, root.grantId, {
      delegationEnabled: true,
      limit: 3000,
    });

    trace.push("Creating depth-2 grandchild (allowed, at maxDepth)");
    const child2 = await makeChildGrant(userId, child1.grantId, {
      delegationEnabled: true,
      limit: 1000,
    });

    trace.push("Attempting depth-3 great-grandchild → expect MAX_DELEGATION_DEPTH_EXCEEDED");
    let depthError: string | null = null;
    try {
      await makeChildGrant(userId, child2.grantId, { limit: 500 });
    } catch (err: any) {
      depthError = err.code ?? err.message;
    }

    return {
      scenario: "delegation-overflow",
      maxDepth: 2,
      depth1GrantId: child1.grantId,
      depth2GrantId: child2.grantId,
      depth3Attempt: depthError ?? "unexpectedly succeeded",
      trace,
    };
  },

  /**
   * revocation
   * Create a tree, execute payment, then revoke ancestor.
   */
  "revocation": async (userId, trace) => {
    trace.push("Creating root → shopping → grocery hierarchy");
    const root = await makeRootGrant(userId, { maxDepth: 3, maxChildren: 5 });
    const shopping = await makeChildGrant(userId, root.grantId, {
      limit: 4000,
      hardMax: 4000,
      delegationEnabled: true,
    });
    const grocery = await makeChildGrant(userId, shopping.grantId, {
      limit: 2000,
      hardMax: 2000,
      category: "GROCERY",
    });

    trace.push("Firing successful ₹500 intent on grocery");
    const firstResult = await fireIntent(userId, grocery.grantId, 500, "GROCERY");

    trace.push("Revoking shopping grant (ancestor)");
    await grantService.revokeGrant(userId, shopping.grantId);

    trace.push("Firing ₹200 intent on grocery after ancestor revocation → expect GRANT_REVOKED");
    const secondResult = await fireIntent(userId, grocery.grantId, 200, "GROCERY");

    return {
      scenario: "revocation",
      revokedGrantId: shopping.grantId,
      beforeRevocation: {
        decision: firstResult.decision.decision,
        reasonCode: firstResult.decision.reasonCode,
        reserved: firstResult.decision.reserved,
      },
      afterRevocation: {
        decision: secondResult.decision.decision,
        reasonCode: secondResult.decision.reasonCode,
      },
      trace,
    };
  },

  /**
   * replay
   * Submit same idempotency key twice — must return original decision.
   */
  "replay": async (userId, trace) => {
    trace.push("Creating root grant");
    const root = await makeRootGrant(userId);
    const idemKey = uid("idem-replay");

    trace.push(`Submitting first intent with idempotencyKey=${idemKey}`);
    const first = await intentService.createIntent({
      userId,
      grantId: root.grantId,
      amount: 500,
      merchant: { merchantId: uid("m"), name: "Test Store", category: "GENERAL" },
      idempotencyKey: idemKey,
    });

    trace.push(`Submitting identical request with same idempotencyKey → expect replayed=true, same intentId`);
    const second = await intentService.createIntent({
      userId,
      grantId: root.grantId,
      amount: 500,
      merchant: { merchantId: uid("m"), name: "Test Store", category: "GENERAL" },
      idempotencyKey: idemKey,
    });

    return {
      scenario: "replay",
      firstIntentId: first.intent.intentId,
      secondIntentId: second.intent.intentId,
      sameIntent: first.intent.intentId === second.intent.intentId,
      firstReplayed: first.replayed,
      secondReplayed: second.replayed,
      trace,
    };
  },

  /**
   * max-children
   * Exhaust maxChildren, then attempt one more child.
   */
  "max-children": async (userId, trace) => {
    trace.push("Creating root grant with maxChildren=2");
    const root = await makeRootGrant(userId, { maxChildren: 2, maxDepth: 3 });

    trace.push("Creating child 1 (allowed)");
    await makeChildGrant(userId, root.grantId, { limit: 1000, hardMax: 1000 });

    trace.push("Creating child 2 (allowed, at limit)");
    await makeChildGrant(userId, root.grantId, { limit: 1000, hardMax: 1000 });

    trace.push("Attempting child 3 → expect MAX_DELEGATION_CHILDREN_EXCEEDED");
    let childrenError: string | null = null;
    try {
      await makeChildGrant(userId, root.grantId, { limit: 500, hardMax: 500 });
    } catch (err: any) {
      childrenError = err.code ?? err.message;
    }

    return {
      scenario: "max-children",
      maxChildren: 2,
      thirdChildAttempt: childrenError ?? "unexpectedly succeeded",
      trace,
    };
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function runScenarioHandler(
  req: Request,
  res: Response
): Promise<void> {
  const scenario = req.params.scenario as string;

  const fn = SCENARIOS[scenario];
  if (!fn) {
    res.status(404).json({
      error: `Unknown scenario "${scenario}".`,
      available: Object.keys(SCENARIOS),
    });
    return;
  }

  const trace: string[] = [];
  const startedAt = new Date().toISOString();

  // Use the authenticated user as the scenario owner — isolates seed data per tenant.
  const userId = req.user!.sub;

  try {
    const result = await fn(userId, trace);

    await auditRepository.logEvent(
      userId,
      "DEMO_SCENARIO_RUN",
      { scenario, result },
      userId
    );

    res.status(200).json({
      scenario,
      startedAt,
      completedAt: new Date().toISOString(),
      result,
    });
  } catch (err: any) {
    // Expected enforcement errors are part of the scenario demonstration.
    // Return 200 with the error details so judges can see structured results.
    const isEnforcementError = [
      "MAX_DELEGATION_DEPTH_EXCEEDED",
      "MAX_DELEGATION_CHILDREN_EXCEEDED",
      "GRANT_EXPIRED",
      "GRANT_REVOKED",
    ].includes(err.code);

    if (isEnforcementError) {
      await auditRepository.logEvent(
        userId,
        "DEMO_SCENARIO_RUN",
        { scenario, enforcement: err.code, trace },
        userId
      ).catch(() => {}); // don't let audit failure mask the result

      res.status(200).json({
        scenario,
        startedAt,
        completedAt: new Date().toISOString(),
        enforcementResult: {
          enforced: true,
          code: err.code,
          message: err.message,
        },
        trace,
      });
      return;
    }

    console.error(`[ScenarioHandler] ${scenario} failed unexpectedly:`, err.message);
    res.status(500).json({
      scenario,
      startedAt,
      error: err.message,
      code: err.code,
      trace,
    });
  }
}

export function listScenariosHandler(
  _req: Request,
  res: Response
): void {
  res.status(200).json({
    scenarios: Object.keys(SCENARIOS).map((key) => ({
      id: key,
      url: `/v0/demo/scenarios/${key}`,
    })),
  });
}
