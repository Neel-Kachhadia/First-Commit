import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "active" | "allowed" | "stepup" | "denied" | "neutral";

const toneStyles: Record<Tone, string> = {
  active: "border-primary/35 text-primary bg-primary/10",
  allowed: "border-success/35 text-success bg-success/10",
  stepup: "border-stepup/40 text-stepup bg-stepup/10",
  denied: "border-destructive/40 text-destructive bg-destructive/10",
  neutral: "border-border text-muted-foreground bg-muted",
};

const dotStyles: Record<Tone, string> = {
  active: "bg-primary",
  allowed: "bg-success",
  stepup: "bg-stepup",
  denied: "bg-destructive",
  neutral: "bg-muted-foreground",
};

export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneStyles[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotStyles[tone])} />
      {label}
    </span>
  );
}

export function agentTone(status: string): { tone: Tone; label: string } {
  switch (status) {
    case "active":
      return { tone: "active", label: "Active" };
    case "exhausted":
      return { tone: "stepup", label: "Limit reached" };
    case "frozen":
      return { tone: "denied", label: "Stopped" };
    default:
      return { tone: "denied", label: "Revoked" };
  }
}

export function ledgerTone(status: string): { tone: Tone; label: string } {
  switch (status) {
    case "allowed":
      return { tone: "allowed", label: "Allowed" };
    case "pending":
      return { tone: "stepup", label: "Needs approval" };
    default:
      return { tone: "denied", label: "Denied" };
  }
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid gap-4 border-b border-border pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function AuthorityBar({
  consumed,
  limit,
  muted = false,
}: {
  consumed: number;
  limit: number;
  muted?: boolean;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((consumed / limit) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${pct}% of authority consumed`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          muted ? "bg-muted-foreground/50" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "stepup";
}) {
  const valueTone = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    stepup: "text-stepup",
  }[tone];
  return (
    <div className="surface-card p-5">
      <p className="label-caps">{label}</p>
      <p className={cn("amount mt-2 text-2xl font-medium", valueTone)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
