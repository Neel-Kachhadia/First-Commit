import { Check, Clock3, Copy, ExternalLink, FileText, ShieldCheck, X } from "lucide-react";
import { useState, type ReactNode } from "react";
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
import { useKavach } from "@/lib/kavach-store";
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
  const { approveRequest, denyRequest } = useKavach();
  const [isActing, setIsActing] = useState(false);

  if (!entry) return null;

  const isStepUp =
    entry.status === "STEP_UP_REQUIRED" || entry.status === "PENDING";

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

        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* AUTHORIZATION PANEL */}
          <div className="p-6">
            <h3 className="label-caps mb-4 flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" /> Authorization
            </h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Mandate</dt>
                <dd className="mt-1 font-medium flex items-center gap-2">
                  {agent?.status.toUpperCase() ?? "UNKNOWN"}
                  {agent?.status === "active" && <Check className="h-3.5 w-3.5 text-success" />}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Category</dt>
                <dd className="mt-1 font-medium">{agent?.rule.category ?? "N/A"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Limit</dt>
                <dd className="amount mt-1 font-medium">{agent ? formatINR(agent.rule.monthlyLimit) : "N/A"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Remaining</dt>
                <dd className="amount mt-1 font-medium text-success">{formatINR(before)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Policy rule</dt>
                <dd className="mt-1 font-medium text-xs leading-snug">{entry.reason}</dd>
              </div>
            </dl>
          </div>

          {/* PAYMENT EXECUTION PANEL */}
          <div className="p-6 bg-muted/10">
            <h3 className="label-caps mb-4 flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4" /> Payment Execution
            </h3>
            
            {entry.execution?.status === "NOT_INVOKED" ? (
              <div className="text-sm">
                <dl className="space-y-4 mb-4">
                  <div>
                    <dt className="text-muted-foreground text-xs">Provider</dt>
                    <dd className="mt-1 font-medium">{entry.execution.provider}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Environment</dt>
                    <dd className="mt-1 font-medium">{entry.execution.environment.replace("_", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Status</dt>
                    <dd className="mt-1 font-medium text-muted-foreground">NOT INVOKED</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded border border-border">
                  No provider order was created because KavachPay denied the intent.
                </p>
              </div>
            ) : (
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Provider</dt>
                  <dd className="mt-1 font-medium">{entry.execution?.provider ?? "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Environment</dt>
                  <dd className="mt-1 font-medium">{entry.execution?.environment?.replace("_", " ") ?? "N/A"}</dd>
                </div>
                {entry.execution?.orderId && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Order</dt>
                    <dd className="mt-1 font-mono text-xs">{entry.execution.orderId}</dd>
                  </div>
                )}
                {entry.execution?.paymentId && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Payment</dt>
                    <dd className="mt-1 font-mono text-xs">{entry.execution.paymentId}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd className="mt-1 font-medium flex items-center gap-2">
                    {entry.execution?.status?.replace("PROVIDER_", "") ?? "PENDING"}
                    {entry.execution?.status === "PROVIDER_CAPTURED" && <Check className="h-3.5 w-3.5 text-success" />}
                  </dd>
                </div>
                {entry.execution?.webhookVerified !== undefined && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Webhook</dt>
                    <dd className="mt-1 font-medium flex items-center gap-2">
                      {entry.execution.webhookVerified ? "VERIFIED" : "PENDING"}
                      {entry.execution.webhookVerified && <Check className="h-3.5 w-3.5 text-success" />}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>

        {isStepUp ? (
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                disabled={isActing}
                onClick={async () => {
                  setIsActing(true);
                  try {
                    await denyRequest(entry.id);
                    toast.success("Request denied", {
                      description: `${entry.merchant} payment was declined.`,
                    });
                    onOpenChange(false);
                  } catch {
                    toast.error("Could not decline request. Please try again.");
                  } finally {
                    setIsActing(false);
                  }
                }}
              >
                <X className="mr-1 h-4 w-4" /> Deny Request
              </Button>
              <Button
                className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                disabled={isActing}
                onClick={async () => {
                  setIsActing(true);
                  try {
                    await approveRequest(entry.id);
                    toast.success("Payment approved", {
                      description: `${formatINR(entry.amount)} authorized for ${entry.merchant}.`,
                    });
                    onOpenChange(false);
                  } catch {
                    toast.error("Could not approve request. Please try again.");
                  } finally {
                    setIsActing(false);
                  }
                }}
              >
                <Check className="mr-1 h-4 w-4" /> Approve {formatINR(entry.amount)}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => void navigator.clipboard.writeText(entry.id)}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy audit ID
            </Button>
          </div>
        ) : (
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
        )}
      </SheetContent>
    </Sheet>
  );
}
