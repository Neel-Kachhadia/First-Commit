import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { DeleteCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { grantService } from "../services/grant-service.js";
import { intentService } from "../services/intent-service.js";

// ─── Cleanup Registry ────────────────────────────────────────────────────────
//
// Every resource created during a scenario run registers its exact DynamoDB
// key here. On completion (pass or fail), `cleanupScenarioState` deletes all
// of them so that the real dashboard user's state is never polluted.

interface DynamoKey {
  PK: string;
  SK: string;
}

interface CleanupRegistry {
  keys: DynamoKey[];
}

function mkRegistry(): CleanupRegistry {
  return { keys: [] };
}

function track(registry: CleanupRegistry, key: DynamoKey) {
  registry.keys.push(key);
}

/**
 * Delete all keys in the registry.
 *
 * Uses batched DeleteRequests (max 25 per call) and is fully idempotent —
 * DynamoDB silently ignores deletes of non-existent items.
 */
async function cleanupScenarioState(registry: CleanupRegistry): Promise<void> {
  const keys = registry.keys;
  if (keys.length === 0) return;

  for (let i = 0; i < keys.length; i += 25) {
    const batch = keys.slice(i, i + 25);
    try {
      await dynamo.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch.map((key) => ({
              DeleteRequest: { Key: key },
            })),
          },
        })
      );
    } catch (err) {
      // Best-effort cleanup: log but never let a cleanup failure mask the
      // scenario result or surface as a user-visible error.
      console.error("[ScenarioCleanup] batch delete error:", err);
    }
  }
}

// ─── Scenario helpers ─────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/**
 * Create a root grant under the isolated scenario namespace and register
 * all generated DynamoDB keys in the cleanup registry.
 */
async function makeRootGrant(
  scenarioUserId: string,
  registry: CleanupRegistry,
  opts?: {
    limit?: number;
    hardMax?: number;
    maxDepth?: number;
    maxChildren?: number;
    expiresAt?: string;
  }
) {
  const grant = await grantService.createGrant({
    userId: scenarioUserId,
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

  // PK: USER#<scenarioUserId>  SK: GRANT#<grantId>
  track(registry, {
    PK: `USER#${scenarioUserId}`,
    SK: `GRANT#${grant.grantId}`,
  });

  return grant;
}

/**
 * Create a child grant and register its grant record plus the parent→child
 * edge record.
 */
async function makeChildGrant(
  scenarioUserId: string,
  parentGrantId: string,
  registry: CleanupRegistry,
  opts?: {
    limit?: number;
    hardMax?: number;
    category?: string;
    expiresAt?: string;
    delegationEnabled?: boolean;
  }
) {
  const grant = await grantService.createGrant({
    userId: scenarioUserId,
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

  // Grant record
  track(registry, {
    PK: `USER#${scenarioUserId}`,
    SK: `GRANT#${grant.grantId}`,
  });

  // Parent → child edge record (stored on the parent's partition)
  track(registry, {
    PK: `GRANT#${parentGrantId}`,
    SK: `CHILD#${grant.grantId}`,
  });

  return grant;
}

/**
 * Fire a payment intent and register the intent record, its idempotency key
 * record, the reservation record, and the decision record.
 */
async function fireIntent(
  scenarioUserId: string,
  grantId: string,
  amount: number,
  registry: CleanupRegistry,
  category = "GENERAL"
) {
  const idempotencyKey = uid("idem");

  const result = await intentService.createIntent({
    userId: scenarioUserId,
    grantId,
    amount,
    merchant: {
      merchantId: uid("m"),
      name: "Scenario Merchant",
      category,
    },
    idempotencyKey,
    description: "Scenario test intent",
  });

  const intentId = result.intent.intentId;

  // Intent META record
  track(registry, { PK: `INTENT#${intentId}`, SK: "META" });

  // Idempotency key record
  track(registry, { PK: `IDEMPOTENCY#${idempotencyKey}`, SK: "INTENT" });

  // Reservation record (written on ALLOW decisions)
  if (result.decision.reserved) {
    track(registry, { PK: `INTENT#${intentId}`, SK: "RESERVATION" });
  }

  // Decision record (always written)
  if (result.decision.decisionId) {
    track(registry, {
      PK: `INTENT#${intentId}`,
      SK: `DECISION#${result.decision.decisionId}`,
    });
  }

  return result;
}

// ─── Scenario definitions ─────────────────────────────────────────────────────

const SCENARIOS: Record<
  string,
  (
    scenarioUserId: string,
    registry: CleanupRegistry,
    trace: string[]
  ) => Promise<Record<string, unknown>>
> = {
  /**
   * happy-path
   * Root → Shopping → Grocery, execute a passing payment.
   */
  "happy-path": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root grant (₹10,000)");
    const root = await makeRootGrant(scenarioUserId, registry, { limit: 10000, hardMax: 5000 });

    trace.push("Creating shopping child grant (₹5,000)");
    const shopping = await makeChildGrant(scenarioUserId, root.grantId, registry, {
      limit: 5000,
      hardMax: 5000,
      delegationEnabled: true,
    });

    trace.push("Creating grocery grandchild grant (₹2,000)");
    const grocery = await makeChildGrant(scenarioUserId, shopping.grantId, registry, {
      limit: 2000,
      hardMax: 2000,
      category: "GROCERY",
    });

    trace.push("Firing ₹800 grocery intent → expect ALLOW + RESERVED");
    const result = await fireIntent(scenarioUserId, grocery.grantId, 800, registry, "GROCERY");

    return {
      scenario: "happy-path",
      decision: result.decision.decision,
      reasonCode: result.decision.reasonCode,
      reserved: result.decision.reserved,
      trace,
    };
  },

  /**
   * budget-exceeded
   * Consume full budget, then attempt another.
   */
  "budget-exceeded": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root grant (₹1,000 total)");
    const root = await makeRootGrant(scenarioUserId, registry, { limit: 1000, hardMax: 1000 });

    trace.push("Firing ₹900 intent → expect ALLOW + RESERVED");
    const first = await fireIntent(scenarioUserId, root.grantId, 900, registry);

    trace.push("Firing ₹200 intent against same grant → expect DENY (budget exceeded)");
    const second = await fireIntent(scenarioUserId, root.grantId, 200, registry);

    return {
      scenario: "budget-exceeded",
      firstDecision: {
        decision: first.decision.decision,
        reasonCode: first.decision.reasonCode,
        reserved: first.decision.reserved,
      },
      secondDecision: {
        decision: second.decision.decision,
        reasonCode: second.decision.reasonCode,
        reserved: second.decision.reserved,
      },
      trace,
    };
  },

  /**
   * category-deny
   * Grocery grant, attempt with wrong category.
   */
  "category-deny": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root grant");
    const root = await makeRootGrant(scenarioUserId, registry);

    trace.push("Creating GROCERY-scoped child grant");
    const grocery = await makeChildGrant(scenarioUserId, root.grantId, registry, { category: "GROCERY" });

    trace.push("Firing intent with category ELECTRONICS → expect SCOPE_DENIED");
    const idempotencyKey = uid("idem");
    const result = await intentService.createIntent({
      userId: scenarioUserId,
      grantId: grocery.grantId,
      amount: 500,
      merchant: { merchantId: uid("m"), name: "Electronics Store", category: "ELECTRONICS" },
      idempotencyKey,
    });

    track(registry, { PK: `INTENT#${result.intent.intentId}`, SK: "META" });
    track(registry, { PK: `IDEMPOTENCY#${idempotencyKey}`, SK: "INTENT" });
    if (result.decision.decisionId) {
      track(registry, {
        PK: `INTENT#${result.intent.intentId}`,
        SK: `DECISION#${result.decision.decisionId}`,
      });
    }

    return {
      scenario: "category-deny",
      decision: result.decision.decision,
      reasonCode: result.decision.reasonCode,
      trace,
    };
  },

  /**
   * expired-grant
   * Grant with expiresAt in the past, attempt payment.
   */
  "expired-grant": async (scenarioUserId, registry, trace) => {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();

    trace.push(`Creating grant expired at ${oneSecondAgo}`);
    const root = await makeRootGrant(scenarioUserId, registry, { expiresAt: oneSecondAgo });

    trace.push("Firing intent → expect GRANT_EXPIRED");
    const result = await fireIntent(scenarioUserId, root.grantId, 500, registry);

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
  "delegation-overflow": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root grant with maxDepth=2");
    const root = await makeRootGrant(scenarioUserId, registry, { maxDepth: 2, maxChildren: 10 });

    trace.push("Creating depth-1 child (allowed)");
    const child1 = await makeChildGrant(scenarioUserId, root.grantId, registry, {
      delegationEnabled: true,
      limit: 3000,
    });

    trace.push("Creating depth-2 grandchild (allowed, at maxDepth)");
    const child2 = await makeChildGrant(scenarioUserId, child1.grantId, registry, {
      delegationEnabled: true,
      limit: 1000,
    });

    trace.push("Attempting depth-3 great-grandchild → expect MAX_DELEGATION_DEPTH_EXCEEDED");
    let depthError: string | null = null;
    try {
      await makeChildGrant(scenarioUserId, child2.grantId, registry, { limit: 500 });
    } catch (err: any) {
      depthError = err.code ?? err.message;
    }

    return {
      scenario: "delegation-overflow",
      depth3Attempt: depthError ?? "unexpectedly succeeded",
      trace,
    };
  },

  /**
   * revocation
   * Create a tree, execute payment, then revoke ancestor.
   */
  "revocation": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root → shopping → grocery hierarchy");
    const root = await makeRootGrant(scenarioUserId, registry, { maxDepth: 3, maxChildren: 5 });
    const shopping = await makeChildGrant(scenarioUserId, root.grantId, registry, {
      limit: 4000,
      hardMax: 4000,
      delegationEnabled: true,
    });
    const grocery = await makeChildGrant(scenarioUserId, shopping.grantId, registry, {
      limit: 2000,
      hardMax: 2000,
      category: "GROCERY",
    });

    trace.push("Firing successful ₹500 intent on grocery");
    const firstResult = await fireIntent(scenarioUserId, grocery.grantId, 500, registry, "GROCERY");

    trace.push("Revoking shopping grant (ancestor)");
    await grantService.revokeGrant(scenarioUserId, shopping.grantId);

    trace.push("Firing ₹200 intent on grocery after ancestor revocation → expect GRANT_REVOKED");
    const secondResult = await fireIntent(scenarioUserId, grocery.grantId, 200, registry, "GROCERY");

    return {
      scenario: "revocation",
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
  "replay": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root grant");
    const root = await makeRootGrant(scenarioUserId, registry);
    const idemKey = uid("idem-replay");

    trace.push(`Submitting first intent with idempotencyKey=${idemKey}`);
    const first = await intentService.createIntent({
      userId: scenarioUserId,
      grantId: root.grantId,
      amount: 500,
      merchant: { merchantId: uid("m"), name: "Test Store", category: "GENERAL" },
      idempotencyKey: idemKey,
    });
    track(registry, { PK: `INTENT#${first.intent.intentId}`, SK: "META" });
    track(registry, { PK: `IDEMPOTENCY#${idemKey}`, SK: "INTENT" });
    if (first.decision.reserved) {
      track(registry, { PK: `INTENT#${first.intent.intentId}`, SK: "RESERVATION" });
    }
    if (first.decision.decisionId) {
      track(registry, {
        PK: `INTENT#${first.intent.intentId}`,
        SK: `DECISION#${first.decision.decisionId}`,
      });
    }

    trace.push("Submitting identical request with same idempotencyKey → expect replayed=true, same intentId");
    const second = await intentService.createIntent({
      userId: scenarioUserId,
      grantId: root.grantId,
      amount: 500,
      merchant: { merchantId: uid("m"), name: "Test Store", category: "GENERAL" },
      idempotencyKey: idemKey,
    });
    // The replayed request re-uses the same INTENT# and IDEMPOTENCY# records,
    // so no extra keys need to be tracked.

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
  "max-children": async (scenarioUserId, registry, trace) => {
    trace.push("Creating root grant with maxChildren=2");
    const root = await makeRootGrant(scenarioUserId, registry, { maxChildren: 2, maxDepth: 3 });

    trace.push("Creating child 1 (allowed)");
    await makeChildGrant(scenarioUserId, root.grantId, registry, { limit: 1000, hardMax: 1000 });

    trace.push("Creating child 2 (allowed, at limit)");
    await makeChildGrant(scenarioUserId, root.grantId, registry, { limit: 1000, hardMax: 1000 });

    trace.push("Attempting child 3 → expect MAX_DELEGATION_CHILDREN_EXCEEDED");
    let childrenError: string | null = null;
    try {
      await makeChildGrant(scenarioUserId, root.grantId, registry, { limit: 500, hardMax: 500 });
    } catch (err: any) {
      childrenError = err.code ?? err.message;
    }

    return {
      scenario: "max-children",
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

  // Generate a unique namespace for this run.
  // The authenticated dashboard user is NEVER used as the scenario subject.
  const runId = `${Date.now()}_${randomUUID()}`;
  const SCENARIO_USER_ID = `attack_lab_${runId}`;

  const registry = mkRegistry();
  const trace: string[] = [];
  const startedAt = new Date().toISOString();

  try {
    const result = await fn(SCENARIO_USER_ID, registry, trace);

    res.status(200).json({
      scenario,
      startedAt,
      completedAt: new Date().toISOString(),
      result,
    });
  } catch (err: any) {
    // Expected enforcement errors are part of the scenario demonstration.
    // Return 200 with structured error details for frontend evaluation.
    const isEnforcementError = [
      "MAX_DELEGATION_DEPTH_EXCEEDED",
      "MAX_DELEGATION_CHILDREN_EXCEEDED",
      "GRANT_EXPIRED",
      "GRANT_REVOKED",
    ].includes(err.code);

    if (isEnforcementError) {
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
  } finally {
    // Always clean up the synthetic run namespace — even if the scenario
    // threw an unexpected error partway through.
    await cleanupScenarioState(registry);
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
