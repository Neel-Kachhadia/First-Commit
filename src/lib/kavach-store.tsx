"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  seedAgents,
  seedApprovals,
  seedHistory,
  seedLedger,
  type Agent,
  type ApprovalRequest,
  type AuthorityEvent,
  type LedgerEntry,
  type SpendingRule,
} from "./kavach-data";
import {
  apiClient,
  type CreateGrantPayload,
  type SimulatePaymentPayload,
} from "./api-client";
import { grantToAgent, intentToLedgerEntry, intentToApproval } from "./kavach-adapters";

interface NewAgentInput {
  name: string;
  purpose: string;
  rule: SpendingRule;
}

interface SimulationInput {
  agentId: string;
  merchant: string;
  description: string;
  amount: number;
}

export interface SimulationResult {
  status: "allowed" | "denied" | "pending";
  reason: string;
  amount: number;
  agentName: string;
  intentId?: string;
}

interface KavachContextValue {
  agents: Agent[];
  ledger: LedgerEntry[];
  approvals: ApprovalRequest[];
  history: AuthorityEvent[];
  frozen: boolean;
  remainingFor: (agent: Agent) => number;
  maxPossibleSpend: number;
  totalAuthority: number;
  totalConsumed: number;
  getAgent: (id: string) => Agent | undefined;
  approveRequest: (id: string) => Promise<void>;
  denyRequest: (id: string) => Promise<void>;
  revokeAgent: (id: string) => Promise<void>;
  restoreAgent: (id: string) => Promise<void>;
  createAgent: (input: NewAgentInput) => Promise<string>;
  updateRule: (id: string, rule: SpendingRule) => Promise<void>;
  simulatePayment: (input: SimulationInput) => Promise<SimulationResult>;
  setFrozen: (value: boolean) => void;
}

const KavachContext = createContext<KavachContextValue | null>(null);

export function remainingAuthority(agent: Agent, frozen: boolean) {
  if (frozen || agent.status === "revoked") return 0;
  return Math.max(0, agent.rule.monthlyLimit - agent.consumed);
}

function KavachStoreInner({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [resolvedApprovalIds, setResolvedApprovalIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Queries
  const { data: grantsData, isError: grantsError } = useQuery({
    queryKey: ["grants"],
    queryFn: () => apiClient.getGrants(),
    refetchInterval: 3000,
    retry: 1,
  });

  const { data: ledgerData, isError: ledgerError } = useQuery({
    queryKey: ["ledger"],
    queryFn: () => apiClient.getLedger(),
    refetchInterval: 3000,
    retry: 1,
  });

  // Data processing
  const agents: Agent[] = useMemo(() => {
    if (grantsError || !grantsData?.grants || grantsData.grants.length === 0) {
      return seedAgents;
    }
    return grantsData.grants.map(grantToAgent);
  }, [grantsData, grantsError]);

  const ledger: LedgerEntry[] = useMemo(() => {
    if (ledgerError || !ledgerData?.intents || ledgerData.intents.length === 0) {
      return seedLedger;
    }
    return ledgerData.intents.map(intentToLedgerEntry);
  }, [ledgerData, ledgerError]);

  const usingSeedApprovals =
    ledgerError || !ledgerData?.intents || ledgerData.intents.length === 0;

  const approvals: ApprovalRequest[] = useMemo(() => {
    const pending =
      usingSeedApprovals
        ? seedApprovals
        : ledgerData.intents
            .map(intentToApproval)
            .filter(
              (approval: ApprovalRequest | null): approval is ApprovalRequest =>
                approval !== null,
            );

    return pending.filter(
      (approval: ApprovalRequest) => !resolvedApprovalIds.has(approval.id),
    );
  }, [ledgerData, resolvedApprovalIds, usingSeedApprovals]);

  // Derived state
  const frozen = false; // Add frozen logic back if needed via DB or local override
  const history: AuthorityEvent[] = seedHistory;

  const remainingFor = useCallback(
    (agent: Agent) => remainingAuthority(agent, frozen),
    [frozen],
  );

  const maxPossibleSpend = useMemo(
    () => agents.reduce((sum: number, a: Agent) => sum + remainingAuthority(a, frozen), 0),
    [agents, frozen],
  );

  const totalAuthority = useMemo(
    () =>
      agents.reduce(
        (sum: number, a: Agent) => sum + (a.status === "revoked" ? 0 : a.rule.monthlyLimit),
        0,
      ),
    [agents],
  );

  const totalConsumed = useMemo(
    () => agents.reduce((sum: number, a: Agent) => sum + a.consumed, 0),
    [agents],
  );

  const getAgent = useCallback(
    (id: string) => agents.find((a: Agent) => a.id === id),
    [agents],
  );

  // Mutations
  const approveMutation = useMutation({
    mutationFn: apiClient.approveIntent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["exposure"] });
      queryClient.invalidateQueries({ queryKey: ["grants"] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: apiClient.denyIntent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  const executeOrderMutation = useMutation({
    mutationFn: apiClient.executeOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => apiClient.revokeGrant(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grants"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  const createGrantMutation = useMutation({
    mutationFn: apiClient.createGrant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grants"] }),
  });

  const simulateMutation = useMutation({
    mutationFn: apiClient.simulatePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grants"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  const markApprovalResolved = useCallback((id: string) => {
    setResolvedApprovalIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const restoreApproval = useCallback((id: string) => {
    setResolvedApprovalIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const approveRequest = useCallback(async (id: string) => {
    markApprovalResolved(id);
    if (usingSeedApprovals) return;
    try {
      const res = await approveMutation.mutateAsync(id);
      if (res.intent?.status === "RESERVED") {
        await executeOrderMutation.mutateAsync(id);
      }
    } catch (error) {
      restoreApproval(id);
      throw error;
    }
  }, [approveMutation, executeOrderMutation, markApprovalResolved, restoreApproval, usingSeedApprovals]);

  const denyRequest = useCallback(async (id: string) => {
    markApprovalResolved(id);
    if (usingSeedApprovals) return;
    try {
      await denyMutation.mutateAsync(id);
    } catch (error) {
      restoreApproval(id);
      throw error;
    }
  }, [denyMutation, markApprovalResolved, restoreApproval, usingSeedApprovals]);

  const revokeAgent = async (id: string) => {
    await revokeMutation.mutateAsync(id);
  };

  const restoreAgent = async (id: string) => {
    console.warn("Restore agent not supported by backend yet.");
  };

  const createAgent = async (input: NewAgentInput) => {
    const payload: CreateGrantPayload = {
      label: input.name,
      limit: input.rule.monthlyLimit,
      currency: "INR",
      hardMax: input.rule.perTransactionCap,
      merchantAllow: input.rule.merchants,
      category: input.rule.category.toUpperCase().replace(/ & /g, "_").replace(/ /g, "_"),
      window: "MONTHLY",
      windowStart: new Date().toISOString(),
      delegationEnabled: false,
    };
    const res = await createGrantMutation.mutateAsync(payload);
    return res.grant?.grantId || res.grantId || "unknown"; // Assuming backend returns { grant: { grantId } }
  };

  const updateRule = async (id: string, rule: SpendingRule) => {
    console.warn("Update rule not implemented on backend.");
  };

  const simulatePayment = async (input: SimulationInput): Promise<SimulationResult> => {
    const agent = getAgent(input.agentId);
    const category = agent?.rule?.category 
      ? agent.rule.category.toUpperCase().replace(/ & /g, "_").replace(/ /g, "_")
      : "GENERAL";

    const payload: SimulatePaymentPayload = {
      amount: Math.round(input.amount * 100),
      currency: "INR",
      grantId: input.agentId,
      merchant: {
        merchantId: input.merchant,
        name: input.merchant,
        category: category,
      },
      idempotencyKey: `sim_${Date.now()}`,
    };
    const res = await simulateMutation.mutateAsync(payload);
    
    // Parse result based on backend response shape.
    // ALLOW: HTTP 200 → { success: true, decision: "ALLOW", decisionReceipt: {...} }
    // STEP_UP: HTTP 202 → { success: true, requiresStepUp: true, decision: { decision: "STEP_UP" }, intent: {...} }
    // DENY: HTTP 403 → { success: false, decision: { decision: "DENY", reason: ... }, intent: {...} }
    let status: SimulationResult["status"] = "denied";
    let reason = "Denied by rules.";

    // Flatten the decision string from either location
    const decisionStr: string =
      typeof res.decision === "string"
        ? res.decision // ALLOW path: decision is the string directly
        : res.decision?.decision ?? ""; // DENY / STEP_UP path: nested object

    const decisionReason: string =
      res.decisionReceipt?.reason ||
      res.decision?.reason ||
      res.error ||
      "Denied by rules.";

    if (decisionStr === "ALLOW") {
      status = "allowed";
      reason = "Authorized";
    } else if (decisionStr === "STEP_UP" || res.requiresStepUp) {
      status = "pending";
      reason = "Requires step-up approval";
    } else {
      reason = decisionReason;
    }

    return {
      status,
      reason,
      amount: input.amount,
      agentName: agent?.name || "Unknown Agent",
      intentId: res.intentId || res.intent?.intentId,
    };
  };

  const setFrozen = (value: boolean) => {
    console.warn("Set frozen not implemented");
  };

  const value = useMemo<KavachContextValue>(
    () => ({
      agents,
      ledger,
      approvals,
      history,
      frozen,
      remainingFor,
      maxPossibleSpend,
      totalAuthority,
      totalConsumed,
      getAgent,
      approveRequest,
      denyRequest,
      revokeAgent,
      restoreAgent,
      createAgent,
      updateRule,
      simulatePayment,
      setFrozen,
    }),
    [
      agents,
      ledger,
      approvals,
      history,
      frozen,
      remainingFor,
      maxPossibleSpend,
      totalAuthority,
      totalConsumed,
      getAgent,
      approveRequest,
      denyRequest,
    ]
  );

  return <KavachContext.Provider value={value}>{children}</KavachContext.Provider>;
}

export function KavachProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <KavachStoreInner>{children}</KavachStoreInner>
    </QueryClientProvider>
  );
}

export function useKavach() {
  const ctx = useContext(KavachContext);
  if (!ctx) throw new Error("useKavach must be used within KavachProvider");
  return ctx;
}
