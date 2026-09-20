"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

interface ExposurePoint {
  at: string;
  timestamp: number;
  displayTime: string;
  label: string;
  detail: string;
  exposure: number;
  change: number;
  isLive?: boolean;
}

interface RecordedSnapshot {
  at: string;
  exposure: number;
}

const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;
const SNAPSHOT_HEARTBEAT_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function recordSnapshot(userId: string, exposure: number): RecordedSnapshot[] {
  const key = `kavachpay-exposure-snapshots:${userId}`;
  const now = Date.now();
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    const snapshots: RecordedSnapshot[] = Array.isArray(stored)
      ? stored.filter((point): point is RecordedSnapshot =>
          typeof point?.at === "string" &&
          Number.isFinite(Date.parse(point.at)) &&
          typeof point.exposure === "number" &&
          Number.isFinite(point.exposure) &&
          Date.parse(point.at) >= now - SNAPSHOT_RETENTION_MS,
        )
      : [];
    const last = snapshots.at(-1);
    if (!last || last.exposure !== exposure || now - Date.parse(last.at) >= SNAPSHOT_HEARTBEAT_MS) {
      snapshots.push({ at: new Date(now).toISOString(), exposure });
    }
    const recent = snapshots.slice(-500);
    window.localStorage.setItem(key, JSON.stringify(recent));
    return recent;
  } catch {
    return [{ at: new Date(now).toISOString(), exposure }];
  }
}

function getNiceYMax(peak: number): number {
  if (!Number.isFinite(peak) || peak <= 0) return 1000;
  // Provide ~18% headroom so peak lines, labels, and top dots never clip or collide with the top border
  const target = peak * 1.18;
  const exponent = Math.floor(Math.log10(target));
  const power = Math.pow(10, exponent);
  const fraction = target / power;
  let niceFraction: number;
  if (fraction <= 1.2) niceFraction = 1.2;
  else if (fraction <= 1.5) niceFraction = 1.5;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 3) niceFraction = 3;
  else if (fraction <= 4) niceFraction = 4;
  else if (fraction <= 5) niceFraction = 5;
  else if (fraction <= 6) niceFraction = 6;
  else if (fraction <= 8) niceFraction = 8;
  else niceFraction = 10;
  return niceFraction * power;
}

function compactINR(value: number) {
  if (!Number.isFinite(value) || value === 0) return "₹0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10_000_000) {
    const cr = abs / 10_000_000;
    return `${sign}₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (abs >= 100_000) {
    const l = abs / 100_000;
    return `${sign}₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

function axisTime(value: number, span: number) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    if (span < 2 * 60 * 1000) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });
    if (span < 2 * 24 * 60 * 60 * 1000) return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
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
        <span className="text-muted-foreground">Since previous reading</span>
        <div className="flex items-center gap-1 font-medium">
          {fell ? (
            <ArrowDownRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={fell ? "text-emerald-500 font-semibold" : "text-muted-foreground"}>
            {point.change === 0
              ? "No change"
              : `${formatINR(Math.abs(point.change))} ${fell ? "lower" : "higher"}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ExposureChart({
  history,
  currentExposure,
  ready,
}: {
  history: AuthorityEvent[];
  currentExposure: number;
  ready: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.sub ?? "";
  const [recording, setRecording] = useState<{ userId: string; snapshots: RecordedSnapshot[] }>({ userId: "", snapshots: [] });
  const [clock, setClock] = useState(0);
  const [timeframe, setTimeframe] = useState<"7D" | "14D" | "30D" | "ALL">("ALL");

  useEffect(() => {
    if (!userId || !ready) return;
    const capture = () => {
      setRecording({ userId, snapshots: recordSnapshot(userId, currentExposure) });
      setClock(Date.now());
    };
    const frame = window.requestAnimationFrame(capture);
    const interval = window.setInterval(capture, SNAPSHOT_INTERVAL_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [userId, ready, currentExposure]);

  const rawPoints: ExposurePoint[] = useMemo(() => {
    const historical = history.map((event) => ({
      at: event.at,
      timestamp: Date.parse(event.at),
      displayTime: new Date(event.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      label: event.label,
      detail: event.detail,
      exposure: event.maxSpend,
    }));
    const captured = (recording.userId === userId ? recording.snapshots : []).map((point) => ({
      at: point.at,
      timestamp: Date.parse(point.at),
      displayTime: new Date(point.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      label: "Recorded exposure",
      detail: "Reachable authority recorded in this browser.",
      exposure: point.exposure,
    }));
    const list: Omit<ExposurePoint, "change">[] = [...historical, ...captured]
      .filter((point) => Number.isFinite(point.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (ready && clock) {
      const live: Omit<ExposurePoint, "change"> = {
        at: new Date(clock).toISOString(),
        timestamp: clock,
        displayTime: "Live now",
        label: "Current reachable exposure",
        detail: "Maximum autonomous spend available across active mandates right now.",
        exposure: currentExposure,
        isLive: true,
      };
      const last = list.at(-1);
      if (last && last.exposure === currentExposure && clock - last.timestamp < 60_000) {
        list[list.length - 1] = live;
      } else {
        list.push(live);
      }
    }
    return list.map((point, index) => ({
      ...point,
      change: index === 0 ? 0 : point.exposure - (list[index - 1]?.exposure ?? point.exposure),
    }));
  }, [history, recording, userId, currentExposure, ready, clock]);

  const points = useMemo(() => {
    const days = timeframe === "7D" ? 7 : timeframe === "14D" ? 14 : timeframe === "30D" ? 30 : null;
    if (days !== null) {
      const since = clock - days * 24 * 60 * 60 * 1000;
      return rawPoints.filter((point) => point.timestamp >= since);
    }
    return rawPoints;
  }, [rawPoints, timeframe, clock]);

  const peak = useMemo(
    () => Math.max(...points.map((point) => point.exposure), currentExposure, 1),
    [points, currentExposure]
  );
  const chartMax = useMemo(() => getNiceYMax(peak), [peak]);
  const isAtPeak = peak <= currentExposure || (peak - currentExposure) < (peak * 0.03);
  const withdrawn = Math.max(0, peak - currentExposure);
  const remainingPercent = Math.round((currentExposure / peak) * 100);
  const firstVisible = points[0]?.timestamp ?? clock;
  const lastVisible = points.at(-1)?.timestamp ?? clock;
  const observedSpan = Math.max(0, lastVisible - firstVisible);
  const axisPadding = Math.max(1_000, observedSpan * 0.15);

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
              {formatINR(withdrawn)} below observed peak
            </span>
            <span>{remainingPercent}% still reachable</span>
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-success/20"
            aria-label={`${remainingPercent}% of the highest recorded exposure is currently reachable`}
          >
            <span
              className="authority-fill h-full bg-destructive"
              style={{ width: `${remainingPercent}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
            <span>₹0</span>
            <span>Observed peak {formatINR(peak)}</span>
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
        aria-label={`Recorded reachable exposure over time. Current value ${formatINR(currentExposure)}. ${Math.max(0, points.length - 1)} earlier readings in this period.`}
      >
        {points.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
            Waiting for the first exposure reading.
          </div>
        ) : points.length === 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 24, right: 20, left: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" opacity={0.4} />
              <XAxis dataKey="timestamp" tickFormatter={(value: number) => axisTime(value, 0)} axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} tickMargin={8} />
              <YAxis domain={[0, chartMax]} tickFormatter={compactINR} axisLine={false} tickLine={false} width={54} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <Tooltip content={<ExposureTooltip />} cursor={{ fill: "var(--color-destructive)", fillOpacity: 0.05 }} />
              <Bar dataKey="exposure" fill="var(--color-destructive)" maxBarSize={68} radius={[5, 5, 0, 0]} isAnimationActive animationDuration={750} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 22, right: 20, left: 8, bottom: 4 }}
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
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={[firstVisible - axisPadding, lastVisible + axisPadding]}
              allowDataOverflow
              tickFormatter={(value: number) => axisTime(value, observedSpan)}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              tickMargin={8}
            />

            <YAxis
              domain={[0, chartMax]}
              tickFormatter={compactINR}
              axisLine={false}
              tickLine={false}
              width={54}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
            />

            {/* Peak Reference Line: positioned on the LEFT (insideTopLeft) so it never clashes with right-hand live dots or live label */}
            <ReferenceLine
              y={peak}
              stroke={isAtPeak ? "var(--color-success)" : "var(--color-border)"}
              strokeDasharray={isAtPeak ? "3 4" : "4 4"}
              strokeWidth={1.5}
              // label={{
              //   value: isAtPeak
              //     ? `LIVE PEAK ${compactINR(peak)}`
              //     : `OBSERVED PEAK ${compactINR(peak)}`,
              //   position: "insideTopLeft",
              //   fill: isAtPeak ? "var(--color-success)" : "var(--color-muted-foreground)",
              //   fontSize: 11,
              //   fontWeight: 600,
              //   letterSpacing: "0.04em",
              //   offset: 8,
              // }}
            />

            {/* Buffer zone between current exposure and peak */}
            {!isAtPeak && (
              <ReferenceArea
                y1={currentExposure}
                y2={peak}
                fill="var(--color-success)"
                fillOpacity={0.045}
                strokeOpacity={0}
              />
            )}

            {/* Live Reference Line: positioned on the RIGHT (insideBottomRight), rendered only when distinct from peak */}
            {!isAtPeak && (
              <ReferenceLine
                y={currentExposure}
                stroke="var(--color-success)"
                strokeDasharray="2 5"
                strokeWidth={1}
                opacity={0.85}
                // label={{
                //   value: `LIVE ${compactINR(currentExposure)}`,
                //   position: "insideBottomRight",
                //   fill: "var(--color-success)",
                //   fontSize: 1,
                //   fontWeight: 600,
                //   letterSpacing: "0.04em",
                //   offset: 8,
                // }}
              />
            )}

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
                if (cx == null || cy == null) return <g key={`dot-${payload.at}`} />;
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
              isAnimationActive={points.length > 1}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border/80 bg-muted/15 text-center text-xs">
        <div className="py-2 px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Observed peak</p>
          <p className="amount mt-0.5 font-semibold text-foreground">{formatINR(peak)}</p>
        </div>
        <div className="py-2 px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Reachable now</p>
          <p className="amount mt-0.5 font-semibold text-foreground">{formatINR(currentExposure)}</p>
        </div>
        <div className="py-2 px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Below observed peak</p>
          <p className="amount mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
            {formatINR(withdrawn)}
          </p>
        </div>
      </div>
      {history.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {points.length === 0
            ? "A time series needs dated exposure readings. None have been recorded for this account in this browser yet."
            : points.length === 1
            ? "One reading so far. This red column is the measured value; the trend will appear after another reading is recorded."
            : "The time axis is fitted to available readings. Earlier values are not available from the backend; this browser records new changes."}
        </p>
      )}
    </div>
  );
}
