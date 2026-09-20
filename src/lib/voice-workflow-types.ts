// ─── Voice Workflow Types (frontend mirror of backend groq-service schema) ─────

export type VoiceActionType =
  | "CREATE_MANDATE"
  | "CREATE_DELEGATION"
  | "START_AGENT"
  | "CREATE_ORDER";

export interface StructuredOrderItem {
  name: string;
  category?: string;
  amount?: number;
  quantity?: number;
}

export interface CreateMandateParams {
  label: string;
  category: string;
  monthlyLimit: number | null;
  perTransactionCap: number | null;
  merchants: string[];
  purpose: string;
  window?: "MONTHLY" | "WEEKLY" | "DAILY";
  blockedCategories?: string[];
  blockedItems?: string[];
}

export interface CreateDelegationParams {
  label: string;
  capacity: number | null;
  parentActionId: string;
}

export interface StartAgentParams {
  agentActionId: string;
}

export interface CreateOrderParams {
  merchant: string;
  category: string;
  items: Array<string | StructuredOrderItem>;
  estimatedAmount: number | null;
  agentActionId: string;
}

export type VoiceActionParams =
  | (CreateMandateParams & { __type: "CREATE_MANDATE" })
  | (CreateDelegationParams & { __type: "CREATE_DELEGATION" })
  | (StartAgentParams & { __type: "START_AGENT" })
  | (CreateOrderParams & { __type: "CREATE_ORDER" });

export interface VoiceAction {
  id: string;
  type: VoiceActionType;
  dependsOn: string[];
  params: Record<string, unknown>; // keep flexible for union narrowing at runtime
}

export interface VoiceWorkflow {
  commandId: string;
  actions: VoiceAction[];
  missingFields: string[];
  warnings: string[];
}

// ─── Execution result types ────────────────────────────────────────────────────

export interface ActionResult {
  actionId: string;
  type: VoiceActionType;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  error?: string;
  output?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  commandId: string;
  status: "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";
  results: ActionResult[];
  summary: { succeeded: number; failed: number; skipped: number };
}

// ─── Hook state machine ────────────────────────────────────────────────────────

export type VoiceWorkflowState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "parsing"
  | "review_required"
  | "executing"
  | "completed"
  | "partially_completed"
  | "failed"
  | "error";

/** Human-readable label for each action type */
export const ACTION_LABELS: Record<VoiceActionType, string> = {
  CREATE_MANDATE:   "Create Mandate",
  CREATE_DELEGATION: "Delegate Authority",
  START_AGENT:       "Start Agent",
  CREATE_ORDER:      "Place Initial Order",
};

/** Icon name hint for UI (maps to lucide icon names) */
export const ACTION_ICONS: Record<VoiceActionType, string> = {
  CREATE_MANDATE:    "Shield",
  CREATE_DELEGATION: "GitBranch",
  START_AGENT:       "Play",
  CREATE_ORDER:      "ShoppingCart",
};
