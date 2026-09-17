import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatusPill } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { CATEGORIES, formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Spending rules — KavachPay mandate builder" },
      {
        name: "description",
        content:
          "Issue a new agent mandate with a monthly limit, per-transaction cap, category and approved merchants, then test it before you trust it.",
      },
      { property: "og:title", content: "Spending rules — KavachPay mandate builder" },
      {
        property: "og:description",
        content: "Issue a scoped agent mandate and test a payment against it.",
      },
    ],
  }),
  component: RulesPage,
});

interface Errors {
  name?: string;
  purpose?: string;
  monthlyLimit?: string;
  perTransactionCap?: string;
  merchants?: string;
}

function RulesPage() {
  const { agents, createAgent, simulatePayment } = useKavach();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [perTransactionCap, setPerTransactionCap] = useState("");
  const [merchants, setMerchants] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const [simAgent, setSimAgent] = useState(agents[0]?.id ?? "");
  const [simMerchant, setSimMerchant] = useState("");
  const [simDescription, setSimDescription] = useState("");
  const [simAmount, setSimAmount] = useState("");
  const [simErrors, setSimErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    tone: "allowed" | "stepup" | "denied";
    label: string;
    reason: string;
    amount: number;
    agentName: string;
  } | null>(null);

  const submitMandate = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    const m = Number(monthlyLimit);
    const p = Number(perTransactionCap);
    const merchantList = merchants
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (name.trim().length < 3) next.name = "Give the agent a name of at least 3 characters.";
    if (purpose.trim().length < 10)
      next.purpose = "Describe what this agent is allowed to do (10 characters or more).";
    if (!monthlyLimit.trim() || !Number.isFinite(m) || m <= 0)
      next.monthlyLimit = "Enter a monthly limit greater than zero.";
    if (!perTransactionCap.trim() || !Number.isFinite(p) || p <= 0)
      next.perTransactionCap = "Enter a per-transaction cap greater than zero.";
    else if (Number.isFinite(m) && m > 0 && p > m)
      next.perTransactionCap = "The cap cannot exceed the monthly limit.";
    if (merchantList.length === 0)
      next.merchants = "List at least one approved merchant.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const id = createAgent({
      name: name.trim(),
      purpose: purpose.trim(),
      rule: {
        monthlyLimit: m,
        perTransactionCap: p,
        category,
        merchants: merchantList,
        window: "Calendar month",
      },
    });
    toast.success("Mandate issued", {
      description: `${name.trim()} holds ${formatINR(m)} of monthly authority.`,
    });
    navigate({ to: "/agents/$agentId", params: { agentId: id } });
  };

  const runSimulation = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amount = Number(simAmount);
    if (!simAgent) next.agent = "Choose an agent.";
    if (simMerchant.trim().length < 2) next.merchant = "Enter the merchant name.";
    if (!simAmount.trim() || !Number.isFinite(amount) || amount <= 0)
      next.amount = "Enter an amount greater than zero.";
    setSimErrors(next);
    if (Object.keys(next).length > 0) return;

    const outcome = simulatePayment({
      agentId: simAgent,
      merchant: simMerchant.trim(),
      description: simDescription.trim() || "Agent-initiated payment",
      amount,
    });
    setResult({
      tone:
        outcome.status === "allowed"
          ? "allowed"
          : outcome.status === "pending"
            ? "stepup"
            : "denied",
      label:
        outcome.status === "allowed"
          ? "Allowed"
          : outcome.status === "pending"
            ? "Needs approval"
            : "Denied",
      reason: outcome.reason,
      amount: outcome.amount,
      agentName: outcome.agentName,
    });
    setSimMerchant("");
    setSimDescription("");
    setSimAmount("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Spending rules"
        description="Issue a scoped mandate, then test a payment against it before an agent ever runs."
      />

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Issue a mandate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The agent can only spend inside these boundaries.
        </p>
        <form className="mt-5 grid gap-5 sm:grid-cols-2" onSubmit={submitMandate} noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pharmacy Agent"
            />
            {errors.name ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="agent-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="agent-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="agent-purpose">Purpose</Label>
            <Textarea
              id="agent-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Reorders prescription refills from approved pharmacies."
              rows={3}
            />
            {errors.purpose ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.purpose}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="agent-monthly">Monthly limit (₹)</Label>
            <Input
              id="agent-monthly"
              inputMode="numeric"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              placeholder="3000"
            />
            {errors.monthlyLimit ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.monthlyLimit}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="agent-cap">Per-transaction cap (₹)</Label>
            <Input
              id="agent-cap"
              inputMode="numeric"
              value={perTransactionCap}
              onChange={(e) => setPerTransactionCap(e.target.value)}
              placeholder="1000"
            />
            {errors.perTransactionCap ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.perTransactionCap}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="agent-merchants">Approved merchants</Label>
            <Input
              id="agent-merchants"
              value={merchants}
              onChange={(e) => setMerchants(e.target.value)}
              placeholder="Apollo, Tata 1mg, PharmEasy"
            />
            <p className="text-xs text-muted-foreground">Separate names with a comma.</p>
            {errors.merchants ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.merchants}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Button type="submit">Issue mandate</Button>
          </div>
        </form>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Test a payment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run a payment through the rules exactly as a live agent would. The result is
          recorded in activity.
        </p>
        <form className="mt-5 grid gap-5 sm:grid-cols-2" onSubmit={runSimulation} noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="sim-agent">Agent</Label>
            <Select value={simAgent} onValueChange={setSimAgent}>
              <SelectTrigger id="sim-agent">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {simErrors.agent ? (
              <p role="alert" className="text-sm text-destructive">
                {simErrors.agent}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sim-merchant">Merchant</Label>
            <Input
              id="sim-merchant"
              value={simMerchant}
              onChange={(e) => setSimMerchant(e.target.value)}
              placeholder="Blinkit"
            />
            {simErrors.merchant ? (
              <p role="alert" className="text-sm text-destructive">
                {simErrors.merchant}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sim-description">Description</Label>
            <Input
              id="sim-description"
              value={simDescription}
              onChange={(e) => setSimDescription(e.target.value)}
              placeholder="Weekly grocery basket"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sim-amount">Amount (₹)</Label>
            <Input
              id="sim-amount"
              inputMode="numeric"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              placeholder="1200"
            />
            {simErrors.amount ? (
              <p role="alert" className="text-sm text-destructive">
                {simErrors.amount}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Button type="submit">Run payment</Button>
          </div>
        </form>

        {result ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={result.tone} label={result.label} />
              <span className="amount text-sm font-medium">
                {formatINR(result.amount)}
              </span>
              <span className="text-sm text-muted-foreground">· {result.agentName}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{result.reason}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
