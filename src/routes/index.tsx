import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthorityBar,
  Metric,
  PageHeader,
  StatusPill,
  agentTone,
  ledgerTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — KavachPay agent spending control" },
      {
        name: "description",
        content:
          "See live agent authority, remaining spend, pending step-up approvals and the latest payment decisions in one console.",
      },
      { property: "og:title", content: "Overview — KavachPay agent spending control" },
      {
        property: "og:description",
        content:
          "Live agent authority, remaining spend, pending approvals and recent payment decisions.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const {
    agents,
    ledger,
    approvals,
    frozen,
    remainingFor,
    maxPossibleSpend,
    totalAuthority,
    totalConsumed,
  } = useKavach();

  const activeAgents = agents.filter((a) => a.status !== "revoked");
  const recent = ledger.slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Authority overview"
        description="Every AI agent spends under a scoped mandate. This is the live position across all of them."
        actions={
          <Button asChild>
            <Link to="/rules">
              Issue a mandate
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Maximum possible spend"
          value={formatINR(maxPossibleSpend)}
          hint={
            frozen
              ? "Emergency stop active — all authority suspended"
              : "Worst case if every agent spent its full remaining authority"
          }
          tone={frozen ? "stepup" : "primary"}
        />
        <Metric
          label="Authority granted"
          value={formatINR(totalAuthority)}
          hint={`${activeAgents.length} live mandates this month`}
        />
        <Metric
          label="Spent this month"
          value={formatINR(totalConsumed)}
          hint="Across all allowed agent payments"
          tone="success"
        />
        <Metric
          label="Awaiting your approval"
          value={String(approvals.length)}
          hint={approvals.length ? "Step-up approvals pending" : "Nothing waiting on you"}
          tone={approvals.length ? "stepup" : "default"}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Agents</h2>
            <p className="text-sm text-muted-foreground">
              Authority consumed against each monthly rule.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/agents">View all agents</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => {
            const tone = agentTone(agent.status);
            const remaining = remainingFor(agent);
            return (
              <Link
                key={agent.id}
                to="/agents/$agentId"
                params={{ agentId: agent.id }}
                className="surface-card block p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{agent.name}</p>
                    <p className="amount text-xs text-muted-foreground">
                      {agent.mandateId}
                    </p>
                  </div>
                  <StatusPill tone={tone.tone} label={tone.label} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {agent.purpose}
                </p>
                <div className="mt-4 space-y-2">
                  <AuthorityBar
                    consumed={agent.consumed}
                    limit={agent.rule.monthlyLimit}
                    muted={agent.status === "revoked" || frozen}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="amount">
                      {formatINR(agent.consumed)} of {formatINR(agent.rule.monthlyLimit)}
                    </span>
                    <span className="amount">{formatINR(remaining)} left</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recent decisions</h2>
            <p className="text-sm text-muted-foreground">
              Every attempted agent payment and why it was allowed or stopped.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/activity">Full activity</Link>
          </Button>
        </div>
        <ul className="surface-card divide-y divide-border">
          {recent.map((entry) => {
            const tone = ledgerTone(entry.status);
            return (
              <li key={entry.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.merchant}</p>
                    <StatusPill tone={tone.tone} label={tone.label} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>
                </div>
                <div className="sm:text-right">
                  <p className="amount font-medium">{formatINR(entry.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
