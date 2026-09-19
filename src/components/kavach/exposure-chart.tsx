"use client";

import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { ArrowDownRight, Minus, TrendingDown } from "lucide-react";
import { formatINR, type AuthorityEvent } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

interface ExposurePoint {
  at: string;
  displayTime: string;
  label: string;
  detail: string;
  exposure: number;
  change: number;
  isLive?: boolean;
}

function compactINR(value: number) {
  if (value >= 1000)
    return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

function shortDate(value: string) {
  if (value === "now") return "Now";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return value;
  }
}

function ExposureTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ExposurePoint | undefined;
  if (!point) return null;
  const fell = point.change < 0;

  return (
    <div className="w-64 rounded-xl border border-border/80 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                point.isLive ? "bg-emerald-500 animate-pulse" : "bg-primary"
              )}
            />
            <p className="text-xs font-semibold text-foreground">
              {point.label}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {point.displayTime}
          </p>
        </div>
        <span className="amount text-sm font-semibold text-foreground">
          {formatINR(point.exposure)}
        </span>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {point.detail}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[10px]">
        <span className="text-muted-foreground">Impact on limit</span>
        <div className="flex items-center gap-1 font-medium">
          {fell ? (
            <ArrowDownRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={fell ? "text-emerald-500 font-semibold" : "text-muted-foreground"}>
            {point.change === 0
              ? "Baseline"
              : `${formatINR(Math.abs(point.change))} ${fell ? "withdrawn" : "added"}`}
          </span>
        </div>
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
  const [timeframe, setTimeframe] = useState<"7D" | "14D" | "30D" | "ALL">("ALL");

  const rawPoints: ExposurePoint[] = useMemo(() => {
    const list: ExposurePoint[] = history.map((event, index) => ({
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
    list.push({
      at: "now",
      displayTime: "Live state",
      label: "Current reachable exposure",
      detail:
        "Maximum autonomous spend available across every active mandate right now.",
      exposure: currentExposure,
      change: currentExposure - (last?.maxSpend ?? currentExposure),
      isLive: true,
    });

    return list;
  }, [history, currentExposure]);

  const points = useMemo(() => {
    if (timeframe === "7D") return rawPoints.slice(-3);
    if (timeframe === "14D") return rawPoints.slice(-4);
    if (timeframe === "30D") return rawPoints.slice(-5);
    return rawPoints;
  }, [rawPoints, timeframe]);

  const peak = useMemo(
    () => Math.max(...rawPoints.map((point) => point.exposure), 1),
    [rawPoints]
  );
  const withdrawn = Math.max(0, peak - currentExposure);
  const remainingPercent = Math.round((currentExposure / peak) * 100);

  if (history.length === 0) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-4 py-3">
        <div>
          <p className="text-sm text-muted-foreground">Current reachable exposure</p>
          <p className="amount mt-1 text-3xl font-semibold">{formatINR(currentExposure)}</p>
        </div>
        <div className="max-w-sm">
          <p className="text-sm font-semibold">No historical data available</p>
          <p className="mt-1 text-sm text-muted-foreground">The backend provides the current exposure, but not dated exposure snapshots yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="exposure-commandbar grid gap-4 border-b border-border/70 pb-4 lg:grid-cols-[auto_minmax(220px,1fr)_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span className="status-live-dot h-2 w-2 rounded-full bg-success" />
            Live reachable exposure
          </div>
          <p className="amount mt-1 text-3xl font-semibold tracking-[-0.045em] text-foreground">
            {formatINR(currentExposure)}
          </p>
        </div>

        <div className="min-w-0 lg:px-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <TrendingDown className="h-3.5 w-3.5" />
              {formatINR(withdrawn)} conserved
            </span>
            <span>{remainingPercent}% still reachable</span>
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-success/20"
            aria-label={`${remainingPercent}% of peak authority remains reachable`}
          >
            <span
              className="authority-fill h-full bg-destructive"
              style={{ width: `${remainingPercent}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
            <span>₹0</span>
            <span>Peak {formatINR(peak)}</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground lg:text-right">
            Period
          </p>
          <div className="flex w-fit items-center rounded-full border border-border bg-muted/30 p-0.5 text-[11px]">
            {(["7D", "14D", "30D", "ALL"] as const).map((tf) => (
              <button
                type="button"
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors",
                  timeframe === tf
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf}
              </button>
              ))}
          </div>
        </div>
      </div>

      <div
        className="exposure-chart relative h-[270px] w-full overflow-hidden rounded-[1.15rem_.4rem_1.15rem_.4rem] border border-border/70 bg-card p-2 pt-3 shadow-inner sm:h-[310px]"
        role="img"
        aria-label={`Reachable exposure fell from ${formatINR(peak)} to ${formatINR(currentExposure)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 18, right: 18, left: -6, bottom: 4 }}
          >
            <defs>
              <linearGradient id="exposure-fill-v2" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-destructive)"
                  stopOpacity={0.28}
                />
                <stop
                  offset="50%"
                  stopColor="var(--color-destructive)"
                  stopOpacity={0.08}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-destructive)"
                  stopOpacity={0.0}
                />
              </linearGradient>

              <linearGradient id="stroke-grad-v2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.9} />
                <stop offset="50%" stopColor="var(--color-destructive)" stopOpacity={1} />
                <stop offset="100%" stopColor="#e53e3e" stopOpacity={1} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 4"
              opacity={0.4}
            />

            <XAxis
              dataKey="at"
              tickFormatter={shortDate}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 14 }}
              tickMargin={10}
            />

            <YAxis
              domain={[0, Math.ceil(peak / 2500) * 2500]}
              tickFormatter={compactINR}
              axisLine={false}
              tickLine={false}
              width={46}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 14 }}
            />

            <ReferenceLine
              y={peak}
              stroke="var(--color-border)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `PEAK CAP ${compactINR(peak)}`,
                position: "insideTopRight",
                fill: "var(--color-muted-foreground)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            />

            <ReferenceArea
              y1={currentExposure}
              y2={peak}
              fill="var(--color-success)"
              fillOpacity={0.045}
              strokeOpacity={0}
            />

            <ReferenceLine
              y={currentExposure}
              stroke="var(--color-success)"
              strokeDasharray="2 5"
              strokeWidth={1}
              opacity={0.7}
              label={{
                value: `LIVE ${compactINR(currentExposure)}`,
                position: "insideBottomRight",
                fill: "var(--color-success)",
                fontSize: 14,
                fontWeight: 600,
              }}
            />

            <Tooltip
              content={<ExposureTooltip />}
              cursor={{
                stroke: "var(--color-destructive)",
                strokeWidth: 1.5,
                strokeDasharray: "4 4",
              }}
              animationDuration={150}
            />

            <Area
              type="monotoneX"
              dataKey="exposure"
              stroke="url(#stroke-grad-v2)"
              strokeWidth={2.5}
              fill="url(#exposure-fill-v2)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy) return <g key={`dot-${payload.at}`} />;
                const isLive = payload.isLive;
                return (
                  <g key={`dot-${payload.at}`}>
                    {isLive && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        className="fill-destructive/20 animate-ping"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isLive ? 5 : 3.5}
                      className={cn(
                        "transition-all",
                        isLive
                          ? "fill-destructive stroke-card stroke-2"
                          : "fill-card stroke-destructive stroke-2"
                      )}
                    />
                  </g>
                );
              }}
              activeDot={{
                r: 6,
                fill: "var(--color-destructive)",
                stroke: "var(--color-card)",
                strokeWidth: 3,
              }}
              isAnimationActive
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border/80 bg-muted/15 text-center text-xs">
        <div className="py-2 px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Peak Ceiling</p>
          <p className="amount mt-0.5 font-semibold text-foreground">{formatINR(peak)}</p>
        </div>
        <div className="py-2 px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Autonomous Limit</p>
          <p className="amount mt-0.5 font-semibold text-foreground">{formatINR(currentExposure)}</p>
        </div>
        <div className="py-2 px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Withdrawn / Conserved</p>
          <p className="amount mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
            {formatINR(withdrawn)}
          </p>
        </div>
      </div>
    </div>
  );
}
