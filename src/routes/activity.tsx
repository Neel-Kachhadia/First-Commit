import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusPill, ledgerTone } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";
import type { LedgerStatus } from "@/lib/kavach-data";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — KavachPay decision ledger" },
      {
        name: "description",
        content:
          "A complete ledger of every agent payment attempt, the amount, the merchant and the reason it was allowed or stopped.",
      },
      { property: "og:title", content: "Activity — KavachPay decision ledger" },
      {
        property: "og:description",
        content: "Every agent payment attempt with the reason it was allowed or stopped.",
      },
    ],
  }),
  component: ActivityPage,
});

const FILTERS: { key: LedgerStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "allowed", label: "Allowed" },
  { key: "pending", label: "Needs approval" },
  { key: "denied", label: "Denied" },
];

function ActivityPage() {
  const { ledger, getAgent } = useKavach();
  const [filter, setFilter] = useState<LedgerStatus | "all">("all");

  const rows = useMemo(
    () => (filter === "all" ? ledger : ledger.filter((e) => e.status === filter)),
    [ledger, filter],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity"
        description="Every payment an agent attempted, with the rule that decided the outcome."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="surface-card p-10 text-center text-sm text-muted-foreground">
          No payments match this filter.
        </p>
      ) : (
        <ul className="surface-card divide-y divide-border">
          {rows.map((entry) => {
            const tone = ledgerTone(entry.status);
            const agent = getAgent(entry.agentId);
            return (
              <li key={entry.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.merchant}</p>
                    <StatusPill tone={tone.tone} label={tone.label} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {agent?.name ?? "Agent"} · {entry.reason}
                  </p>
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
      )}
    </div>
  );
}
