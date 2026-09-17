import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  History,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate, formatDateTime, formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/agents/$agentId")({
  head: () => ({
    meta: [
      { title: "Agent mandate — KavachPay" },
      {
        name: "description",
        content:
          "Inspect one agent's mandate: spending rule, approved merchants, consumed authority and its full decision history.",
      },
      { property: "og:title", content: "Agent mandate — KavachPay" },
      {
        property: "og:description",
        content:
          "Spending rule, approved merchants, consumed authority and decisions.",
      },
    ],
  }),
  component: AgentDetail,
});

function AgentDetail() {
  const { agentId } = useParams({ from: "/agents/$agentId" });
  const {
    getAgent,
    ledger,
    remainingFor,
    revokeAgent,
    restoreAgent,
    updateRule,
    frozen,
  } = useKavach();
  const agent = getAgent(agentId);

  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [monthly, setMonthly] = useState("");
  const [perTxn, setPerTxn] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!agent) {
    return (
      <div className="surface-card p-8 text-center">
        <h1 className="text-xl font-semibold">Mandate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This agent is not part of your account.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/agents">Back to agents</Link>
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

  const saveRule = (event: React.FormEvent) => {
    event.preventDefault();
    const m = Number(monthlyValue);
    const p = Number(perTxnValue);
    if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(p) || p <= 0) {
      setError("Both limits must be amounts greater than zero.");
      return;
    }
    if (p > m) {
      setError("The per-transaction cap cannot exceed the monthly limit.");
      return;
    }
    if (m < agent.consumed) {
      setError(
        `The monthly limit cannot be below the ${formatINR(agent.consumed)} already spent.`,
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
      description: `${agent.name} now holds ${formatINR(m)} of monthly authority.`,
    });
  };

  return (
    <div className="space-y-7">
      <div>
        <Link
          to="/agents"
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
                <Bot className="h-4 w-4" />
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

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Monthly authority"
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
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
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

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-stepup" />
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
              <Label htmlFor="monthly">Monthly limit (₹)</Label>
              <Input
                id="monthly"
                inputMode="numeric"
                value={monthlyValue}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pertxn">Per-transaction cap (₹)</Label>
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
            <div className="sm:col-span-2">
              <Button type="submit">Save rule</Button>
            </div>
          </form>
        </section>
      </div>

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
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
    </div>
  );
}
