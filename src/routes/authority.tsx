import { createFileRoute } from "@tanstack/react-router";
import { Metric, PageHeader } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/authority")({
  head: () => ({
    meta: [
      { title: "Authority graph — KavachPay exposure over time" },
      {
        name: "description",
        content:
          "Track how much your AI agents could possibly spend at any moment, and every event that raised or lowered that exposure.",
      },
      { property: "og:title", content: "Authority graph — KavachPay exposure over time" },
      {
        property: "og:description",
        content: "How much your agents could possibly spend, and every event that moved it.",
      },
    ],
  }),
  component: AuthorityPage,
});

function AuthorityPage() {
  const { history, maxPossibleSpend, totalAuthority, agents, frozen, remainingFor } =
    useKavach();

  const points = [...history].map((e) => e.maxSpend);
  const peak = Math.max(...points, maxPossibleSpend, 1);
  const series = [...history, { maxSpend: maxPossibleSpend }];
  const width = 100;
  const height = 100;
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const coords = series.map((p, i) => {
    const x = i * step;
    const y = height - (p.maxSpend / peak) * (height - 6) - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = coords.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Authority graph"
        description="Maximum possible spend is the worst case: what every live agent could still spend right now."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Maximum possible spend"
          value={formatINR(maxPossibleSpend)}
          hint={frozen ? "Suspended by emergency stop" : "Current worst-case exposure"}
          tone={frozen ? "stepup" : "primary"}
        />
        <Metric
          label="Authority granted"
          value={formatINR(totalAuthority)}
          hint="Total monthly limits across live mandates"
        />
        <Metric
          label="Peak exposure"
          value={formatINR(peak)}
          hint="Highest point recorded this month"
        />
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Exposure over time</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each step down is authority you took back or an agent consumed.
        </p>
        <div className="mt-5">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-48 w-full sm:h-64"
            role="img"
            aria-label={`Maximum possible spend moved from ${formatINR(series[0]?.maxSpend ?? 0)} to ${formatINR(maxPossibleSpend)}`}
          >
            <polygon points={area} fill="var(--color-primary)" opacity="0.12" />
            <polyline
              points={line}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span className="amount">{formatINR(series[0]?.maxSpend ?? 0)}</span>
            <span className="amount">{formatINR(maxPossibleSpend)}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Remaining authority by agent</h2>
        <ul className="surface-card divide-y divide-border">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex flex-wrap items-center justify-between gap-2 p-4"
            >
              <span className="min-w-0 truncate font-medium">{agent.name}</span>
              <span className="amount text-sm">{formatINR(remainingFor(agent))}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Authority timeline</h2>
        <ol className="surface-card divide-y divide-border">
          {[...history].reverse().map((event) => (
            <li key={event.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="font-medium">{event.label}</p>
                <p className="text-sm text-muted-foreground">{event.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(event.at)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="label-caps">Max possible spend</p>
                <p className="amount text-sm font-medium">{formatINR(event.maxSpend)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
