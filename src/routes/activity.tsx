"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Filter, Search, ShieldX } from "lucide-react";
import { DecisionGlyph } from "@/components/kavach/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DecisionDossier } from "@/components/kavach/decision-dossier";
import {
  PageHeader,
  StatusPill,
  ledgerTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import {
  formatDateTime,
  formatINR,
  type LedgerEntry,
  type LedgerStatus,
} from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

const FILTERS: { key: LedgerStatus | "all"; label: string }[] = [
  { key: "all", label: "All decisions" },
  { key: "allowed", label: "Allowed" },
  { key: "pending", label: "Needs approval" },
  { key: "denied", label: "Denied" },
];

export default function ActivityPage() {
  const { ledger, agents, getAgent } = useKavach();
  const [filter, setFilter] = useState<LedgerStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selected, setSelected] = useState<LedgerEntry | null>(null);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const min = minAmount === "" ? 0 : Number(minAmount);
    const max = maxAmount === "" ? Number.POSITIVE_INFINITY : Number(maxAmount);
    return ledger.filter((entry) => {
      const agent = getAgent(entry.agentId);
      return (
        (filter === "all" || entry.status === filter) &&
        (agentFilter === "all" || entry.agentId === agentFilter) &&
        entry.amount >= min &&
        entry.amount <= max &&
        (!normalized ||
          entry.id.toLowerCase().includes(normalized) ||
          entry.merchant.toLowerCase().includes(normalized) ||
          entry.description.toLowerCase().includes(normalized) ||
          agent?.name.toLowerCase().includes(normalized))
      );
    });
  }, [agentFilter, filter, getAgent, ledger, maxAmount, minAmount, query]);

  const groups = [
    {
      label: "Allowed",
      entries: ledger.filter((entry) => entry.status === "allowed"),
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Needs approval",
      entries: ledger.filter((entry) => entry.status === "pending"),
      icon: Clock3,
      tone: "text-stepup",
    },
    {
      label: "Denied",
      entries: ledger.filter((entry) => entry.status === "denied"),
      icon: ShieldX,
      tone: "text-destructive",
    },
  ];
  const advancedCount =
    Number(agentFilter !== "all") +
    Number(minAmount !== "") +
    Number(maxAmount !== "");

  return (
    <div className="decisions-page space-y-7">
      <PageHeader
        title="Decision Feed"
        description="Every payment intent, its live authority state, and the causal policy record behind the outcome."
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
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader className="text-left">
                  <SheetTitle>Advanced decision filters</SheetTitle>
                  <SheetDescription>
                    Narrow the operational record without losing your place.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="filter-agent">Agent</Label>
                    <select
                      id="filter-agent"
                      value={agentFilter}
                      onChange={(event) => setAgentFilter(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">Every agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="filter-min">Minimum amount</Label>
                      <Input
                        id="filter-min"
                        inputMode="numeric"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        placeholder="₹0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="filter-max">Maximum amount</Label>
                      <Input
                        id="filter-max"
                        inputMode="numeric"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        placeholder="No limit"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAgentFilter("all");
                      setMinAmount("");
                      setMaxAmount("");
                    }}
                  >
                    Clear advanced filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <DecisionGlyph className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No matching decisions</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Change the filter or search query.
              </p>
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
