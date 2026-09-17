import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Network,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AnimatedList,
  CountUpValue,
  SpotlightCard,
} from "@/components/ui/motion-primitives";
import {
  AuthorityBar,
  StatusPill,
  agentTone,
  ledgerTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — KavachPay" },
      {
        name: "description",
        content:
          "Monitor live financial authority, exposure, approvals and agent payment decisions.",
      },
    ],
  }),
  component: Overview,
});

const currency = (value: number) => formatINR(value);

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default",
  progress,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Activity;
  tone?: "default" | "success" | "stepup";
  progress?: number;
}) {
  return (
    <SpotlightCard className="metric-card min-h-36 p-4 sm:p-5">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="label-caps">{label}</p>
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md border",
              tone === "success" &&
                "border-success/25 bg-success/10 text-success",
              tone === "stepup" && "border-stepup/25 bg-stepup/10 text-stepup",
              tone === "default" &&
                "border-border bg-muted/60 text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="amount mt-3 text-2xl font-medium tracking-tight sm:text-[1.7rem]">
          <CountUpValue value={value} format={currency} />
        </p>
        <p className="mt-auto pt-2 text-xs text-muted-foreground">{helper}</p>
        {progress !== undefined ? (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-[width] duration-700"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        ) : null}
      </div>
    </SpotlightCard>
  );
}

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
    approveRequest,
    denyRequest,
  } = useKavach();

  const activeAgents = agents.filter((agent) => agent.status === "active");
  const spendableShare = totalAuthority
    ? Math.round((maxPossibleSpend / totalAuthority) * 100)
    : 0;
  const primaryApproval = approvals[0];
  const approvalAgent = primaryApproval
    ? agents.find((agent) => agent.id === primaryApproval.agentId)
    : undefined;

  return (
    <div className="space-y-6 lg:space-y-7">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/8 px-2.5 py-1 text-[11px] font-medium text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Control plane live
            </span>
            <span className="text-xs text-muted-foreground">
              Last evaluated 12 seconds ago
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
            Financial authority, at a glance
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            See what every agent can spend, what needs your approval, and why
            money moved.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link to="/rules">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Create mandate
          </Link>
        </Button>
      </header>

      <section
        className="grid gap-4 xl:grid-cols-[1.3fr_2fr]"
        aria-label="Authority summary"
      >
        <SpotlightCard className="exposure-card overflow-hidden p-5 sm:p-6">
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-caps text-primary/90">
                  Maximum reachable exposure
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Worst case if every agent spends now
                </p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Network className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="amount mt-8 text-4xl font-medium tracking-[-0.055em] sm:text-5xl">
              <CountUpValue value={maxPossibleSpend} format={currency} />
            </p>
            <div className="mt-8">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Spendable authority
                </span>
                <span className="amount font-medium">{spendableShare}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/60 ring-1 ring-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700",
                    frozen ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${frozen ? 0 : spendableShare}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{activeAgents.length} agents actively spendable</span>
                <Link
                  to="/authority"
                  className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                >
                  Inspect graph <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </SpotlightCard>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Authority granted"
            value={totalAuthority}
            helper={`${agents.filter((agent) => agent.status !== "revoked").length} live mandates`}
            icon={WalletCards}
          />
          <MetricCard
            label="Spent this month"
            value={totalConsumed}
            helper={`${Math.round((totalConsumed / totalAuthority) * 100)}% of active authority used`}
            icon={Activity}
            tone="success"
            progress={(totalConsumed / totalAuthority) * 100}
          />
          <MetricCard
            label="Needs your approval"
            value={approvals.reduce(
              (sum, approval) => sum + approval.amount,
              0,
            )}
            helper={`${approvals.length} ${approvals.length === 1 ? "request" : "requests"} waiting`}
            icon={Clock3}
            tone="stepup"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.85fr)]">
        <div className="surface-card overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-base font-semibold">Live authority</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Remaining authority across every connected agent.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/agents">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <AnimatedList>
            {agents.map((agent) => {
              const tone = agentTone(agent.status);
              const remaining = remainingFor(agent);
              return (
                <Link
                  key={agent.id}
                  to="/agents/$agentId"
                  params={{ agentId: agent.id }}
                  className="agent-row group grid gap-4 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(180px,1.1fr)_minmax(150px,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-muted/50 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {agent.name}
                        </p>
                        <p className="amount truncate text-[11px] text-muted-foreground">
                          {agent.mandateId}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{formatINR(agent.consumed)} used</span>
                      <span className="amount text-foreground">
                        {formatINR(remaining)} left
                      </span>
                    </div>
                    <AuthorityBar
                      consumed={agent.consumed}
                      limit={agent.rule.monthlyLimit}
                      muted={agent.status === "revoked" || frozen}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusPill tone={tone.tone} label={tone.label} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                </Link>
              );
            })}
          </AnimatedList>
        </div>

        <div className="surface-card flex min-h-[370px] flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-stepup"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold">Approval queue</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Human review, only when policy requires it.
              </p>
            </div>
            <span className="amount rounded-md border border-stepup/25 bg-stepup/10 px-2 py-1 text-xs font-medium text-stepup">
              {approvals.length} waiting
            </span>
          </div>

          {primaryApproval ? (
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Requested by {approvalAgent?.name}
                  </p>
                  <p className="amount mt-2 text-3xl font-medium tracking-tight">
                    {formatINR(primaryApproval.amount)}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {primaryApproval.merchant}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {primaryApproval.description}
                  </p>
                </div>
                <Clock3 className="h-5 w-5 text-stepup" aria-hidden="true" />
              </div>
              <div className="mt-5 rounded-md border border-stepup/20 bg-stepup/8 p-3">
                <div className="flex items-start gap-2">
                  <CircleAlert
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stepup"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-medium">
                      Why your approval is needed
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {primaryApproval.reason}.
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Requested {formatDateTime(primaryApproval.requestedAt)} ·
                One-time exception only
              </p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
                <Button
                  variant="outline"
                  onClick={() => denyRequest(primaryApproval.id)}
                >
                  <X className="h-4 w-4" /> Deny
                </Button>
                <Button onClick={() => approveRequest(primaryApproval.id)}>
                  <Check className="h-4 w-4" /> Approve once
                </Button>
              </div>
              {approvals.length > 1 ? (
                <Button variant="ghost" size="sm" className="mt-2" asChild>
                  <Link to="/approvals">
                    Review {approvals.length - 1} more requests
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-success/10 text-success">
                  <Check className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-medium">
                  Nothing needs your attention
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New step-up requests will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold">Decision feed</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              An explainable record of every recent payment intent.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/activity">
              Open activity log <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="decision-table w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-5 py-3 font-medium">Merchant & intent</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Decision</th>
                <th className="px-5 py-3 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 5).map((entry) => {
                const tone = ledgerTone(entry.status);
                const agent = agents.find((item) => item.id === entry.agentId);
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/25"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{entry.merchant}</p>
                      <p className="max-w-[340px] truncate text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {agent?.name ?? "Unknown"}
                    </td>
                    <td className="amount px-4 py-3.5 text-right font-medium">
                      {formatINR(entry.amount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill tone={tone.tone} label={tone.label} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-muted-foreground">
                      {formatDateTime(entry.at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
