"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  AgentGlyph,
  AuthorityGlyph,
  DecisionGlyph,
  MandateGlyph,
} from "@/components/kavach/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AuthorityBar,
  Metric,
  StatusPill,
  agentTone,
  ledgerTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import {
  CATEGORIES,
  formatDate,
  formatDateTime,
  formatINR,
} from "@/lib/kavach-data";

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const {
    getAgent,
    ledger,
    remainingFor,
    revokeAgent,
    restoreAgent,
    updateRule,
    frozen,
    maxPossibleSpend,
  } = useKavach();
  const agent = getAgent(agentId);

  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [monthly, setMonthly] = useState("");
  const [perTxn, setPerTxn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fullEditOpen, setFullEditOpen] = useState(false);
  const [fullCategory, setFullCategory] = useState(
    agent?.rule.category ?? "Groceries",
  );
  const [fullPeriod, setFullPeriod] = useState(
    agent?.rule.window ?? "Calendar month",
  );
  const [fullMerchants, setFullMerchants] = useState(
    agent?.rule.merchants.join(", ") ?? "",
  );
  const [fullExpiry, setFullExpiry] = useState(
    agent?.rule.expiresOn ?? "2026-09-30",
  );
  const [fullDelegation, setFullDelegation] = useState(
    agent?.rule.allowDelegation ?? false,
  );

  if (!agent) {
    return (
      <div className="surface-card p-8 text-center">
        <h1 className="text-xl font-semibold">Mandate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This agent is not part of your account.
        </p>
        <Button className="mt-5" asChild>
          <Link href="/agents">Back to agents</Link>
        </Button>
      </div>
    );
  }

  const tone = agentTone(agent.status);
  const entries = ledger.filter((e) => e.agentId === agent.id);
  const monthlyValue =
    monthly === "" ? String(agent.rule.monthlyLimit) : monthly;
  const perTxnValue =
    perTxn === "" ? String(agent.rule.perTransactionCap) : perTxn;
  const proposedLimit = Number(monthlyValue);
  const exposureDelta = Number.isFinite(proposedLimit)
    ? proposedLimit - agent.rule.monthlyLimit
    : 0;

  const saveRule = (event: React.FormEvent) => {
    event.preventDefault();
    const m = Number(monthlyValue);
    const p = Number(perTxnValue);
    if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(p) || p <= 0) {
      setError("Both limits must be amounts greater than zero.");
      return;
    }
    if (p > m) {
      setError("The automatic threshold cannot exceed the period authority.");
      return;
    }
    if (m < agent.consumed) {
      setError(
        `Period authority cannot be below the ${formatINR(agent.consumed)} already spent.`,
      );
      return;
    }
    setError(null);
    updateRule(agent.id, {
      ...agent.rule,
      monthlyLimit: m,
      perTransactionCap: p,
    });
    toast.success("Spending rule updated", {
      description: `${agent.name} now holds ${formatINR(m)} for ${agent.rule.window.toLowerCase()}.`,
    });
  };

  return (
    <div className="agent-detail-page space-y-7">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All agents
        </Link>
        <div className="mt-4 grid gap-5 border-b border-border pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
              mandate
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-muted/50 text-primary">
                <AgentGlyph className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
                {agent.name}
              </h1>
              <StatusPill tone={tone.tone} label={tone.label} />
            </div>
            <p className="amount mt-1 text-xs text-muted-foreground">
              {agent.mandateId} · issued {formatDate(agent.issuedOn)}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {agent.purpose}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {agent.status === "revoked" ? (
              <Button
                onClick={() => {
                  restoreAgent(agent.id);
                  toast.success("Mandate reinstated", {
                    description: `${agent.name} can transact again within its rule.`,
                  });
                }}
              >
                Restore authority
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setConfirmRevoke(true)}
              >
                Revoke authority
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="agent-detail-ribbon grid gap-4 sm:grid-cols-3">
        <Metric
          label={
            agent.rule.window === "Calendar week"
              ? "Weekly authority"
              : "Monthly authority"
          }
          value={formatINR(agent.rule.monthlyLimit)}
          hint={agent.rule.window}
        />
        <Metric
          label="Consumed"
          value={formatINR(agent.consumed)}
          hint="Allowed payments this month"
          tone="success"
        />
        <Metric
          label="Remaining"
          value={formatINR(remainingFor(agent))}
          hint={
            frozen
              ? "Suspended by emergency stop"
              : "Available to this agent now"
          }
          tone={frozen ? "stepup" : "primary"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)] xl:items-start">
        <section className="agent-mandate-panel surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <AuthorityGlyph className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Enforced authority</h2>
          </div>
          <div className="mt-4 space-y-2">
            <AuthorityBar
              consumed={agent.consumed}
              limit={agent.rule.monthlyLimit}
              muted={agent.status === "revoked" || frozen}
            />
            <p className="amount text-xs text-muted-foreground">
              {formatINR(agent.consumed)} of{" "}
              {formatINR(agent.rule.monthlyLimit)}
            </p>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="label-caps">Category</dt>
              <dd className="mt-1 text-sm font-medium">
                {agent.rule.category}
              </dd>
            </div>
            <div>
              <dt className="label-caps">Reset window</dt>
              <dd className="mt-1 text-sm font-medium">{agent.rule.window}</dd>
            </div>
            <div>
              <dt className="label-caps">Automatic threshold</dt>
              <dd className="amount mt-1 text-sm font-medium">
                {formatINR(agent.rule.perTransactionCap)}
              </dd>
            </div>
            <div>
              <dt className="label-caps">Expiry</dt>
              <dd className="mt-1 text-sm font-medium">
                {agent.rule.expiresOn
                  ? formatDate(agent.rule.expiresOn)
                  : "No fixed expiry"}
              </dd>
            </div>
            <div>
              <dt className="label-caps">Delegation</dt>
              <dd className="mt-1 text-sm font-medium">
                {agent.rule.allowDelegation
                  ? `Allowed · depth ${agent.rule.delegationDepth ?? 1}`
                  : "Not allowed"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label-caps">Approved merchants</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {agent.rule.merchants.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <section className="agent-rule-panel surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <MandateGlyph className="h-4 w-4 text-stepup" />
            <h2 className="text-base font-semibold">Adjust spending rule</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Changes apply to the next payment this agent attempts.
          </p>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={saveRule}
            noValidate
          >
            <div className="grid gap-1.5">
              <Label htmlFor="monthly">Period authority (₹)</Label>
              <Input
                id="monthly"
                inputMode="numeric"
                value={monthlyValue}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pertxn">Automatic threshold (₹)</Label>
              <Input
                id="pertxn"
                inputMode="numeric"
                value={perTxnValue}
                onChange={(e) => setPerTxn(e.target.value)}
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="text-sm text-destructive sm:col-span-2"
              >
                {error}
              </p>
            ) : null}
            {exposureDelta !== 0 ? (
              <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border text-xs sm:col-span-2 sm:grid-cols-3">
                <div className="bg-card p-3">
                  <p className="label-caps">Current</p>
                  <p className="amount mt-2 font-medium">
                    {formatINR(agent.rule.monthlyLimit)}
                  </p>
                </div>
                <div className="bg-card p-3">
                  <p className="label-caps">Proposed</p>
                  <p className="amount mt-2 font-medium">
                    {formatINR(proposedLimit)}
                  </p>
                </div>
                <div className="bg-raised p-3">
                  <p className="label-caps">Exposure impact</p>
                  <p className="amount mt-2 font-medium">
                    {exposureDelta > 0 ? "+" : ""}
                    {formatINR(exposureDelta)}
                  </p>
                </div>
                <p className="bg-muted/40 p-3 text-muted-foreground sm:col-span-3">
                  Maximum reachable exposure changes from{" "}
                  {formatINR(maxPossibleSpend)} to{" "}
                  {formatINR(Math.max(0, maxPossibleSpend + exposureDelta))}.
                </p>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Apply change</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFullEditOpen(true)}
                >
                  Edit full mandate
                </Button>
              </div>
            </div>
          </form>
        </section>
      </div>

      <section className="agent-history-panel surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <DecisionGlyph className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Decision history</h2>
          </div>
          <span className="amount text-xs text-muted-foreground">
            {entries.length} events
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            This agent has not attempted a payment yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => {
              const t = ledgerTone(entry.status);
              return (
                <li
                  key={entry.id}
                  className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{entry.merchant}</p>
                      <StatusPill tone={t.tone} label={t.label} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.reason}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="amount font-medium">
                      {formatINR(entry.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {agent.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatINR(remainingFor(agent))} of remaining authority is
              withdrawn immediately and any pending approval for this agent is
              cancelled. You can restore the mandate later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                revokeAgent(agent.id);
                setConfirmRevoke(false);
                toast.success("Authority revoked", {
                  description: `${agent.name} can no longer spend.`,
                });
              }}
            >
              Revoke authority
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={fullEditOpen} onOpenChange={setFullEditOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="text-left">
            <SheetTitle>Edit full mandate</SheetTitle>
            <SheetDescription>
              Change scope, period and delegation boundaries. The impact is
              recorded in the authority timeline.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="full-category">Policy scope</Label>
              <select
                id="full-category"
                value={fullCategory}
                onChange={(event) => setFullCategory(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full-period">Budget period</Label>
              <select
                id="full-period"
                value={fullPeriod}
                onChange={(event) => setFullPeriod(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Calendar month">Calendar month</option>
                <option value="Calendar week">Calendar week</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full-merchants">Approved merchants</Label>
              <Input
                id="full-merchants"
                value={fullMerchants}
                onChange={(event) => setFullMerchants(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full-expiry">Expiry</Label>
              <Input
                id="full-expiry"
                type="date"
                value={fullExpiry}
                onChange={(event) => setFullExpiry(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-4">
              <div>
                <Label htmlFor="full-delegation">Allow child delegation</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum depth remains one level.
                </p>
              </div>
              <Switch
                id="full-delegation"
                checked={fullDelegation}
                onCheckedChange={setFullDelegation}
              />
            </div>
            <div className="rounded-md border border-border bg-muted/25 p-4 text-xs text-muted-foreground">
              Current exposure remains {formatINR(maxPossibleSpend)}. This edit
              changes policy scope, not the period authority amount.
            </div>
            <Button
              onClick={() => {
                const nextMerchants = fullMerchants
                  .split(",")
                  .map((merchant) => merchant.trim())
                  .filter(Boolean);
                if (nextMerchants.length === 0) {
                  toast.error("Add at least one approved merchant.");
                  return;
                }
                updateRule(agent.id, {
                  ...agent.rule,
                  category: fullCategory,
                  window: fullPeriod,
                  merchants: nextMerchants,
                  expiresOn: fullExpiry,
                  allowDelegation: fullDelegation,
                  delegationDepth: fullDelegation ? 1 : 0,
                });
                setFullEditOpen(false);
                toast.success("Full mandate updated");
              }}
            >
              Apply mandate changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
