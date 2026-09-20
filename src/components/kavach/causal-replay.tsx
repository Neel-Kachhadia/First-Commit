"use client";

import { useMemo } from "react";
import { formatINR } from "@/lib/kavach-data";
import { ArrowDown, CheckCircle2 } from "lucide-react";

// Types matching the backend response
export type CausalReplayNodeType =
  | "PROVIDER_RESULT"
  | "PROVIDER_WEBHOOK"
  | "EXECUTION"
  | "DECISION"
  | "DECISION_CAUSE"
  | "AUTHORITY_STATE"
  | "AGENT"
  | "DELEGATION"
  | "MANDATE"
  | "HUMAN_INTENT"
  | "PAYMENT_PROFILE";

export type CausalReplayEdgeType =
  | "CAUSED_BY"
  | "GOVERNED_BY"
  | "DELEGATED_FROM"
  | "INITIATED_BY"
  | "AUTHORIZED_BY"
  | "BLOCKED_BY"
  | "RESERVED_AGAINST"
  | "EXECUTED_BY"
  | "CONFIRMED_BY"
  | "ORIGINATED_FROM"
  | "FUNDED_BY";

export interface CausalReplayNode {
  id: string;
  type: CausalReplayNodeType;
  label: string;
  status?: string;
  data?: Record<string, any>;
}

export interface CausalReplayEdge {
  from: string;
  to: string;
  type: CausalReplayEdgeType;
}

export interface CausalReplay {
  replayId: string;
  intentId: string;
  decisionId: string;
  userId: string;
  outcome: {
    decision: string;
    intentStatus: string;
    providerStatus: string;
    providerInvoked: boolean;
  };
  coverage: {
    completed: number;
    total: number;
    status: "COMPLETE" | "PARTIAL";
  };
  nodes: CausalReplayNode[];
  edges: CausalReplayEdge[];
  chain: {
    providerWebhook?: string;
    providerResult?: string;
    execution?: string;
    decision: string;
    decisionCause?: string;
    authorityState?: string;
    agent?: string;
    delegation?: string[];
    mandate?: string;
    humanIntent?: string;
    paymentProfile?: string;
  };
  reconstructedAt: string;
}

export function CausalReplayPanel({
  replay,
  loading,
}: {
  replay: CausalReplay | null;
  loading?: boolean;
}) {
  const orderedNodeIds = useMemo(() => {
    if (!replay) return [];
    const ids: string[] = [];
    const c = replay.chain;

    if (c.decision) ids.push(c.decision);
    if (c.decisionCause) ids.push(c.decisionCause);
    if (c.authorityState) ids.push(c.authorityState);
    if (c.delegation && c.delegation.length > 0) {
      [...c.delegation].reverse().forEach((d) => ids.push(d));
    }
    if (c.mandate) ids.push(c.mandate);
    if (c.paymentProfile) ids.push(c.paymentProfile);
    if (c.humanIntent) ids.push(c.humanIntent);

    return ids;
  }, [replay]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-mono tracking-widest uppercase">
            Reconstructing chain...
          </p>
        </div>
      </div>
    );
  }

  if (!replay) return null;

  const nodes = orderedNodeIds
    .map((id) => replay.nodes.find((n) => n.id === id))
    .filter(Boolean) as CausalReplayNode[];

  const getEdgeBetween = (nodeIdA: string, nodeIdB: string) => {
    return replay.edges.find(
      (e) =>
        (e.from === nodeIdA && e.to === nodeIdB) ||
        (e.from === nodeIdB && e.to === nodeIdA)
    );
  };

  const humanIntentNode = replay.nodes.find((n) => n.type === "HUMAN_INTENT");

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto font-mono text-sm">
      <div className="p-6">
        <h2 className="text-xl font-bold tracking-tight mb-6">
          WHY DID THIS HAPPEN?
        </h2>

        <div className="border border-border rounded-lg bg-card p-4 mb-8">
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
            [ OUTCOME ]
          </div>
          <div className="text-lg font-bold text-foreground uppercase">
            {replay.outcome.decision}
          </div>
          {humanIntentNode && humanIntentNode.data && (
            <div className="text-muted-foreground mt-1">
              {formatINR(humanIntentNode.data.amount)} ·{" "}
              {humanIntentNode.data.merchant?.name || "Merchant"}
            </div>
          )}
        </div>

        <hr className="border-border my-8" />

        <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-6">
          CAUSAL CHAIN
        </div>

        <div className="space-y-0 relative">
          {nodes.map((node, i) => {
            const nextNode = nodes[i + 1];
            const edge = nextNode
              ? getEdgeBetween(node.id, nextNode.id)
              : null;

            const isDecisionNode = node.id === replay.chain.decision;
            const executionNode = replay.nodes.find(
              (n) => n.id === replay.chain.execution
            );
            const providerNode = replay.nodes.find(
              (n) => n.id === replay.chain.providerResult
            );
            const webhookNode = replay.nodes.find(
              (n) => n.id === replay.chain.providerWebhook
            );

            return (
              <div key={node.id} className="relative">
                <NodeRenderer node={node} outcome={replay.outcome} />

                {isDecisionNode && providerNode && (
                  <div className="mt-4 mb-2 ml-6 border-l-2 border-muted pl-4 relative">
                    <div className="absolute -left-[2px] top-4 w-4 border-t-2 border-muted" />
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded inline-block mb-2 relative -top-3 left-1">
                      ROUTES TO
                    </div>

                    {replay.outcome.providerInvoked ? (
                      <div className="flex flex-col">
                        {executionNode && (
                          <NodeRenderer
                            node={executionNode}
                            outcome={replay.outcome}
                          />
                        )}

                        {executionNode && providerNode && (
                          <div className="flex flex-col items-center justify-center my-4 opacity-50">
                            <ArrowDown className="h-4 w-4 text-muted-foreground mb-1" />
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              EXECUTED BY
                            </span>
                          </div>
                        )}

                        <NodeRenderer
                          node={providerNode}
                          outcome={replay.outcome}
                        />

                        {providerNode && webhookNode && (
                          <div className="flex flex-col items-center justify-center my-4 opacity-50">
                            <ArrowDown className="h-4 w-4 text-muted-foreground mb-1" />
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              CONFIRMED BY
                            </span>
                          </div>
                        )}

                        {webhookNode && (
                          <NodeRenderer
                            node={webhookNode}
                            outcome={replay.outcome}
                          />
                        )}
                      </div>
                    ) : (
                      <NodeRenderer
                        node={providerNode}
                        outcome={replay.outcome}
                      />
                    )}
                  </div>
                )}

                {nextNode && (
                  <div className="flex flex-col items-center justify-center my-4 opacity-50">
                    <ArrowDown className="h-4 w-4 text-muted-foreground mb-1" />
                    {edge && (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {edge.type.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <hr className="border-border my-8" />

        <div className="flex items-start gap-3 text-muted-foreground pb-8">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
              CAUSAL CHAIN RECONSTRUCTED
            </p>
            <p>Evidence reconstructed from persisted KavachPay records.</p>
            <p>KMS-backed evidence where available.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NodeRendererProps {
  node: CausalReplayNode;
  outcome: CausalReplay["outcome"];
}

function NodeRenderer({ node, outcome }: NodeRendererProps) {
  if (node.type === "PROVIDER_WEBHOOK") {
    return (
      <div className="border-l-2 border-foreground pl-4 py-1">
        <div className="font-bold">PROVIDER WEBHOOK</div>
        <div className="text-muted-foreground mt-1">
          {node.data?.eventId || node.label}
        </div>
      </div>
    );
  }

  if (node.type === "PROVIDER_RESULT") {
    // Provider was actually invoked → real Razorpay execution
    if (outcome.providerInvoked) {
      return (
        <div className="border-l-2 border-foreground pl-4 py-1">
          <div className="font-bold uppercase">{node.label}</div>
          <div className="text-muted-foreground mt-1 uppercase">
            {node.data?.environment?.replace("_", " ")}
          </div>
          <div className="mt-2 space-y-0.5">
            {node.data?.razorpayOrderId && (
              <div>
                <span className="text-muted-foreground text-xs">Order </span>
                {node.data.razorpayOrderId}
              </div>
            )}
            {node.data?.razorpayPaymentId && (
              <div>
                <span className="text-muted-foreground text-xs">Payment </span>
                {node.data.razorpayPaymentId}
              </div>
            )}
            {node.status && (
              <div>
                <span className="text-muted-foreground text-xs">Status </span>
                {node.status.replace("PROVIDER_", "")}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Provider NOT invoked — semantic rendering by decision outcome
    const decision = outcome.decision; // "ALLOW" | "DENY" | "STEP_UP"

    if (decision === "ALLOW") {
      return (
        <div className="border-l-2 border-muted pl-4 py-1">
          <div className="font-bold">EXECUTION</div>
          <div className="mt-1 text-muted-foreground font-semibold">
            AUTHORIZED · NOT EXECUTED
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Authorization granted, but no payment execution was requested.
            <br />
            {node.label} · {node.data?.environment?.replace("_", " ")}
            <br />
            Provider was not invoked.
          </div>
        </div>
      );
    }

    if (decision === "STEP_UP") {
      return (
        <div className="border-l-2 border-muted pl-4 py-1">
          <div className="font-bold">EXECUTION</div>
          <div className="mt-1 text-blue-400 font-semibold">
            WAITING FOR APPROVAL
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Human approval is required before provider execution.
            <br />
            {node.label} · {node.data?.environment?.replace("_", " ")}
            <br />
            Razorpay was not invoked.
          </div>
        </div>
      );
    }

    // DENY or any other rejected state
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">EXECUTION</div>
        <div className="mt-1 text-muted-foreground font-semibold">
          NOT INVOKED
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Authorization denied.
          <br />
          {node.label} · {node.data?.environment?.replace("_", " ")}
          <br />
          Provider was never invoked.
        </div>
      </div>
    );
  }

  if (node.type === "EXECUTION") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">PAYMENT EXECUTION</div>
        <div className="text-muted-foreground mt-1 uppercase">{node.status}</div>
      </div>
    );
  }

  if (node.type === "DECISION") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">DECISION</div>
        <div className="text-muted-foreground mt-1 uppercase">{node.status}</div>
      </div>
    );
  }

  if (node.type === "DECISION_CAUSE") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">DECISION CAUSE</div>
        <div className="text-muted-foreground mt-1 uppercase">{node.label}</div>
      </div>
    );
  }

  if (node.type === "AUTHORITY_STATE") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">AUTHORITY STATE</div>
        <div className="text-muted-foreground mt-1">
          {node.data?.source === "DECISION_RECEIPT"
            ? "Snapshot from receipt"
            : "Effective capacity / policy state"}
        </div>
      </div>
    );
  }

  if (node.type === "DELEGATION") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">CHILD DELEGATION</div>
        <div className="text-muted-foreground mt-1">{node.label}</div>
      </div>
    );
  }

  if (node.type === "MANDATE") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">ROOT MANDATE</div>
        <div className="text-muted-foreground mt-1">{node.label}</div>
      </div>
    );
  }

  if (node.type === "PAYMENT_PROFILE") {
    return (
      <div className="border-l-2 border-primary pl-4 py-1">
        <div className="font-bold flex items-center gap-2">
          <span>PAYMENT EXECUTION CONTEXT</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono border border-border">
            {String(node.data?.environment ?? "TEST")} MODE
          </span>
        </div>
        <div className="text-foreground font-medium mt-1">{node.label}</div>
        <div className="text-muted-foreground text-xs font-mono mt-0.5">{String(node.data?.paymentProfileId ?? "")}</div>
        <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase">SIMULATED · ₹0 REAL FUNDS</div>
      </div>
    );
  }

  if (node.type === "HUMAN_INTENT") {
    return (
      <div className="border-l-2 border-muted pl-4 py-1">
        <div className="font-bold">HUMAN INTENT</div>
        <div className="text-muted-foreground mt-1">{node.label}</div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="border-l-2 border-muted pl-4 py-1">
      <div className="font-bold uppercase">{node.type.replace(/_/g, " ")}</div>
      <div className="text-muted-foreground mt-1">{node.label}</div>
    </div>
  );
}
