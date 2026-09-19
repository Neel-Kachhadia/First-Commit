"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Filter, Loader2, Plus, Search, ShieldX } from "lucide-react";
import { DecisionGlyph } from "@/components/kavach/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecisionDossier } from "@/components/kavach/decision-dossier";
import {
  PageHeader,
  StatusPill,
  ledgerTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import {
  MANDATE_CATEGORIES,
  formatDateTime,
  formatINR,
  type LedgerEntry,
  type LedgerStatus,
} from "@/lib/kavach-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FILTERS: { key: LedgerStatus | "all"; label: string }[] = [
  { key: "all", label: "All decisions" },
  { key: "APPROVED", label: "APPROVED" },
  { key: "PENDING", label: "Needs approval" },
  { key: "DENIED", label: "DENIED" },
];

export default function ActivityPage() {
  const searchParams = useSearchParams();
  return <ActivityPageContent key={searchParams.toString()} initialQuery={searchParams.get("search") ?? ""} />;
}

function ActivityPageContent({ initialQuery }: { initialQuery: string }) {
  const { ledger, agents, getAgent, createIntent } = useKavach();
  const [filter, setFilter] = useState<LedgerStatus | "all">("all");
  const [query, setQuery] = useState(initialQuery);
  const [agentFilter, setAgentFilter] = useState("all");
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selected, setSelected] = useState<LedgerEntry | null>(null);

  // ── Create Intent dialog state ─────────────────────────────────────────
  const [intentOpen, setIntentOpen] = useState(false);
  const [intentAgent, setIntentAgent] = useState("");
  const [intentMerchant, setIntentMerchant] = useState("");
  const [intentCategory, setIntentCategory] = useState("");
  const [intentAmount, setIntentAmount] = useState("");
  const [intentDesc, setIntentDesc] = useState("");
  const [intentSubmitting, setIntentSubmitting] = useState(false);

  const activeAgents = agents.filter((a) => a.status === "active");
  const selectedAgent = agents.find((a) => a.id === intentAgent);

  const resetIntentForm = () => {
    setIntentAgent("");
    setIntentMerchant("");
    setIntentCategory("");
    setIntentAmount("");
    setIntentDesc("");
  };

  const handleAgentChange = (agentId: string) => {
    setIntentAgent(agentId);
    const ag = agents.find((a) => a.id === agentId);
    if (ag) {
      const match = MANDATE_CATEGORIES.find(
        (c) =>
          c.toLowerCase().replace(/[^a-z0-9]/g, "") ===
          (ag.rule.category || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      );
      setIntentCategory(match || ag.rule.category || "");
    }
  };

  const handleCreateIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intentAgent) { toast.error("Select an agent / mandate."); return; }
    if (!intentMerchant.trim()) { toast.error("Enter a merchant name."); return; }
    const amount = Number(intentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid amount."); return; }

    const category = intentCategory || selectedAgent?.rule?.category || "General";

    setIntentSubmitting(true);
    try {
      const res = await createIntent({
        grantId: intentAgent,
        amount,
        merchant: {
          name: intentMerchant.trim(),
          category,
        },
        description: intentDesc.trim() || `${intentMerchant.trim()} payment`,
        idempotencyKey: crypto.randomUUID(),
      });

      const decisionObj = typeof res?.decision === "object" ? res.decision : undefined;
      const decisionStr: string =
        typeof res?.decision === "string"
          ? res.decision
          : decisionObj?.decision ?? "DENY";
      const reason: string | undefined = decisionObj?.reason;

      if (decisionStr === "ALLOW") {
        toast.success("Approved — authorized by policy");
      } else if (decisionStr === "STEP_UP") {
        toast.info(reason || "Step-up required — awaiting user approval");
      } else {
        toast.error(reason ? `Denied: ${reason}` : "Denied — blocked by policy");
      }

      setIntentOpen(false);
      resetIntentForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create intent");
    } finally {
      setIntentSubmitting(false);
    }
  };

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const normalizedReason = reasonFilter.trim().toLowerCase();
    const min = minAmount === "" ? 0 : Number(minAmount);
    const max = maxAmount === "" ? Number.POSITIVE_INFINITY : Number(maxAmount);
    const latestTimestamp = Math.max(
      ...ledger.map((entry) => new Date(entry.at).getTime()),
    );
    const windowDays = timeFilter === "24h" ? 1 : Number(timeFilter);
    const cutoff =
      timeFilter === "all"
        ? Number.NEGATIVE_INFINITY
        : latestTimestamp - windowDays * 24 * 60 * 60 * 1000;
    return ledger.filter((entry) => {
      const agent = getAgent(entry.agentId);
      const statusMatches =
        filter === "all" ||
        entry.status === filter ||
        (filter === "PENDING" && entry.status === "STEP_UP_REQUIRED") ||
        (filter === "STEP_UP_REQUIRED" && entry.status === "PENDING");

      return (
        statusMatches &&
        (agentFilter === "all" || entry.agentId === agentFilter) &&
        (merchantFilter === "all" || entry.merchant === merchantFilter) &&
        new Date(entry.at).getTime() >= cutoff &&
        entry.amount >= min &&
        entry.amount <= max &&
        (!normalizedReason || entry.reason.toLowerCase().includes(normalizedReason)) &&
        (!normalized ||
          entry.id.toLowerCase().includes(normalized) ||
          entry.merchant.toLowerCase().includes(normalized) ||
          entry.description.toLowerCase().includes(normalized) ||
          agent?.name.toLowerCase().includes(normalized))
      );
    });
  }, [agentFilter, filter, getAgent, ledger, maxAmount, merchantFilter, minAmount, query, reasonFilter, timeFilter]);

  const merchants = useMemo(
    () => [...new Set(ledger.map((entry) => entry.merchant))].sort(),
    [ledger],
  );

  const groups = [
    {
      label: "APPROVED",
      entries: ledger.filter((entry) => entry.status === "APPROVED"),
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Needs approval",
      entries: ledger.filter(
        (entry) =>
          entry.status === "PENDING" || entry.status === "STEP_UP_REQUIRED",
      ),
      icon: Clock3,
      tone: "text-stepup",
    },
    {
      label: "DENIED",
      entries: ledger.filter((entry) => entry.status === "DENIED"),
      icon: ShieldX,
      tone: "text-destructive",
    },
  ];
  const advancedCount =
    Number(agentFilter !== "all") +
    Number(merchantFilter !== "all") +
    Number(timeFilter !== "all") +
    Number(reasonFilter !== "") +
    Number(minAmount !== "") +
    Number(maxAmount !== "");

  const clearAdvancedFilters = () => {
    setAgentFilter("all");
    setMerchantFilter("all");
    setTimeFilter("all");
    setReasonFilter("");
    setMinAmount("");
    setMaxAmount("");
  };

  return (
    <div className="decisions-page space-y-7">
      <PageHeader
        title="Decision Feed"
        description="Every payment intent, its live authority state, and the causal policy record behind the outcome."
        actions={
          <Dialog open={intentOpen} onOpenChange={(open) => { setIntentOpen(open); if (!open) resetIntentForm(); }}>
            <DialogTrigger asChild>
              <Button id="create-intent-btn">
                <Plus className="h-4 w-4" />
                Create Intent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create payment intent</DialogTitle>
                <DialogDescription>
                  The authority engine will decide: Approved, Step-up required, or Denied.
                  No payment is invoked for denied or step-up intents.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateIntent} noValidate className="mt-2 grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="ci-agent">Agent / Mandate</Label>
                  <Select value={intentAgent} onValueChange={handleAgentChange}>
                    <SelectTrigger id="ci-agent" className="h-11">
                      <SelectValue placeholder="Select an active mandate…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAgents.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No active mandates
                        </SelectItem>
                      ) : (
                        activeAgents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ci-merchant">Merchant</Label>
                  <Input
                    id="ci-merchant"
                    value={intentMerchant}
                    onChange={(e) => setIntentMerchant(e.target.value)}
                    placeholder="e.g. PharmEasy"
                    autoComplete="off"
                  />
                  {selectedAgent && selectedAgent.rule.merchants.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-muted-foreground mr-0.5">Approved:</span>
                      {selectedAgent.rule.merchants.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setIntentMerchant(m)}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                            intentMerchant.trim().toLowerCase() === m.toLowerCase()
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ci-category">Category</Label>
                  <Select value={intentCategory} onValueChange={setIntentCategory}>
                    <SelectTrigger id="ci-category" className="h-11">
                      <SelectValue placeholder="Select a category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MANDATE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ci-amount">Amount (₹)</Label>
                  <Input
                    id="ci-amount"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={intentAmount}
                    onChange={(e) => setIntentAmount(e.target.value)}
                    placeholder="e.g. 500"
                  />
                  {selectedAgent && (
                    <p className="text-[11px] text-muted-foreground">
                      Cap: {formatINR(selectedAgent.rule.perTransactionCap)} &bull; Monthly limit: {formatINR(selectedAgent.rule.monthlyLimit)}
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ci-desc">Purpose / Description</Label>
                  <Input
                    id="ci-desc"
                    value={intentDesc}
                    onChange={(e) => setIntentDesc(e.target.value)}
                    placeholder="e.g. Weekly groceries"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={intentSubmitting}
                  className="mt-1 w-full"
                >
                  {intentSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating…</>
                  ) : (
                    "Create Intent"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="decision-ribbon metric-cluster grid overflow-hidden border-y border-border sm:grid-cols-3">
        {groups.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="label-caps">{item.label}</p>
                <Icon className={cn("h-4 w-4", item.tone)} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="amount text-2xl font-medium">
                  {item.entries.length}
                </p>
                <p className="amount text-xs text-muted-foreground">
                  {formatINR(
                    item.entries.reduce((sum, entry) => sum + entry.amount, 0),
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="decision-console surface-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit max-w-full overflow-x-auto rounded-md border border-border bg-muted/35 p-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={cn(
                  "shrink-0 rounded px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                  filter === item.key && "bg-card text-foreground shadow-sm",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ID, merchant or agent"
                aria-label="Search decisions"
                className="h-9 pl-9 text-xs"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" /> Filters{" "}
                  {advancedCount > 0 ? (
                    <span className="rounded-full bg-stepup/15 px-1.5 text-[10px] text-stepup">
                      {advancedCount}
                    </span>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[88svh] overflow-y-auto rounded-t-[1.25rem] border-t p-0 [&>button]:right-5 [&>button]:top-5 [&>button]:grid [&>button]:h-9 [&>button]:w-9 [&>button]:place-items-center [&>button]:rounded-full [&>button]:border [&>button]:border-border [&>button]:bg-card [&>button]:opacity-100 [&>button]:shadow-sm [&>button>svg]:h-4 [&>button>svg]:w-4"
              >
                <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-7 sm:py-6">
                  <SheetHeader className="border-b border-border pb-4 pr-10 text-left">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <SheetTitle className="text-xl">Filter decisions</SheetTitle>
                        <SheetDescription className="mt-1 max-w-xl">
                          Combine agent, merchant, policy, time and amount filters.
                        </SheetDescription>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {rows.length} {rows.length === 1 ? "result" : "results"}
                      </p>
                    </div>
                  </SheetHeader>

                  <div className="grid gap-5 py-5 lg:grid-cols-3">
                    <fieldset className="grid content-start gap-4 rounded-lg border border-border bg-card/55 p-4">
                      <legend className="px-2 text-sm font-semibold">Source</legend>
                      <div className="grid gap-2">
                        <Label htmlFor="filter-agent">Agent</Label>
                        <Select value={agentFilter} onValueChange={setAgentFilter}>
                          <SelectTrigger id="filter-agent" className="h-11 bg-background">
                            <SelectValue placeholder="Every agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Every agent</SelectItem>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="filter-merchant">Merchant</Label>
                        <Select value={merchantFilter} onValueChange={setMerchantFilter}>
                          <SelectTrigger id="filter-merchant" className="h-11 bg-background">
                            <SelectValue placeholder="Every merchant" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Every merchant</SelectItem>
                            {merchants.map((merchant) => (
                              <SelectItem key={merchant} value={merchant}>
                                {merchant}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </fieldset>

                    <fieldset className="grid content-start gap-4 rounded-lg border border-border bg-card/55 p-4">
                      <legend className="px-2 text-sm font-semibold">Decision context</legend>
                      <div className="grid gap-2">
                        <Label htmlFor="filter-period">Evaluated within</Label>
                        <Select value={timeFilter} onValueChange={setTimeFilter}>
                          <SelectTrigger id="filter-period" className="h-11 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All recorded time</SelectItem>
                            <SelectItem value="24h">Last 24 hours</SelectItem>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="filter-reason">Policy reason contains</Label>
                        <Input
                          id="filter-reason"
                          value={reasonFilter}
                          onChange={(event) => setReasonFilter(event.target.value)}
                          placeholder="e.g. merchant, cap, revoked"
                          className="h-11 bg-background"
                        />
                      </div>
                    </fieldset>

                    <fieldset className="grid content-start gap-4 rounded-lg border border-border bg-card/55 p-4">
                      <legend className="px-2 text-sm font-semibold">Amount</legend>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="filter-min">Minimum</Label>
                          <Input
                            id="filter-min"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={minAmount}
                            onChange={(event) => setMinAmount(event.target.value)}
                            placeholder="₹0"
                            className="h-11 bg-background"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="filter-max">Maximum</Label>
                          <Input
                            id="filter-max"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={maxAmount}
                            onChange={(event) => setMaxAmount(event.target.value)}
                            placeholder="No limit"
                            className="h-11 bg-background"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2" aria-label="Amount presets">
                        {[
                          { label: "Under ₹1k", min: "", max: "1000" },
                          { label: "₹1k–₹5k", min: "1000", max: "5000" },
                          { label: "Above ₹5k", min: "5000", max: "" },
                        ].map((preset) => (
                          <button
                            type="button"
                            key={preset.label}
                            onClick={() => {
                              setMinAmount(preset.min);
                              setMaxAmount(preset.max);
                            }}
                            className={cn(
                              "rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground",
                              minAmount === preset.min &&
                                maxAmount === preset.max &&
                                "border-primary/30 bg-primary/8 text-foreground",
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      variant="ghost"
                      onClick={clearAdvancedFilters}
                      disabled={advancedCount === 0}
                    >
                      Clear filters
                    </Button>
                    <SheetClose asChild>
                      <Button>View {rows.length} decisions</Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <DecisionGlyph className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {ledger.length === 0 ? "No decisions yet" : "No matching decisions"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ledger.length === 0
                  ? "Create a payment intent to test an agent\u2019s authority."
                  : "Change the filter or search query."}
              </p>
              {ledger.length === 0 && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setIntentOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Intent
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="decision-table w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Intent</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Policy reason</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Decision</th>
                  <th className="px-5 py-3 text-right font-medium">
                    Evaluated
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const tone = ledgerTone(entry.status);
                  const agent = getAgent(entry.agentId);
                  return (
                    <tr
                      key={entry.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open causal record for ${entry.id}`}
                      onClick={() => setSelected(entry)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(entry);
                        }
                      }}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/35 focus-visible:bg-muted/35"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">{entry.merchant}</p>
                        <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
                          {entry.description}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {entry.id.toUpperCase()}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {agent?.name ?? "Agent"}
                      </td>
                      <td className="max-w-72 px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                        {entry.reason}
                      </td>
                      <td className="amount px-4 py-4 text-right font-medium">
                        {formatINR(entry.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill tone={tone.tone} label={tone.label} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs text-muted-foreground">
                        {formatDateTime(entry.at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DecisionDossier
        entry={selected}
        agent={selected ? getAgent(selected.agentId) : undefined}
        ledger={ledger}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
