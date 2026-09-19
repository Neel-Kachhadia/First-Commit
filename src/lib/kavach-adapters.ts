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
      perTransactionCap: (grant.stepUpAbove != null && grant.stepUpAbove > 0) ? grant.stepUpAbove : (grant.hardMax || 0),
      category: grant.category || "General",
      merchants: grant.merchantAllow || [],
      window: grant.window || "MONTHLY",
      blockedCategories: grant.blockedCategories || [],
      blockedItems: grant.blockedItems || [],
    },
  };
}

export function intentToLedgerEntry(intent: any): LedgerEntry {
  let status: LedgerStatus = "PENDING";
  const rawStatus = String(intent.status || "").toUpperCase();

  if (
    rawStatus === "RESERVED" ||
    rawStatus === "APPROVED" ||
    rawStatus === "EXECUTED" ||
    rawStatus === "PAYMENT_CREATED" ||
    rawStatus === "ALLOW" ||
    rawStatus === "ALLOWED"
  ) {
    status = "APPROVED";
  } else if (
    rawStatus === "STEP_UP_REQUIRED" ||
    rawStatus === "STEP_UP"
  ) {
    status = "STEP_UP_REQUIRED";
  } else if (
    rawStatus === "DENIED" ||
    rawStatus === "DENY" ||
    rawStatus === "REVOKED" ||
    rawStatus === "FAILED"
  ) {
    status = "DENIED";
  } else {
    status = "PENDING";
  }

  let executionStatus: import("./kavach-data").ProviderExecutionStatus = "NOT_INVOKED";
  if (rawStatus === "EXECUTED" || rawStatus === "PAYMENT_CAPTURED" || rawStatus === "PROVIDER_CAPTURED") {
    executionStatus = "PROVIDER_CAPTURED";
  } else if (rawStatus === "RESERVED" || rawStatus === "PAYMENT_CREATED" || rawStatus === "SUBMITTED_TO_PROVIDER") {
    executionStatus = "SUBMITTED_TO_PROVIDER";
  } else if (rawStatus === "FAILED" || rawStatus === "PROVIDER_FAILED") {
    executionStatus = "PROVIDER_FAILED";
  } else if (rawStatus === "PROVIDER_PENDING") {
    executionStatus = "PROVIDER_PENDING";
  }

  // The backend response is the source of truth. We use available fields.
  const execution: import("./kavach-data").ProviderExecution | undefined = (status === "APPROVED" || status === "STEP_UP_REQUIRED") ? {
    provider: "RAZORPAY",
    environment: "TEST_MODE",
    orderId: intent.orderId || intent.providerOrderId || undefined,
    paymentId: intent.paymentId || intent.providerPaymentId || undefined,
    status: executionStatus,
    webhookVerified: intent.webhookVerified || false,
  } : {
    provider: "RAZORPAY",
    environment: "TEST_MODE",
    status: "NOT_INVOKED",
  };

  return {
    id: intent.intentId,
    agentId: intent.grantId,
    merchant: intent.merchant?.name || "Unknown Merchant",
    description: intent.description || "Transaction",
    amount: intent.amount || 0,
    status,
    reason:
      status === "STEP_UP_REQUIRED"
        ? (intent.reason || "Above the per-transaction cap — step-up approval required.")
        : status === "DENIED"
          ? (intent.reason || "Denied by authority rules")
          : (intent.reason || "Authorized"),
    at: intent.createdAt,
    reasonCode: intent.reasonCode,
    blockedItem: intent.blockedItem,
    blockedCategory: intent.blockedCategory,
    matchedPolicy: intent.matchedPolicy,
    providerStatus: intent.providerStatus ?? "NOT_INVOKED",
    execution,
  };
}

export function intentToApproval(intent: any): ApprovalRequest | null {
  const rawStatus = String(intent.status || "").toUpperCase();
  if (rawStatus !== "STEP_UP_REQUIRED" && rawStatus !== "STEP_UP") return null;

  return {
    id: intent.intentId,
    agentId: intent.grantId,
    ledgerId: intent.intentId,
    merchant: intent.merchant?.name || "Unknown Merchant",
    description: intent.description || "Transaction requires approval",
    amount: intent.amount || 0,
    reason: intent.reason || "Step-up threshold exceeded",
    requestedAt: intent.createdAt,
  };
}
