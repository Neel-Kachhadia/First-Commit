import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  Bot,
  GitBranch,
  History,
  Network,
  ShieldCheck,
} from "lucide-react";
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

export const Route = createFileRoute("/authority")({
  head: () => ({
    meta: [
      { title: "Authority universe — KavachPay" },
      {
        name: "description",
        content:
          "Inspect live financial authority, maximum reachable exposure, and the events that changed it.",
      },
    ],
  }),
  component: AuthorityPage,
});

function AuthorityPage() {
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

  return (
    <div className="space-y-7">
      <PageHeader
        title="Authority universe"
        description="A live map of who can spend, how much remains, and every event that changed your financial blast radius."
        actions={
          <Button variant="outline" asChild>
            <Link to="/rules">Create child mandate</Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
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
        <div className="surface-card overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-primary" />
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
                    <Link
                      key={agent.id}
                      to="/agents/$agentId"
                      params={{ agentId: agent.id }}
                      className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/35"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-primary">
                          <Bot className="h-3.5 w-3.5" />
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
                        remaining authority
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              <h2 className="text-base font-semibold">Exposure by agent</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Contribution to current blast radius.
            </p>
          </div>
          <div>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="border-b border-border p-4 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">{agent.name}</span>
                  <span className="amount">
                    {formatINR(remainingFor(agent))}
                  </span>
                </div>
                <div className="mt-2">
                  <AuthorityBar
                    consumed={remainingFor(agent)}
                    limit={maxPossibleSpend || 1}
                    muted={agent.status === "revoked"}
                  />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {maxPossibleSpend
                    ? Math.round((remainingFor(agent) / maxPossibleSpend) * 100)
                    : 0}
                  % of reachable exposure
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
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
            <History className="h-4 w-4 text-stepup" />
            <h2 className="text-base font-semibold">Authority timeline</h2>
          </div>
          <ol>
            {[...history]
              .reverse()
              .slice(0, 5)
              .map((event) => (
                <li
                  key={event.id}
                  className="relative border-b border-border p-4 pl-10 last:border-b-0"
                >
                  <span className="absolute left-4 top-[1.15rem] grid h-4 w-4 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <ArrowDownRight className="h-2.5 w-2.5" />
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
                </li>
              ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
