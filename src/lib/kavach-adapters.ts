import type { Agent, LedgerEntry, ApprovalRequest, AgentStatus, LedgerStatus } from "./kavach-data";

export function grantToAgent(grant: any): Agent {
  let status: AgentStatus = "active";
  if (grant.status === "REVOKED") status = "revoked";
  else if (grant.consumed >= grant.limit) status = "exhausted";

  return {
    id: grant.grantId,
    name: grant.label || "Unnamed Grant",
    mandateId: grant.parentGrantId || "ROOT-MANDATE",
    purpose: "Backend-managed authority",
    status,
    consumed: grant.consumed || 0,
    issuedOn: grant.createdAt,
    rule: {
      monthlyLimit: grant.limit,
      perTransactionCap: grant.hardMax || 0,
      category: grant.category || "General",
      merchants: grant.merchantAllow || [],
      window: grant.window || "MONTHLY",
    },
  };
}

export function intentToLedgerEntry(intent: any): LedgerEntry {
  return {
    id: intent.intentId,
    agentId: intent.grantId,
    merchant: intent.merchant?.name || "Unknown Merchant",
    description: intent.description || "Transaction",
    amount: intent.amount || 0,
    status: intent.status || "PENDING",
    reason: intent.status === "STEP_UP_REQUIRED" 
      ? "Above the per-transaction cap — step-up approval required."
      : intent.status === "DENIED" 
        ? "Denied by authority rules" 
        : "Authorized",
    at: intent.createdAt,
  };
}

export function intentToApproval(intent: any): ApprovalRequest | null {
  if (intent.status !== "STEP_UP_REQUIRED") return null;

  return {
    id: intent.intentId,
    agentId: intent.grantId,
    ledgerId: intent.intentId,
    merchant: intent.merchant?.name || "Unknown Merchant",
    description: intent.description || "Transaction requires approval",
    amount: intent.amount || 0,
    reason: "Step-up threshold exceeded",
    requestedAt: intent.createdAt,
  };
}
