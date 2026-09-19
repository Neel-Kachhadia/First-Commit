import { randomUUID } from "crypto";
import type { Request, Response } from "express";

import { grantService } from "../services/grant-service.js";
import { intentService } from "../services/intent-service.js";
import { categoryService } from "../services/category-service.js";
import { grantRepository } from "../store/grant-repository.js";
import type { VoiceAction, VoiceWorkflow } from "../services/groq-service.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ActionResult {
  actionId: string;
  type: VoiceAction["type"];
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  error?: string;
  output?: Record<string, unknown>;
}

type OutputMap = Map<string, Record<string, unknown>>;

// ─── Topological sort ──────────────────────────────────────────────────────────

function topoSort(actions: VoiceAction[]): VoiceAction[] {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const visited = new Set<string>();
  const result: VoiceAction[] = [];

  function visit(id: string, stack: Set<string>) {
    if (visited.has(id)) return;
    if (stack.has(id)) throw new Error(`Cyclic dependency detected at action ${id}`);
    const action = byId.get(id);
    if (!action) throw new Error(`Action ${id} referenced but not found in workflow`);
    stack.add(id);
    for (const dep of action.dependsOn) {
      visit(dep, stack);
    }
    stack.delete(id);
    visited.add(id);
    result.push(action);
  }

  for (const action of actions) visit(action.id, new Set());
  return result;
}

// ─── Action executors ──────────────────────────────────────────────────────────

async function executeCreateMandate(
  action: Extract<VoiceAction, { type: "CREATE_MANDATE" }>,
  userId: string
): Promise<Record<string, unknown>> {
  const { label, category, monthlyLimit, perTransactionCap, merchants, purpose, window, blockedCategories, blockedItems } = action.params;
  const categoryCode = category.toUpperCase().replace(/ & /g, "_").replace(/ \/ /g, "_").replace(/ /g, "_");
  const now = new Date().toISOString();

  const grant = await grantService.createGrant({
    userId,
    label,
    limit: monthlyLimit,
    hardMax: monthlyLimit,
    stepUpAbove: perTransactionCap,
    currency: "INR",
    window: ((window as string) as "TRANSACTION" | "DAILY" | "WEEKLY" | "MONTHLY") || "MONTHLY",
    windowStart: now,
    category: categoryCode,
    merchantAllow: merchants,
    blockedCategories: blockedCategories ?? [],
    blockedItems: blockedItems ?? [],
    delegationEnabled: true,
    evidence: {
      sourceProtocol: "VOICE_COMMAND",
      mandateRef: `voice-${(purpose || label).slice(0, 40)}`,
    },
  });

  return { grantId: grant.grantId };
}

async function executeCreateDelegation(
  action: Extract<VoiceAction, { type: "CREATE_DELEGATION" }>,
  userId: string,
  outputs: OutputMap
): Promise<Record<string, unknown>> {
  const { label, capacity, parentActionId } = action.params;
  let parentGrantId = outputs.get(parentActionId)?.grantId as string | undefined;

  // Fallback: look for any grantId produced so far
  if (!parentGrantId) {
    for (const [, out] of outputs) {
      if (out.grantId) {
        parentGrantId = out.grantId as string;
        break;
      }
    }
  }

  if (!parentGrantId) {
    throw new Error(
      `CREATE_DELEGATION: parent action ${parentActionId} did not produce a grantId.`
    );
  }

  // Fetch parent grant to inherit limits and merchant allowlist
  const parentGrant = parentGrantId ? await grantRepository.getGrant(userId, parentGrantId) : null;
  const now = new Date().toISOString();

  // Child hardMax cannot exceed parent's hardMax
  const parentHardMax = parentGrant?.hardMax ?? capacity;
  const hardMax = Math.min(capacity, parentHardMax);
  const parentStepUp = parentGrant?.stepUpAbove ?? Math.floor(hardMax * 0.5);
  const stepUpAbove = Math.min(parentStepUp, hardMax);

  const grant = await grantService.createGrant({
    userId,
    label,
    parentGrantId,
    limit: capacity,
    hardMax,
    stepUpAbove,
    currency: "INR",
    window: ((parentGrant?.window as string) as "TRANSACTION" | "DAILY" | "WEEKLY" | "MONTHLY") || "MONTHLY",
    windowStart: now,
    category: parentGrant?.category,
    merchantAllow: parentGrant?.merchantAllow ?? [],
    blockedCategories: parentGrant?.blockedCategories ?? [],
    blockedItems: parentGrant?.blockedItems ?? [],
    delegationEnabled: false,
    evidence: { sourceProtocol: "VOICE_COMMAND" },
  });

  return { grantId: grant.grantId };
}

async function executeStartAgent(
  action: Extract<VoiceAction, { type: "START_AGENT" }>,
  outputs: OutputMap
): Promise<Record<string, unknown>> {
  let grantId = outputs.get(action.params.agentActionId)?.grantId as string | undefined;

  // Fallback: find the most recent delegation or mandate output
  if (!grantId) {
    for (const [, out] of outputs) {
      if (out.grantId) grantId = out.grantId as string;
    }
  }

  if (!grantId) {
    throw new Error(
      `START_AGENT: referenced action ${action.params.agentActionId} did not produce a grantId.`
    );
  }
  return { grantId, agentStarted: true };
}

async function executeCreateOrder(
  action: Extract<VoiceAction, { type: "CREATE_ORDER" }>,
  userId: string,
  outputs: OutputMap
): Promise<Record<string, unknown>> {
  const { merchant, category, items, estimatedAmount, agentActionId } = action.params;

  // Resolve grantId: check direct output first
  let grantId: string | undefined;
  const directOutput = outputs.get(agentActionId);
  if (directOutput?.grantId) grantId = directOutput.grantId as string;

  // Otherwise pick the most specific grant created (agent-started or child delegation)
  if (!grantId) {
    const list = Array.from(outputs.values()).reverse();
    for (const out of list) {
      if (out.agentStarted && out.grantId) {
        grantId = out.grantId as string;
        break;
      }
      if (!grantId && out.grantId) {
        grantId = out.grantId as string;
      }
    }
  }

  if (!grantId) {
    throw new Error(
      `CREATE_ORDER: could not resolve grantId for agent action ${agentActionId}.`
    );
  }

  const categoryCode = category.toUpperCase().replace(/ & /g, "_").replace(/ \/ /g, "_").replace(/ /g, "_");
  const rawItems = items ?? [];
  const structuredItems = rawItems.map((it: any) =>
    typeof it === "string" ? { name: it } : { name: it.name, category: it.category }
  );
  const itemNames = structuredItems.map((it) => it.name);
  const description = itemNames.length > 0
    ? `Voice order: ${itemNames.join(", ")} from ${merchant}`
    : `Voice order from ${merchant}`;

  const { intent, decision } = await intentService.createIntent({
    userId,
    grantId,
    amount: estimatedAmount,
    currency: "INR",
    merchant: {
      merchantId: merchant.toLowerCase().replace(/\s+/g, "-"),
      name: merchant,
      category: categoryCode,
    },
    description,
    items: structuredItems,
    idempotencyKey: `voice-order-${randomUUID().slice(0, 8)}`,
    evidence: { sourceProtocol: "VOICE_COMMAND" },
  });

  return {
    intentId: intent.intentId,
    decision: decision.decision,
    reason: decision.reason,
    reasonCode: decision.reasonCode,
    blockedItem: (decision as any).blockedItem,
    blockedCategory: (decision as any).blockedCategory,
    matchedPolicy: (decision as any).matchedPolicy,
    providerStatus: (decision as any).providerStatus ?? "NOT_INVOKED",
    amount: intent.amount,
    merchant: intent.merchant,
  };
}

// ─── Main execute handler ──────────────────────────────────────────────────────

/**
 * POST /api/assistant/voice/execute
 *
 * Authenticated (behind cognitoAuthMiddleware).
 * Body: { workflow: VoiceWorkflow, confirmedActions: string[] }
 *
 * Executes confirmed actions in topological order, piping grantId/intentId
 * outputs between dependent steps. Returns per-action results.
 */
export async function executeVoiceWorkflowHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.sub;
  const workflow = req.body?.workflow as VoiceWorkflow | undefined;
  const confirmedActionIds: string[] = req.body?.confirmedActions ?? [];

  if (!workflow || !Array.isArray(workflow.actions) || workflow.actions.length === 0) {
    res.status(400).json({ success: false, error: "workflow with at least one action is required." });
    return;
  }

  if (!Array.isArray(confirmedActionIds) || confirmedActionIds.length === 0) {
    res.status(400).json({ success: false, error: "confirmedActions must be a non-empty array." });
    return;
  }

  const confirmedSet = new Set(confirmedActionIds);
  const actionsToRun = workflow.actions.filter((a) => confirmedSet.has(a.id));

  if (actionsToRun.length === 0) {
    res.status(400).json({ success: false, error: "No valid actions found matching confirmedActions." });
    return;
  }

  let ordered: VoiceAction[];
  try {
    ordered = topoSort(actionsToRun);
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to resolve action dependencies.",
    });
    return;
  }

  const results: ActionResult[] = [];
  const outputs: OutputMap = new Map();
  const failedDeps = new Set<string>();

  for (const action of ordered) {
    const blockedBy = action.dependsOn.find((dep) => failedDeps.has(dep));
    if (blockedBy) {
      results.push({ actionId: action.id, type: action.type, status: "SKIPPED", error: `Dependency ${blockedBy} failed.` });
      failedDeps.add(action.id);
      continue;
    }

    try {
      let output: Record<string, unknown>;
      switch (action.type) {
        case "CREATE_MANDATE":   output = await executeCreateMandate(action, userId); break;
        case "CREATE_DELEGATION": output = await executeCreateDelegation(action, userId, outputs); break;
        case "START_AGENT":      output = await executeStartAgent(action, outputs); break;
        case "CREATE_ORDER":     output = await executeCreateOrder(action, userId, outputs); break;
        default: throw new Error(`Unknown action type: ${(action as VoiceAction).type}`);
      }

      outputs.set(action.id, output);
      results.push({ actionId: action.id, type: action.type, status: "SUCCESS", output });

      console.log(JSON.stringify({
        event: "voice_action_executed",
        commandId: workflow.commandId,
        userId,
        actionId: action.id,
        type: action.type,
        output,
      }));
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      results.push({ actionId: action.id, type: action.type, status: "FAILED", error });
      failedDeps.add(action.id);
      console.error(`[VoiceWorkflowExecute] Action ${action.id} (${action.type}) failed:`, err);
    }
  }

  const succeeded = results.filter((r) => r.status === "SUCCESS").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;

  const overallStatus =
    failed === 0 && skipped === 0 ? "COMPLETED" :
    succeeded === 0 ? "FAILED" :
    "PARTIALLY_COMPLETED";

  res.status(200).json({
    success: overallStatus === "COMPLETED" || overallStatus === "PARTIALLY_COMPLETED",
    commandId: workflow.commandId,
    status: overallStatus,
    results,
    summary: { succeeded, failed, skipped },
  });
}
