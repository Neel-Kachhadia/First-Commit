"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, History, ExternalLink } from "lucide-react";
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
import { formatDateTime, formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

export default function AuthorityPage() {
  const {
    history,
    maxPossibleSpend,
    totalAuthority,
    agents,
    frozen,
    remainingFor,
  } = useKavach();
  const points = history.map((event) => event.maxSpend);
  const peak = Math.max(...points, maxPossibleSpend, 1);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const selectedRemaining = selectedAgent ? remainingFor(selectedAgent) : 0;
  const selectedTone = selectedAgent ? agentTone(selectedAgent.status) : null;

  return (
    <div className="authority-page space-y-7">
      <PageHeader
        title="Authority universe"
        description="A live map of who can spend, how much remains, and every event that changed your financial blast radius."
        actions={
          <Button variant="outline" asChild>
            <Link href="/rules">Create child mandate</Link>
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
          value={formatINR(Math.max(0, peak - maxPossibleSpend))}
          hint="Consumed or revoked since this month's peak"
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
        <div className="authority-map surface-card overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <AuthorityGlyph className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Authority lineage</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Every mandate derives from the account owner's authority.
              </p>
            </div>
            <span className="rounded-md border border-success/25 bg-success/10 px-2 py-1 text-[10px] font-medium text-success">
              Live graph
            </span>
          </div>

          <div className="relative min-h-[390px] overflow-hidden p-5 sm:p-8">
            <div className="authority-grid absolute inset-0 opacity-35" />
            <div className="relative mx-auto flex max-w-3xl flex-col items-center">
              <div className="rounded-lg border border-primary/35 bg-primary/8 px-5 py-3 text-center">
                <p className="text-sm font-semibold">Ananya Iyer</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Principal · 100% control
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="relative h-px w-[76%] bg-border before:absolute before:left-0 before:top-0 before:h-5 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:h-5 after:w-px after:bg-border" />
              <div className="mt-5 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        "authority-node group rounded-[6px] border border-border bg-card p-4 text-left transition-all hover:border-foreground/25",
                        selectedAgentId === agent.id &&
                          "border-foreground/40 bg-raised ring-1 ring-foreground/10",
                        selectedAgentId !== agent.id &&
                          selectedAgentId &&
                          "opacity-65 hover:opacity-100",
                        agent.status === "revoked" && "border-dashed",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-primary">
                          <AgentGlyph className="h-3.5 w-3.5" />
                        </span>
                        <StatusPill
                          tone={tone.tone}
                          label={tone.label}
                          className="px-2 text-[10px]"
                        />
                      </div>
                      <p className="mt-4 text-sm font-medium">{agent.name}</p>
                      <p className="amount mt-1 text-lg font-medium">
                        {formatINR(remainingFor(agent))}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
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
                  <li>Ananya Iyer · Principal</li>
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
                  <dd className="mt-2 font-medium">Level 1 of 2</dd>
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
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
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
          <div className="flex items-center gap-2 border-b border-border p-5">
            <DecisionGlyph className="h-4 w-4 text-stepup" />
            <h2 className="text-base font-semibold">Authority timeline</h2>
          </div>
          <ol>
            {[...history]
              .reverse()
              .slice(0, 5)
              .map((event) => (
                <li
                  key={event.id}
                  className={cn(
                    "relative border-b border-border last:border-b-0",
                    selectedEventId === event.id && "bg-raised",
                  )}
                >
                  <button
                    type="button"
                    className="w-full p-4 pl-10 text-left"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      const affected = agents.find((agent) =>
                        event.label
                          .toLowerCase()
                          .includes(agent.name.toLowerCase()),
                      );
                      if (affected) setSelectedAgentId(affected.id);
                    }}
                  >
                    <span className="absolute left-4 top-[1.15rem] grid h-4 w-4 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <ArrowDownRight className="h-2.5 w-2.5" />
                    </span>
                    <span className="mb-2 inline-flex rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {event.label.includes("revoked")
                        ? "REVOCATION"
                        : event.label.includes("spent")
                          ? "SPEND"
                          : "MANDATE"}
                    </span>
                    <p className="text-xs font-medium">{event.label}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {event.detail}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                      <span>{formatDateTime(event.at)}</span>
                      <span className="amount text-foreground">
                        {formatINR(event.maxSpend)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
