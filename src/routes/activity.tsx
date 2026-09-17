import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Search, ShieldX } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  StatusPill,
  ledgerTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import {
  formatDateTime,
  formatINR,
  type LedgerStatus,
} from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Decision feed — KavachPay" },
      {
        name: "description",
        content:
          "An explainable ledger of every agent payment attempt and the policy decision behind it.",
      },
    ],
  }),
  component: ActivityPage,
});

const FILTERS: { key: LedgerStatus | "all"; label: string }[] = [
  { key: "all", label: "All decisions" },
  { key: "allowed", label: "Allowed" },
  { key: "pending", label: "Needs approval" },
  { key: "denied", label: "Denied" },
];

function ActivityPage() {
  const { ledger, getAgent } = useKavach();
  const [filter, setFilter] = useState<LedgerStatus | "all">("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ledger.filter((entry) => {
      const agent = getAgent(entry.agentId);
      const matchesFilter = filter === "all" || entry.status === filter;
      const matchesQuery =
        !normalized ||
        entry.merchant.toLowerCase().includes(normalized) ||
        entry.description.toLowerCase().includes(normalized) ||
        agent?.name.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, getAgent, ledger, query]);

  const allowed = ledger.filter((entry) => entry.status === "allowed");
  const denied = ledger.filter((entry) => entry.status === "denied");
  const pending = ledger.filter((entry) => entry.status === "pending");

  return (
    <div className="space-y-7">
      <PageHeader
        title="Decision feed"
        description="Every payment intent, the live authority state it met, and the exact policy reason behind its outcome."
      />

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {[
          {
            label: "Allowed",
            count: allowed.length,
            value: allowed.reduce((sum, entry) => sum + entry.amount, 0),
            icon: CheckCircle2,
            tone: "text-success",
          },
          {
            label: "Needs approval",
            count: pending.length,
            value: pending.reduce((sum, entry) => sum + entry.amount, 0),
            icon: Clock3,
            tone: "text-stepup",
          },
          {
            label: "Denied",
            count: denied.length,
            value: denied.reduce((sum, entry) => sum + entry.amount, 0),
            icon: ShieldX,
            tone: "text-destructive",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="label-caps">{item.label}</p>
                <Icon className={cn("h-4 w-4", item.tone)} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="amount text-2xl font-medium">{item.count}</p>
                <p className="amount text-xs text-muted-foreground">
                  {formatINR(item.value)}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-md border border-border bg-muted/35 p-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                  filter === item.key && "bg-card text-foreground shadow-sm",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search merchant or agent"
              aria-label="Search decisions"
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <Activity className="mx-auto h-6 w-6 text-muted-foreground" />
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
                      className="border-b border-border last:border-b-0 hover:bg-muted/25"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">{entry.merchant}</p>
                        <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
                          {entry.description}
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
    </div>
  );
}
