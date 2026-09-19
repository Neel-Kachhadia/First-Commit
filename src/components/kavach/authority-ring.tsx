import { useState } from "react";
import { formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

type Segment = "remaining" | "spent" | null;

export function AuthorityRing({
  total,
  remaining,
  frozen,
}: {
  total: number;
  remaining: number;
  frozen?: boolean;
}) {
  const [active, setActive] = useState<Segment>(null);
  const safeTotal = Math.max(total, 1);
  const live = frozen ? 0 : Math.max(0, Math.min(remaining, total));
  const spent = Math.max(0, total - live);
  const remainingPct = Math.round((live / safeTotal) * 100);
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const remainingLength = (live / safeTotal) * circumference;
  const spentLength = (spent / safeTotal) * circumference;
  const shownPct = active === "spent" ? 100 - remainingPct : remainingPct;

  return (
    <div className="authority-ring-panel">
      <div
        className="authority-ring relative grid place-items-center"
        data-active={active ?? "none"}
        onMouseLeave={() => setActive(null)}
      >
        <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90">
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="authority-ring-track"
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
          <circle
            cx="88"
            cy="88"
            r={radius}
            className={cn(
              "authority-ring-segment authority-ring-spent",
              active === "spent" && "is-active",
              active === "remaining" && "is-muted",
            )}
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${spentLength} ${circumference - spentLength}`}
            strokeDashoffset={0}
            onMouseEnter={() => setActive("spent")}
          />
          <circle
            cx="88"
            cy="88"
            r={radius}
            className={cn(
              "authority-ring-segment authority-ring-remaining",
              active === "remaining" && "is-active",
              active === "spent" && "is-muted",
            )}
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${remainingLength} ${circumference - remainingLength}`}
            strokeDashoffset={-spentLength}
            onMouseEnter={() => setActive("remaining")}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="authority-ring-value amount text-[1.75rem] font-semibold leading-none">
            {shownPct}%
          </span>
          <span className="authority-ring-caption mt-2 font-mono text-[9px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            {active === "spent" ? "Consumed" : frozen ? "Suspended" : "Reachable"}
          </span>
        </div>
      </div>
      <div className="authority-ring-legend grid grid-cols-2 gap-2 text-[13px]">
        <button
          type="button"
          data-segment="remaining"
          onMouseEnter={() => setActive("remaining")}
          onFocus={() => setActive("remaining")}
          onBlur={() => setActive(null)}
          aria-pressed={active === "remaining"}
          className={cn(
            "text-left",
            active === "remaining" && "is-active",
          )}
        >
          <span className="block whitespace-nowrap text-muted-foreground">Still reachable</span>
          <span className="amount mt-0.5 block text-base font-semibold">{formatINR(live)}</span>
        </button>
        <button
          type="button"
          data-segment="spent"
          onMouseEnter={() => setActive("spent")}
          onFocus={() => setActive("spent")}
          onBlur={() => setActive(null)}
          aria-pressed={active === "spent"}
          className={cn(
            "text-left",
            active === "spent" && "is-active",
          )}
        >
          <span className="block whitespace-nowrap text-muted-foreground">Consumed</span>
          <span className="amount mt-0.5 block text-base font-semibold">{formatINR(spent)}</span>
        </button>
      </div>
      <p className="sr-only">
        {formatINR(live)} remains reachable, {formatINR(spent)} has been consumed.
      </p>
    </div>
  );
}
