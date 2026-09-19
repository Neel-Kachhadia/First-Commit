export type ScenarioId =
  | "budget-exceeded"
  | "delegation-overflow"
  | "revocation"
  | "replay"
  | "expired-grant"
  | "category-deny"
  | "max-children"
  | "happy-path";

export interface ScenarioResponse {
  scenario?: string;
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown> & { trace?: string[] };
  enforcementResult?: { enforced?: boolean; code?: string; message?: string };
  trace?: string[];
  error?: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  category: string;
  attempt: string;
  expected: string;
  reference: boolean;
}

export const scenarios: ScenarioDefinition[] = [
  { id: "budget-exceeded", title: "Budget bypass", category: "Authority", attempt: "Spend ₹200 after reserving ₹900 of a ₹1,000 grant.", expected: "Second intent denied; no second reservation.", reference: false },
  { id: "delegation-overflow", title: "Delegation depth", category: "Inheritance", attempt: "Create a third-level child below a grant capped at two levels.", expected: "Further delegation rejected.", reference: false },
  { id: "revocation", title: "Revoked ancestor", category: "Revocation", attempt: "Request a payment through a child after its ancestor is revoked.", expected: "Child intent denied.", reference: false },
  { id: "replay", title: "Intent replay", category: "Idempotency", attempt: "Submit a second intent with the same idempotency key.", expected: "Original intent returned; no second intent created.", reference: false },
  { id: "expired-grant", title: "Expired authority", category: "Time", attempt: "Request ₹500 against an expired grant.", expected: "Intent denied with expiry reason.", reference: false },
  { id: "category-deny", title: "Category bypass", category: "Scope", attempt: "Send an electronics purchase through a grocery-only grant.", expected: "Intent denied for scope violation.", reference: false },
  { id: "max-children", title: "Child-count overflow", category: "Inheritance", attempt: "Create a third child under a parent limited to two.", expected: "Further delegation rejected.", reference: false },
  { id: "happy-path", title: "Authorized control", category: "Reference", attempt: "Send ₹800 through a valid grocery grant.", expected: "Intent allowed and reserved once.", reference: true },
];

type Outcome = { passed: boolean; observed: string; reason: string; checks: string[] };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function evaluateScenario(id: ScenarioId, response: ScenarioResponse): Outcome {
  if (response.error) return { passed: false, observed: "Backend error", reason: response.error, checks: [] };
  if (response.scenario && response.scenario !== id) return { passed: false, observed: "Scenario mismatch", reason: `Returned ${response.scenario}`, checks: [] };
  if (response.enforcementResult) {
    const code = response.enforcementResult.code ?? "No reason returned";
    const expected = id === "expired-grant" ? "GRANT_EXPIRED" : id === "revocation" ? "GRANT_REVOKED" : "";
    const passed = response.enforcementResult.enforced === true && code === expected;
    return { passed, observed: passed ? "Blocked by enforcement" : "Unexpected enforcement result", reason: code, checks: passed ? [`${code} raised by the authorization path`] : [] };
  }
  const result = asRecord(response.result);
  const first = asRecord(result.firstDecision ?? result.beforeRevocation);
  const second = asRecord(result.secondDecision ?? result.afterRevocation);
  let passed = false;
  let observed = "Unexpected response";
  let reason = "No matching reason returned";
  let checks: string[] = [];

  switch (id) {
    case "budget-exceeded":
      passed = first.decision === "ALLOW" && first.reserved === true && second.decision === "DENY" && second.reserved === false && ["WINDOW_BUDGET_EXCEEDED", "EFFECTIVE_CAPACITY_EXCEEDED"].includes(String(second.reasonCode));
      observed = `${String(first.decision ?? "?")} → ${String(second.decision ?? "?")}`;
      reason = String(second.reasonCode ?? reason);
      checks = ["First reservation recorded", "Second intent denied", "Second reservation absent"];
      break;
    case "delegation-overflow":
      reason = String(result.depth3Attempt ?? reason);
      passed = reason === "MAX_DELEGATION_DEPTH_EXCEEDED";
      observed = passed ? "Third-level grant rejected" : "Third-level result unverified";
      checks = ["Two permitted levels created", "Third level rejected"];
      break;
    case "revocation":
      passed = first.decision === "ALLOW" && second.decision === "DENY" && second.reasonCode === "GRANT_REVOKED";
      observed = `${String(first.decision ?? "?")} → ${String(second.decision ?? "?")}`;
      reason = String(second.reasonCode ?? reason);
      checks = ["Initial request evaluated", "Ancestor revoked", "Descendant request denied"];
      break;
    case "replay":
      passed = result.sameIntent === true && result.secondReplayed === true && result.firstReplayed === false;
      observed = passed ? "Same intent returned" : "Intent identity not verified";
      reason = `secondReplayed=${String(result.secondReplayed ?? "not returned")}`;
      checks = ["Same intent ID", "Second response marked replayed", "No new intent returned"];
      break;
    case "expired-grant":
    case "category-deny":
      passed = result.decision === "DENY" && result.reasonCode === (id === "expired-grant" ? "GRANT_EXPIRED" : "SCOPE_DENIED");
      observed = String(result.decision ?? "?");
      reason = String(result.reasonCode ?? reason);
      checks = ["Attempt evaluated", "Policy boundary enforced"];
      break;
    case "max-children":
      reason = String(result.thirdChildAttempt ?? reason);
      passed = reason === "MAX_DELEGATION_CHILDREN_EXCEEDED";
      observed = passed ? "Third child rejected" : "Third child result unverified";
      checks = ["Two children created", "Third child rejected"];
      break;
    case "happy-path":
      passed = result.decision === "ALLOW" && result.reserved === true;
      observed = `${String(result.decision ?? "?")} / ${result.reserved === true ? "reserved" : "not reserved"}`;
      reason = String(result.reasonCode ?? reason);
      checks = ["Valid scope evaluated", "Authority reserved"];
      break;
  }

  return { passed, observed, reason, checks };
}
