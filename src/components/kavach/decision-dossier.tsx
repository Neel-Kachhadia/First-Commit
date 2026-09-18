import { Check, Copy, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusPill, ledgerTone } from "@/components/kavach/primitives";
import {
  formatDateTime,
  formatINR,
  type Agent,
  type LedgerEntry,
} from "@/lib/kavach-data";
import { useUserProfile } from "@/lib/user-profile";

function CopyId({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast.success("ID copied", { description: value.toUpperCase() });
      }}
      aria-label={`Copy ${value}`}
    >
      {value.toUpperCase()} <Copy className="h-3 w-3" />
    </button>
  );
}

function TraceStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[32px_1fr] gap-3 pb-5 last:pb-0">
      <div className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-border bg-raised font-mono text-[10px] text-muted-foreground">
        {number}
      </div>
      <div className="min-w-0 pt-1">
        <p className="label-caps">{title}</p>
        <div className="mt-2 text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

export function DecisionDossier({
  entry,
  agent,
  ledger,
  open,
  onOpenChange,
}: {
  entry: LedgerEntry | null;
  agent: Agent | undefined;
  ledger: LedgerEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useUserProfile();
  if (!entry) return null;

  const previousSpend = agent
    ? ledger
        .filter(
          (item) =>
            item.agentId === agent.id &&
            item.status === "APPROVED" &&
            new Date(item.at).getTime() < new Date(entry.at).getTime(),
        )
        .reduce((sum, item) => sum + item.amount, 0)
    : 0;
  const before = Math.max(0, (agent?.rule.monthlyLimit ?? 0) - previousSpend);
  const after =
    entry.status === "APPROVED" ? Math.max(0, before - entry.amount) : before;
  const tone = ledgerTone(entry.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border p-6 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <CopyId value={entry.id} />
            <StatusPill tone={tone.tone} label={tone.label} />
          </div>
          <SheetTitle className="mt-3 flex items-baseline justify-between gap-4 text-xl">
            <span>{entry.merchant}</span>
            <span className="amount text-2xl">{formatINR(entry.amount)}</span>
          </SheetTitle>
          <SheetDescription>{entry.description}</SheetDescription>
        </SheetHeader>

        <div className="border-b border-border bg-muted/30 px-6 py-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            EVALUATED {formatDateTime(entry.at).toUpperCase()} · CAUSAL RECORD
          </p>
        </div>

        <ol className="relative p-6 before:absolute before:bottom-8 before:left-[39px] before:top-8 before:w-px before:bg-border">
          <TraceStep number="01" title="Original intent">
            <p>“{entry.description}”</p>
          </TraceStep>
          <TraceStep number="02" title="Mandate">
            <div className="flex flex-wrap items-center gap-2">
              {agent ? <CopyId value={agent.mandateId} /> : null}
              <span className="text-muted-foreground">
                {agent?.rule.category ?? "Unknown scope"}
              </span>
            </div>
            {agent ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatINR(agent.rule.monthlyLimit)}{" "}
                {agent.rule.window.toLowerCase()} authority ·{" "}
                {formatINR(agent.rule.perTransactionCap)} automatic threshold
              </p>
            ) : null}
          </TraceStep>
          <TraceStep number="03" title="Authority provenance">
            <div className="flex flex-wrap items-center gap-2">
              {agent?.authorityId ? <CopyId value={agent.authorityId} /> : null}
              <span>{agent?.name ?? "Unknown agent"}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Derived from {profile.name} · delegation depth 1 of 2
            </p>
          </TraceStep>
          <TraceStep number="04" title="Budget at evaluation">
            <dl className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/25 p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Before</dt>
                <dd className="amount mt-1 font-medium">{formatINR(before)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Claim</dt>
                <dd className="amount mt-1 font-medium">
                  {formatINR(entry.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">After</dt>
                <dd className="amount mt-1 font-medium">{formatINR(after)}</dd>
              </div>
            </dl>
          </TraceStep>
          <TraceStep number="05" title="Policy evaluation">
            <p>{entry.reason}</p>
          </TraceStep>
          <TraceStep number="06" title="Execution">
            <p className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {entry.status === "APPROVED"
                ? "Provider request issued"
                : entry.status === "PENDING"
                  ? "Provider request held before execution"
                  : "Provider request blocked before execution"}
            </p>
          </TraceStep>
          <TraceStep number="07" title="Result">
            <p className="flex items-center gap-2">
              {entry.status === "APPROVED" ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-destructive" />
              )}
              {entry.status === "APPROVED"
                ? "Payment completed successfully"
                : entry.status === "PENDING"
                  ? "Awaiting a one-time human decision"
                  : "No money moved"}
            </p>
          </TraceStep>
        </ol>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background p-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => void navigator.clipboard.writeText(entry.id)}
          >
            <Copy className="h-4 w-4" /> Copy audit ID
          </Button>
          <Button className="flex-1" disabled>
            Full audit record <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
