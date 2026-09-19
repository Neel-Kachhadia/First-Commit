"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ExternalLink } from "lucide-react";
import {
  AgentGlyph,
  ApprovalGlyph,
  AuthorityGlyph,
  DecisionGlyph,
} from "@/components/kavach/icons";
import {
  AuthorityBar,
  Metric,
  PageHeader,
  StatusPill,
  agentTone,
} from "@/components/kavach/primitives";
import { Button } from "@/components/ui/button";
import { ExposureChart } from "@/components/kavach/exposure-chart";
import { useKavach } from "@/lib/kavach-store";
import { useUserProfile } from "@/lib/user-profile";
import { apiClient, type AuditEvent } from "@/lib/api-client";
import { formatDateTime, formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

function describeAuditEvent(event: AuditEvent, agents: ReturnType<typeof useKavach>["agents"], ledger: ReturnType<typeof useKavach>["ledger"]) {
  const grantId = typeof event.metadata?.grantId === "string" ? event.metadata.grantId : "";
  const intentId = typeof event.metadata?.intentId === "string" ? event.metadata.intentId : "";
  const agent = agents.find((item) => item.id === grantId);
  const decision = ledger.find((item) => item.id === intentId);
  switch (event.eventType) {
    case "GRANT_CREATED": return { tag: "MANDATE", title: "Mandate issued", detail: agent?.name ?? grantId };
    case "GRANT_REVOKED": return { tag: "REVOCATION", title: "Mandate revoked", detail: agent?.name ?? grantId };
    case "GRANT_EXPIRED": return { tag: "EXPIRY", title: "Mandate expired", detail: agent?.name ?? grantId };
    case "DECISION_MADE": return { tag: "DECISION", title: "Policy decision recorded", detail: decision ? `${decision.merchant} · ${formatINR(decision.amount)}` : intentId };
    case "RESERVATION_CREATED": return { tag: "SPEND", title: "Authority reserved", detail: decision ? `${decision.merchant} · ${formatINR(decision.amount)}` : intentId };
    case "RESERVATION_RELEASED": return { tag: "RELEASE", title: "Authority released", detail: decision?.merchant ?? intentId };
    case "DEMO_RESET": return { tag: "RESET", title: "Demo state reset", detail: "Starting authority restored" };
    default: return { tag: "AUDIT", title: event.eventType.replaceAll("_", " ").toLowerCase(), detail: decision?.merchant ?? agent?.name ?? (intentId || grantId) };
  }
}

export default function AuthorityPage() {
  const { profile } = useUserProfile();
  const { data: auditData, isLoading: auditLoading, isError: auditError } = useQuery({
    queryKey: ["audit"],
    queryFn: apiClient.getAudit,
    refetchInterval: 5000,
  });
  const {
    history,
    maxPossibleSpend,
    totalAuthority,
    agents,
    ledger,
    frozen,
    remainingFor,
  } = useKavach();
  const totalConsumed = agents.reduce(
    (sum, agent) => sum + agent.consumed,
    0,
  );
  const withdrawnAuthority = Math.max(
    0,
    totalAuthority - totalConsumed - maxPossibleSpend,
  );
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const effectiveAgentId = selectedAgentId || agents[0]?.id || "";
  const selectedAgent = agents.find((agent) => agent.id === effectiveAgentId);
  const selectedRemaining = selectedAgent ? remainingFor(selectedAgent) : 0;
  const selectedTone = selectedAgent ? agentTone(selectedAgent.status) : null;

  return (
    <div className="authority-page space-y-7">
      <PageHeader
        title="Authority universe"
        description="A live map of who can spend, how much remains, and every event that changed your financial blast radius."
        actions={
          <Button variant="outline" asChild>
            <Link href={effectiveAgentId ? `/rules?parentGrantId=${effectiveAgentId}` : "/rules"}>
              Create child mandate
            </Link>
          </Button>
        }
      />

      <section className="authority-ribbon grid gap-4 sm:grid-cols-3">
        <Metric
          label="Maximum reachable exposure"
          value={formatINR(maxPossibleSpend)}
          hint={
            frozen
              ? "All authority suspended"
              : "Current worst-case autonomous spend"
          }
          tone={frozen ? "stepup" : "primary"}
        />
        <Metric
          label="Authority granted"
          value={formatINR(totalAuthority)}
          hint="Across every live mandate"
        />
        <Metric
          label="Exposure withdrawn"
          value={formatINR(withdrawnAuthority)}
          hint="Consumed or revoked authority"
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="grid min-w-0 gap-4">
          <div className="authority-map surface-card overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <AuthorityGlyph className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Authority lineage</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Every mandate derives from the account owner&apos;s authority.
              </p>
            </div>
            <span className="rounded-md border border-success/25 bg-success/10 px-2 py-1 text-[10px] font-medium text-success">
              Live graph
            </span>
          </div>

          <div className="relative overflow-hidden p-3.5 sm:p-5">
            <div className="authority-grid absolute inset-0 opacity-35" />
            <div className="relative mx-auto flex max-w-3xl flex-col items-center">
              <div className="rounded-lg border border-primary/35 bg-primary/8 px-3.5 py-1.5 text-center shadow-xs">
                <p className="text-xs font-semibold">{profile.username}</p>
                <p className="text-[10px] text-muted-foreground">
                  Principal · authority owner
                </p>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <div className="relative h-px w-[82%] bg-border before:absolute before:left-0 before:top-0 before:h-3 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:h-3 after:w-px after:bg-border" />
              <div className="mt-3 grid w-full gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {agents.map((agent) => {
                  const tone = agentTone(agent.status);
                  return (
                    <button
                      type="button"
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setSelectedEventId(null);
                      }}
                      aria-pressed={selectedAgentId === agent.id}
                      className={cn(
                        "authority-node group rounded-[6px] border border-border bg-card p-3 text-left transition-all hover:border-foreground/25",
                        effectiveAgentId === agent.id &&
                          "border-foreground/40 bg-raised ring-1 ring-foreground/10",
                        effectiveAgentId !== agent.id &&
                          effectiveAgentId &&
                          "opacity-65 hover:opacity-100",
                        agent.status === "revoked" && "border-dashed",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-primary">
                          <AgentGlyph className="h-3 w-3" />
                        </span>
                        <StatusPill
                          tone={tone.tone}
                          label={tone.label}
                          className="px-1.5 py-0.5 text-[9px]"
                        />
                      </div>
                      <p className="mt-2 text-xs font-medium">{agent.name}</p>
                      <p className="amount mt-0.5 text-base font-semibold">
                        {formatINR(remainingFor(agent))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {agent.status === "revoked"
                          ? "terminated authority"
                          : "remaining authority"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-2">
                <AuthorityGlyph className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Exposure over time</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Step-downs show authority consumed or withdrawn.
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <ExposureChart
                history={history}
                currentExposure={maxPossibleSpend}
              />
            </div>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2">
                  <AgentGlyph className="h-4 w-4 text-destructive" />
                  <h2 className="text-base font-semibold">Authority allocation</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  How granted authority resolves into used, reachable and withdrawn capacity.
                </p>
              </div>
              <span className="amount shrink-0 text-sm font-semibold">{formatINR(totalAuthority)}</span>
            </div>

            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(170px,.9fr)_90px_90px] gap-4 border-b border-border bg-muted/20 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground md:grid">
              <span>Mandate</span>
              <span>Capacity used</span>
              <span className="text-right">Granted</span>
              <span className="text-right">Reachable</span>
            </div>

            <div className="divide-y divide-border">
              {agents.map((agent) => {
                const tone = agentTone(agent.status);
                const remaining = remainingFor(agent);
                return (
                  <button
                    type="button"
                    key={agent.id}
                    className="group grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-raised md:grid-cols-[minmax(0,1.2fr)_minmax(170px,.9fr)_90px_90px] md:items-center md:gap-4"
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setSelectedEventId(null);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-destructive">
                        <AgentGlyph className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{agent.name}</span>
                          <StatusPill tone={tone.tone} label={tone.label} className="px-1.5 py-0.5 text-[8px]" />
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {agent.rule.category} · {agent.mandateId}
                        </span>
                      </span>
                    </span>

                    <span className="min-w-0">
                      <span className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{formatINR(agent.consumed)} used</span>
                        <span>{Math.round((agent.consumed / Math.max(agent.rule.monthlyLimit, 1)) * 100)}%</span>
                      </span>
                      <AuthorityBar consumed={agent.consumed} limit={agent.rule.monthlyLimit} muted={agent.status === "revoked"} />
                    </span>

                    <span className="flex items-center justify-between text-xs md:block md:text-right">
                      <span className="text-muted-foreground md:hidden">Granted</span>
                      <span className="amount font-medium">{formatINR(agent.rule.monthlyLimit)}</span>
                    </span>
                    <span className="flex items-center justify-between text-xs md:block md:text-right">
                      <span className="text-muted-foreground md:hidden">Reachable</span>
                      <span className={cn("amount font-semibold", remaining > 0 ? "text-success" : "text-muted-foreground")}>
                        {formatINR(remaining)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
              <div className="bg-card px-5 py-3">
                <dt className="label-caps">Consumed</dt>
                <dd className="amount mt-1 text-sm font-semibold">{formatINR(totalConsumed)}</dd>
              </div>
              <div className="bg-card px-5 py-3">
                <dt className="label-caps">Still reachable</dt>
                <dd className="amount mt-1 text-sm font-semibold text-success">{formatINR(maxPossibleSpend)}</dd>
              </div>
              <div className="bg-card px-5 py-3">
                <dt className="label-caps">Withdrawn</dt>
                <dd className="amount mt-1 text-sm font-semibold text-destructive">{formatINR(withdrawnAuthority)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="authority-inspector surface-card overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <ApprovalGlyph className="h-4 w-4 text-success" />
              <h2 className="text-base font-semibold">Selected authority</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Provenance, capacity and conservation.
            </p>
          </div>
          {selectedAgent ? (
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{selectedAgent.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {selectedAgent.authorityId} · {selectedAgent.mandateId}
                  </p>
                </div>
                {selectedTone ? (
                  <StatusPill
                    tone={selectedTone.tone}
                    label={selectedTone.label}
                  />
                ) : null}
              </div>

              <div className="mt-5 rounded-md border border-border bg-muted/25 p-4">
                <p className="label-caps">Source lineage</p>
                <ol className="mt-3 space-y-2 text-xs">
                  <li>{profile.username} · Principal</li>
                  <li className="pl-3 text-muted-foreground">
                    ↓ {selectedAgent.rule.category} authority
                  </li>
                  <li className="pl-6 font-medium">↓ {selectedAgent.name}</li>
                </ol>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-xs">
                <div className="bg-card p-3">
                  <dt className="label-caps">Derived</dt>
                  <dd className="amount mt-2 font-medium">
                    {formatINR(selectedAgent.rule.monthlyLimit)}
                  </dd>
                </div>
                <div className="bg-card p-3">
                  <dt className="label-caps">Delegation</dt>
                  <dd className="mt-2 font-medium">{selectedAgent.rule.allowDelegation ? "Allowed" : "Not allowed"}</dd>
                </div>
                <div className="bg-card p-3">
                  <dt className="label-caps">Consumed</dt>
                  <dd className="amount mt-2 font-medium">
                    {formatINR(selectedAgent.consumed)}
                  </dd>
                </div>
                <div className="bg-raised p-3">
                  <dt className="label-caps">Remaining</dt>
                  <dd className="amount mt-2 font-medium">
                    {formatINR(selectedRemaining)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Conservation</span>
                  <span>
                    {formatINR(selectedAgent.rule.monthlyLimit)} source capacity
                  </span>
                </div>
                <AuthorityBar
                  consumed={selectedAgent.consumed}
                  limit={selectedAgent.rule.monthlyLimit}
                  muted={selectedAgent.status === "revoked"}
                />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {formatINR(selectedAgent.consumed)} consumed +{" "}
                  {formatINR(selectedRemaining)} unallocated
                  {selectedAgent.status === "revoked"
                    ? ` + ${formatINR(selectedAgent.rule.monthlyLimit - selectedAgent.consumed)} withdrawn`
                    : ""}
                  {" = "}
                  {formatINR(selectedAgent.rule.monthlyLimit)}
                </p>
              </div>

              <Button variant="outline" className="mt-5 w-full" asChild>
                <Link
                  href={`/agents/${selectedAgent.id}`}
                >
                  Inspect mandate <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : null}
          </div>

          <div className="surface-card min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <DecisionGlyph className="h-4 w-4 text-stepup" />
            <h2 className="text-base font-semibold">Authority timeline</h2>
          </div>
          {auditLoading ? <p className="px-5 py-7 text-sm text-muted-foreground">Loading authority events…</p> : auditError ? <p role="alert" className="px-5 py-7 text-sm text-destructive">Timeline unavailable. Please try again.</p> : auditData?.events.length ? (
          <ol className="max-h-[28rem] overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring" tabIndex={0} aria-label="Recent authority events">
            {auditData.events.map((event) => {
                const display = describeAuditEvent(event, agents, ledger);
                return (
                <li
                  key={event.eventId}
                  className={cn(
                    "relative border-b border-border last:border-b-0",
                    selectedEventId === event.eventId && "bg-raised",
                  )}
                >
                  <button
                    type="button"
                    className="w-full p-3 pl-10 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                    onClick={() => {
                      setSelectedEventId(event.eventId);
                      const grantId = typeof event.metadata?.grantId === "string" ? event.metadata.grantId : "";
                      const intentId = typeof event.metadata?.intentId === "string" ? event.metadata.intentId : "";
                      const affected = agents.find((agent) => agent.id === grantId || ledger.find((entry) => entry.id === intentId)?.agentId === agent.id);
                      if (affected) setSelectedAgentId(affected.id);
                    }}
                  >
                    <span className="absolute left-4 top-[.85rem] grid h-4 w-4 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <ArrowDownRight className="h-2.5 w-2.5" />
                    </span>
                    <span className="mb-2 inline-flex rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{display.tag}</span>
                    <p className="text-sm font-medium capitalize">{display.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {display.detail}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</p>
                  </button>
                </li>
              );})}
          </ol>
          ) : <div className="px-5 py-7"><p className="text-sm font-semibold">No data available</p><p className="mt-1 text-sm text-muted-foreground">Mandate and payment events will appear here once they are recorded for this account.</p></div>}
          </div>
        </div>
      </section>
    </div>
  );
}
