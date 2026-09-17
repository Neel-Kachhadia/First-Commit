import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  approveRequest: (id: string) => void;
  denyRequest: (id: string) => void;
  revokeAgent: (id: string) => void;
  restoreAgent: (id: string) => void;
  createAgent: (input: NewAgentInput) => string;
  updateRule: (id: string, rule: SpendingRule) => void;
  simulatePayment: (input: SimulationInput) => SimulationResult;
  setFrozen: (value: boolean) => void;
}

const KavachContext = createContext<KavachContextValue | null>(null);

let counter = 1100;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function remainingAuthority(agent: Agent, frozen: boolean) {
  if (frozen || agent.status === "revoked") return 0;
  return Math.max(0, agent.rule.monthlyLimit - agent.consumed);
}

export function KavachProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(seedAgents);
  const [ledger, setLedger] = useState<LedgerEntry[]>(seedLedger);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(seedApprovals);
  const [history, setHistory] = useState<AuthorityEvent[]>(seedHistory);
  const [frozen, setFrozenState] = useState(false);

  const remainingFor = useCallback(
    (agent: Agent) => remainingAuthority(agent, frozen),
    [frozen],
  );

  const maxPossibleSpend = useMemo(
    () => agents.reduce((sum, a) => sum + remainingAuthority(a, frozen), 0),
    [agents, frozen],
  );

  const totalAuthority = useMemo(
    () =>
      agents.reduce(
        (sum, a) => sum + (a.status === "revoked" ? 0 : a.rule.monthlyLimit),
        0,
      ),
    [agents],
  );

  const totalConsumed = useMemo(
    () => agents.reduce((sum, a) => sum + a.consumed, 0),
    [agents],
  );

  const pushEvent = useCallback(
    (label: string, detail: string, maxSpend: number) => {
      setHistory((prev) => [
        ...prev,
        {
          id: nextId("ev"),
          at: new Date().toISOString(),
          label,
          detail,
          maxSpend,
        },
      ]);
    },
    [],
  );

  const getAgent = useCallback(
    (id: string) => agents.find((a) => a.id === id),
    [agents],
  );

  const approveRequest = useCallback(
    (id: string) => {
      const request = approvals.find((a) => a.id === id);
      if (!request) return;
      let snapshot = 0;
      setAgents((prev) => {
        const next = prev.map((agent) => {
          if (agent.id !== request.agentId) return agent;
          const consumed = agent.consumed + request.amount;
          const status: Agent["status"] =
            consumed >= agent.rule.monthlyLimit ? "exhausted" : agent.status;
          return { ...agent, consumed, status };
        });
        snapshot = next.reduce(
          (sum, a) => sum + remainingAuthority(a, frozen),
          0,
        );
        return next;
      });
      setLedger((prev) =>
        prev.map((entry) =>
          entry.id === request.ledgerId
            ? {
                ...entry,
                status: "allowed",
                reason: "Step-up approval granted by the account holder.",
              }
            : entry,
        ),
      );
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      const agentName =
        agents.find((a) => a.id === request.agentId)?.name ?? "Agent";
      pushEvent(
        `${agentName} approved for ₹${request.amount.toLocaleString("en-IN")}`,
        `${request.merchant} — ${request.description}`,
        snapshot,
      );
    },
    [approvals, agents, frozen, pushEvent],
  );

  const denyRequest = useCallback(
    (id: string) => {
      const request = approvals.find((a) => a.id === id);
      if (!request) return;
      setLedger((prev) =>
        prev.map((entry) =>
          entry.id === request.ledgerId
            ? {
                ...entry,
                status: "denied",
                reason: "Step-up approval declined by the account holder.",
              }
            : entry,
        ),
      );
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      const agentName =
        agents.find((a) => a.id === request.agentId)?.name ?? "Agent";
      pushEvent(
        `${agentName} denied for ₹${request.amount.toLocaleString("en-IN")}`,
        `${request.merchant} — ${request.description}`,
        maxPossibleSpend,
      );
    },
    [approvals, agents, maxPossibleSpend, pushEvent],
  );

  const revokeAgent = useCallback(
    (id: string) => {
      let snapshot = 0;
      setAgents((prev) => {
        const next = prev.map((agent) =>
          agent.id === id ? { ...agent, status: "revoked" as const } : agent,
        );
        snapshot = next.reduce(
          (sum, a) => sum + remainingAuthority(a, frozen),
          0,
        );
        return next;
      });
      setApprovals((prev) => prev.filter((a) => a.agentId !== id));
      const agentName = agents.find((a) => a.id === id)?.name ?? "Agent";
      pushEvent(
        `${agentName} revoked`,
        "All remaining authority withdrawn.",
        snapshot,
      );
    },
    [agents, frozen, pushEvent],
  );

  const restoreAgent = useCallback(
    (id: string) => {
      let snapshot = 0;
      setAgents((prev) => {
        const next = prev.map((agent) => {
          if (agent.id !== id) return agent;
          const status: Agent["status"] =
            agent.consumed >= agent.rule.monthlyLimit ? "exhausted" : "active";
          return { ...agent, status };
        });
        snapshot = next.reduce(
          (sum, a) => sum + remainingAuthority(a, frozen),
          0,
        );
        return next;
      });
      const agentName = agents.find((a) => a.id === id)?.name ?? "Agent";
      pushEvent(
        `${agentName} authority restored`,
        "Mandate reinstated.",
        snapshot,
      );
    },
    [agents, frozen, pushEvent],
  );

  const createAgent = useCallback(
    (input: NewAgentInput) => {
      const id = nextId("agent");
      let snapshot = 0;
      setAgents((prev) => {
        const next: Agent[] = [
          ...prev,
          {
            id,
            name: input.name,
            mandateId: `MND-${4400 + prev.length + 80}-NEW`,
            authorityId: `AUTH-${310 + prev.length}`,
            purpose: input.purpose,
            status: "active",
            consumed: 0,
            issuedOn: new Date().toISOString().slice(0, 10),
            rule: input.rule,
          },
        ];
        snapshot = next.reduce(
          (sum, a) => sum + remainingAuthority(a, frozen),
          0,
        );
        return next;
      });
      pushEvent(
        `${input.name} mandate issued`,
        `₹${input.rule.monthlyLimit.toLocaleString("en-IN")} authority granted for ${input.rule.window.toLowerCase()}.`,
        snapshot,
      );
      return id;
    },
    [frozen, pushEvent],
  );

  const updateRule = useCallback(
    (id: string, rule: SpendingRule) => {
      const current = agents.find((agent) => agent.id === id);
      if (!current) return;
      const next = agents.map((agent) =>
        agent.id === id ? { ...agent, rule } : agent,
      );
      setAgents(next);
      const snapshot = next.reduce(
        (sum, agent) => sum + remainingAuthority(agent, frozen),
        0,
      );
      const delta = rule.monthlyLimit - current.rule.monthlyLimit;
      pushEvent(
        `${current.name} mandate updated`,
        `${delta === 0 ? "Policy scope updated" : `Period authority ${delta > 0 ? "increased" : "reduced"} by ₹${Math.abs(delta).toLocaleString("en-IN")}`}.`,
        snapshot,
      );
    },
    [agents, frozen, pushEvent],
  );

  const simulatePayment = useCallback(
    (input: SimulationInput): SimulationResult => {
      const agent = agents.find((a) => a.id === input.agentId);
      if (!agent) {
        return {
          status: "denied",
          reason: "No mandate found for this agent.",
          amount: input.amount,
          agentName: "Unknown agent",
        };
      }
      const remaining = remainingAuthority(agent, frozen);
      let status: SimulationResult["status"] = "allowed";
      let reason = `Within the ${`₹${agent.rule.monthlyLimit.toLocaleString("en-IN")}`} ${agent.rule.window.toLowerCase()} rule.`;

      if (frozen) {
        status = "denied";
        reason = "Emergency stop is active — all agent spending is halted.";
      } else if (agent.status === "revoked") {
        status = "denied";
        reason = "Agent authority has been revoked.";
      } else if (input.amount > remaining) {
        status = "denied";
        reason = `Exceeds remaining authority of ₹${remaining.toLocaleString("en-IN")}.`;
      } else if (input.amount > agent.rule.perTransactionCap) {
        status = "pending";
        reason = `Above the ₹${agent.rule.perTransactionCap.toLocaleString("en-IN")} per-transaction cap — step-up approval required.`;
      }

      const ledgerId = nextId("txn");
      const entry: LedgerEntry = {
        id: ledgerId,
        agentId: agent.id,
        merchant: input.merchant,
        description: input.description,
        amount: input.amount,
        status,
        reason,
        at: new Date().toISOString(),
      };
      setLedger((prev) => [entry, ...prev]);

      if (status === "pending") {
        setApprovals((prev) => [
          {
            id: nextId("apr"),
            agentId: agent.id,
            ledgerId,
            merchant: input.merchant,
            description: input.description,
            amount: input.amount,
            reason: `Above the ₹${agent.rule.perTransactionCap.toLocaleString("en-IN")} per-transaction cap`,
            requestedAt: entry.at,
          },
          ...prev,
        ]);
      }

      if (status === "allowed") {
        let snapshot = 0;
        setAgents((prev) => {
          const next = prev.map((a) => {
            if (a.id !== agent.id) return a;
            const consumed = a.consumed + input.amount;
            return {
              ...a,
              consumed,
              status: (consumed >= a.rule.monthlyLimit
                ? "exhausted"
                : a.status) as Agent["status"],
            };
          });
          snapshot = next.reduce(
            (sum, a) => sum + remainingAuthority(a, frozen),
            0,
          );
          return next;
        });
        pushEvent(
          `${agent.name} spent ₹${input.amount.toLocaleString("en-IN")}`,
          `${input.merchant} — ${input.description}`,
          snapshot,
        );
      }

      return { status, reason, amount: input.amount, agentName: agent.name };
    },
    [agents, frozen, pushEvent],
  );

  const setFrozen = useCallback(
    (value: boolean) => {
      setFrozenState(value);
      pushEvent(
        value ? "Emergency stop engaged" : "Emergency stop cleared",
        value
          ? "All agent authority suspended across every mandate."
          : "Agent authority reinstated to pre-stop levels.",
        value
          ? 0
          : agents.reduce((sum, a) => sum + remainingAuthority(a, false), 0),
      );
    },
    [agents, pushEvent],
  );

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
      revokeAgent,
      restoreAgent,
      createAgent,
      updateRule,
      simulatePayment,
      setFrozen,
    ],
  );

  return (
    <KavachContext.Provider value={value}>{children}</KavachContext.Provider>
  );
}

export function useKavach() {
  const ctx = useContext(KavachContext);
  if (!ctx) throw new Error("useKavach must be used within KavachProvider");
  return ctx;
}
