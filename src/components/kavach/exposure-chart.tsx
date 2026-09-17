import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { ArrowDownRight, Minus, TrendingDown } from "lucide-react";
import { formatINR, type AuthorityEvent } from "@/lib/kavach-data";

interface ExposurePoint {
  at: string;
  displayTime: string;
  label: string;
  detail: string;
  exposure: number;
  change: number;
}

function compactINR(value: number) {
  if (value >= 1000)
    return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

function shortDate(value: string) {
  if (value === "now") return "Now";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function ExposureTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ExposurePoint | undefined;
  if (!point) return null;
  const fell = point.change < 0;

  return (
    <div className="w-64 rounded-lg border border-border bg-popover p-4 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-popover-foreground">
            {point.label}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {point.displayTime}
          </p>
        </div>
        <span className="amount text-sm font-medium text-popover-foreground">
          {formatINR(point.exposure)}
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {point.detail}
      </p>
      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-[10px]">
        {fell ? (
          <ArrowDownRight className="h-3 w-3 text-success" />
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={fell ? "text-success" : "text-muted-foreground"}>
          {point.change === 0
            ? "No change in reachable exposure"
            : `${formatINR(Math.abs(point.change))} ${fell ? "withdrawn" : "added"}`}
        </span>
      </div>
    </div>
  );
}

export function ExposureChart({
  history,
  currentExposure,
}: {
  history: AuthorityEvent[];
  currentExposure: number;
}) {
  const points: ExposurePoint[] = history.map((event, index) => ({
    at: event.at,
    displayTime: new Date(event.at).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    label: event.label,
    detail: event.detail,
    exposure: event.maxSpend,
    change:
      index === 0
        ? 0
        : event.maxSpend - (history[index - 1]?.maxSpend ?? event.maxSpend),
  }));

  const last = history.at(-1);
  points.push({
    at: "now",
    displayTime: "Live state",
    label: "Current reachable exposure",
    detail:
      "Maximum autonomous spend available across every active mandate right now.",
    exposure: currentExposure,
    change: currentExposure - (last?.maxSpend ?? currentExposure),
  });

  const peak = Math.max(...points.map((point) => point.exposure), 1);
  const withdrawn = Math.max(0, peak - currentExposure);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="label-caps">Live exposure</p>
          <p className="amount mt-1 text-2xl font-medium">
            {formatINR(currentExposure)}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/8 px-2.5 py-1.5 text-[10px] text-success">
          <TrendingDown className="h-3.5 w-3.5" />
          {formatINR(withdrawn)} below peak
        </div>
      </div>

      <div
        className="exposure-chart h-[300px] w-full sm:h-[340px]"
        role="img"
        aria-label={`Reachable exposure fell from ${formatINR(peak)} to ${formatINR(currentExposure)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 18, right: 14, left: -8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="exposure-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="65%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0.08}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="at"
              tickFormatter={shortDate}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
              tickMargin={12}
            />
            <YAxis
              domain={[0, Math.ceil(peak / 2500) * 2500]}
              tickFormatter={compactINR}
              axisLine={false}
              tickLine={false}
              width={48}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            />
            <Tooltip
              content={<ExposureTooltip />}
              cursor={{
                stroke: "var(--color-primary)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
              animationDuration={140}
            />
            <Area
              type="monotone"
              dataKey="exposure"
              stroke="var(--color-primary)"
              strokeWidth={2.25}
              fill="url(#exposure-fill)"
              dot={{
                r: 3.5,
                fill: "var(--color-card)",
                stroke: "var(--color-primary)",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: "var(--color-primary)",
                stroke: "var(--color-card)",
                strokeWidth: 3,
              }}
              isAnimationActive
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Reachable exposure over time</caption>
        <thead>
          <tr>
            <th>Event</th>
            <th>Exposure</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={`${point.at}-${point.label}`}>
              <td>{point.label}</td>
              <td>{formatINR(point.exposure)}</td>
              <td>{formatINR(point.change)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
