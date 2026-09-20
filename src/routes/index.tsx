"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CreditCard,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CountUpValue,
} from "@/components/ui/motion-primitives";
import {
  StatusPill,
  ledgerTone,
} from "@/components/kavach/primitives";
import { AuthorityRing } from "@/components/kavach/authority-ring";
import {
  ApprovalGlyph,
  DecisionGlyph,
  MandatePlusGlyph,
  ReviewGlyph,
} from "@/components/kavach/icons";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";
import {
  usePaymentProfiles,
  countMandatesBoundToProfile,
} from "@/lib/payment-profiles";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

// ── PaymentSetupCard ──────────────────────────────────────────────────────────

function PaymentSetupCard({
  ordersCreated,
  ordersCaptured,
  ordersFailed,
  ordersPending,
}: {
  ordersCreated: number;
  ordersCaptured: number;
  ordersFailed: number;
  ordersPending: number;
}) {
  const { data: profiles, isLoading } = usePaymentProfiles();
  const { data: grantsData } = useQuery({
    queryKey: ["grants"],
    queryFn: () => apiClient.getGrants(),
    staleTime: 30_000,
    retry: 1,
  });

  const activeProfiles = (profiles ?? []).filter((p) => p.status === "ACTIVE");
  const primaryProfile = activeProfiles[0] ?? profiles?.[0];

  const mandateCount = primaryProfile && grantsData?.grants
    ? countMandatesBoundToProfile(
        grantsData.grants as Array<{ paymentProfileId?: string; parentGrantId?: string }>,
        primaryProfile.paymentProfileId
      )
    : 0;

  return (
    <div className="border-t border-border bg-muted/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-card">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground label-caps">
              Payment Setup
            </p>
            {isLoading ? (
              <p className="mt-1 h-4 w-40 animate-pulse rounded bg-muted" />
            ) : primaryProfile ? (
              <>
                <p className="mt-1 text-sm font-medium flex items-center gap-2">
                  {primaryProfile.displayName}
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
                    TEST MODE
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                  {primaryProfile.paymentProfileId}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
                      primaryProfile.status === "ACTIVE"
                        ? "border border-success/30 bg-success/10 text-success"
                        : "border border-border bg-muted/30 text-muted-foreground"
                    )}
                  >
                    {primaryProfile.status === "ACTIVE" ? "● ACTIVE" : "DISABLED"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    SIMULATED TEST PROFILE
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {mandateCount} {mandateCount === 1 ? "mandate" : "mandates"}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No payment profile configured.{" "}
                <Link href="/payment-methods" className="text-primary underline-offset-2 hover:underline">
                  Set up now
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-2 text-sm">
          {([
            ["Orders created", ordersCreated],
            ["Captured", ordersCaptured],
            ["Failed", ordersFailed],
            ["Pending", ordersPending],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label}>
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium ml-2">{val}</span>
            </div>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link href="/payment-methods">Manage payment methods</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}



function MetricCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "default" | "success" | "stepup";
}) {
  return (
    <div className="metric-cell px-5 py-4">
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <p className="label-caps">{label}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
        </div>
        <p className={cn("amount text-xl font-medium tracking-tight", tone === "success" && "text-success", tone === "stepup" && "text-stepup")}>
          <CountUpValue value={value} format={formatINR} />
        </p>
      </div>
    </div>
  );
}

export default function Overview() {
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
  const primaryApproval = approvals[0];
  const approvalAgent = primaryApproval
    ? agents.find((agent) => agent.id === primaryApproval.agentId)
    : undefined;

  const ordersCreated = ledger.filter(entry => entry.execution && entry.execution.status !== "NOT_INVOKED").length;
  const ordersCaptured = ledger.filter(entry => entry.execution?.status === "PROVIDER_CAPTURED").length;
  const ordersFailed = ledger.filter(entry => entry.execution?.status === "PROVIDER_FAILED").length;
  const ordersPending = ledger.filter(entry => entry.execution?.status === "PROVIDER_PENDING" || entry.execution?.status === "SUBMITTED_TO_PROVIDER").length;

  return (
    <div className="space-y-6 lg:space-y-7">
      <header className="page-heading relative flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-xs font-medium text-destructive">Live control plane</p>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[2rem]">
            Control center
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Current financial authority across agents, mandates and pending decisions.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/rules">
            <MandatePlusGlyph className="h-4 w-4" />
            Create mandate
          </Link>
        </Button>
      </header>

      <section className="exposure-console surface-card overflow-hidden" aria-label="Authority summary">
        <div className="grid lg:grid-cols-[minmax(0,.9fr)_minmax(440px,1.1fr)]">
          <div className="exposure-overview border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="exposure-overview-inner">
              <div className="min-w-0">
                <p className="text-sm font-medium">Reachable exposure</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Maximum that active agents can spend without another decision</p>
                <p className="amount mt-5 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
                  <CountUpValue value={maxPossibleSpend} format={formatINR} />
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  of <span className="amount text-foreground">{formatINR(totalAuthority)}</span> granted authority
                </p>
                <div className="mt-4 space-y-2 border-t border-border pt-3 text-base sm:text-lg">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Spendable agents</span>
                    <strong className="font-semibold tabular-nums">{activeAgents.length} of {agents.length}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Policy enforcement</span>
                    <strong className={cn("font-semibold", frozen ? "text-destructive" : "text-success")}>{frozen ? "Stopped" : "Live"}</strong>
                  </div>
                </div>
              </div>
              <div className="exposure-overview-ring flex min-w-0 items-center justify-center">
                <AuthorityRing total={totalAuthority} remaining={maxPossibleSpend} frozen={frozen} />
              </div>
            </div>
          </div>

          <div className="exposure-ledger">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-sm font-medium">Exposure by agent</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Remaining autonomous authority</p>
              </div>
              <Link href="/authority" className="text-xs font-medium hover:text-destructive">Open graph →</Link>
            </div>
            <div className="data-scroll-region data-scroll-region--exposure" role="region" aria-label="Exposure by agent list" tabIndex={0}>
              {agents.map((agent) => {
                const remaining = remainingFor(agent);
                const pct = totalAuthority ? (remaining / totalAuthority) * 100 : 0;
                return (
                  <Link key={agent.id} href={`/agents/${agent.id}`} className="exposure-ledger-row grid grid-cols-[minmax(130px,1fr)_minmax(100px,.8fr)_auto] items-center gap-4 border-b border-border px-5 py-3 last:border-b-0 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{agent.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{agent.rule.category}</p>
                    </div>
                    <div className="h-1.5 overflow-hidden bg-muted">
                      <div className={cn("authority-fill h-full", agent.status === "active" ? "bg-success" : "bg-muted-foreground/35")} style={{width: `${Math.min(100, pct * 3)}%`}} />
                    </div>
                    <span className="amount w-20 text-right text-xs font-medium">{formatINR(remaining)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="exposure-metrics grid border-t border-border bg-card sm:grid-cols-3">
          <MetricCard
            label="Authority granted"
            value={totalAuthority}
            helper={`${agents.filter((agent) => agent.status !== "revoked").length} live mandates`}
          />
          <MetricCard
            label="Spent this month"
            value={totalConsumed}
            helper={`${totalAuthority ? Math.round((totalConsumed / totalAuthority) * 100) : 0}% of active authority used`}
            tone="success"
          />
          <MetricCard
            label="Under review"
            value={approvals.reduce(
              (sum, approval) => sum + approval.amount,
              0,
            )}
            helper={`${approvals.length} ${approvals.length === 1 ? "request" : "requests"} awaiting your decision`}
            tone="stepup"
          />
        </div>
        
        <PaymentSetupCard ordersCreated={ordersCreated} ordersCaptured={ordersCaptured} ordersFailed={ordersFailed} ordersPending={ordersPending} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.85fr)]">
        <div className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <DecisionGlyph className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Decision feed</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                An explainable record of every recent payment intent.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/activity">
                Open decisions <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="decision-table w-full min-w-[700px] text-left text-sm">
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
                    <tr key={entry.id} className="border-b border-border last:border-b-0 hover:bg-muted/25">
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{entry.merchant}</p>
                        <p className="max-w-[250px] truncate text-xs text-muted-foreground">{entry.description}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{agent?.name ?? "Unknown"}</td>
                      <td className="amount px-4 py-3.5 text-right font-medium">{formatINR(entry.amount)}</td>
                      <td className="px-4 py-3.5"><StatusPill tone={tone.tone} label={tone.label} /></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-muted-foreground">{formatDateTime(entry.at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface-card flex min-h-[370px] flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <ApprovalGlyph className="h-4 w-4 text-stepup" />
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
                <ReviewGlyph className="h-5 w-5 text-stepup" />
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
              {approvalAgent ? (
                <p className="mt-2 rounded-md border border-border bg-muted/25 p-3 text-xs text-muted-foreground">
                  If approved, {formatINR(primaryApproval.amount)} executes
                  once; remaining authority becomes{" "}
                  {formatINR(
                    Math.max(
                      0,
                      remainingFor(approvalAgent) - primaryApproval.amount,
                    ),
                  )}
                  . The mandate stays unchanged.
                </p>
              ) : null}
              <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
                <Button
                  variant="destructive"
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
                  <Link href="/approvals">
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

      <PaymentSetupCard
        ordersCreated={ordersCreated}
        ordersCaptured={ordersCaptured}
        ordersFailed={ordersFailed}
        ordersPending={ordersPending}
      />
    </div>
  );
}
