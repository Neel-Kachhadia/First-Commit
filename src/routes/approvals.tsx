"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { ApprovalGlyph, ReviewGlyph } from "@/components/kavach/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";

export default function ApprovalsPage() {
  const { approvals, approveRequest, denyRequest, getAgent, remainingFor } =
    useKavach();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const totalWaiting = approvals.reduce(
    (sum, request) => sum + request.amount,
    0,
  );

  return (
    <div className="approvals-page space-y-7">
      <PageHeader
        title="Step-up approvals"
        description="Payments that crossed an agent's autonomous boundary. Review the exact rule and approve a one-time exception—or stop it."
        actions={
          <Button variant="outline" asChild>
            <Link href="/activity">Open decision log</Link>
          </Button>
        }
      />

      <section className="review-ribbon metric-cluster grid overflow-hidden border-y border-border sm:grid-cols-3">
        <div className="bg-card p-5">
          <p className="label-caps">Requests waiting</p>
          <p className="amount mt-3 text-2xl font-medium text-destructive">{approvals.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            require a human decision
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="label-caps">Value under review</p>
          <p className="amount mt-3 text-2xl font-medium text-stepup">
            {formatINR(totalWaiting)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            no money has moved yet
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="label-caps">Approval scope</p>
          <p className="mt-3 text-lg font-medium">One payment only</p>
          <p className="mt-1 text-xs text-muted-foreground">
            mandate limits remain unchanged
          </p>
        </div>
      </section>

      {approvals.length === 0 ? (
        <div className="surface-card grid min-h-72 place-items-center p-10 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
              <Check className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">
              Nothing waiting on you
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Every recent payment was settled inside its active mandate.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-stepup/15 text-stepup">
                <ReviewGlyph className="h-3 w-3" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Pending step-up reviews ({approvals.length})
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Independent one-time authorizations
            </span>
          </div>

          <div className="grid gap-3.5">
            {approvals.map((request) => {
              const agent = getAgent(request.agentId);
              const threshold = agent?.rule.perTransactionCap ?? 0;
              const excess = Math.max(0, request.amount - threshold);
              const remainingAfter = agent
                ? Math.max(0, remainingFor(agent) - request.amount)
                : 0;

              return (
                <article
                  key={request.id}
                  className="surface-card relative overflow-hidden rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-xs transition-all hover:border-foreground/25 hover:shadow-sm"
                >
                  {/* Amber accent bar on left */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-stepup" />

                  {/* Header: Agent info & Status */}
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-stepup/25 bg-stepup/10 text-stepup">
                        <ApprovalGlyph className="h-3 w-3" />
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {agent?.name ?? "Agent"}
                      </span>
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {agent?.mandateId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="status-chip inline-flex items-center rounded-md border border-stepup/25 bg-stepup/10 font-mono font-medium uppercase text-stepup">
                        <ReviewGlyph className="h-2.5 w-2.5" /> Waiting
                      </span>
                      <button
                        type="button"
                        className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          await navigator.clipboard.writeText(request.ledgerId);
                          toast.success("Transaction ID copied");
                        }}
                      >
                        {request.ledgerId.toUpperCase()}
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Main: Merchant & Amount */}
                  <div className="mt-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                        {request.merchant}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {request.description}
                      </p>
                    </div>
                    <p className="amount shrink-0 text-lg sm:text-xl font-semibold text-foreground">
                      {formatINR(request.amount)}
                    </p>
                  </div>

                  {/* Compact Rule & Threshold Matrix */}
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Threshold</p>
                      <p className="amount mt-0.5 font-medium text-foreground">{formatINR(threshold)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Excess Amount</p>
                      <p className="amount mt-0.5 font-semibold text-stepup">+{formatINR(excess)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining After</p>
                      <p className="amount mt-0.5 font-medium text-foreground">{formatINR(remainingAfter)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Scope</p>
                      <p className="mt-0.5 text-[11px] font-medium text-foreground truncate">One-time release</p>
                    </div>
                  </div>

                  {/* Footer: Metadata & Compact Action Buttons */}
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2.5 border-t border-border/50">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Requested {formatDateTime(request.requestedAt)}</span>
                      {agent ? (
                        <>
                          <span>·</span>
                          <Link
                            href={`/agents/${agent.id}`}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            Inspect mandate <ExternalLink className="h-3 w-3" />
                          </Link>
                        </>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-medium text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                        disabled={resolvingId === request.id}
                        onClick={async () => {
                          setResolvingId(request.id);
                          try {
                            await denyRequest(request.id);
                            toast.success("Request declined", {
                              description: `${request.merchant} payment was not made.`,
                            });
                          } catch {
                            toast.error("Could not decline request", {
                              description: "The request was restored. Please try again.",
                            });
                          } finally {
                            setResolvingId(null);
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Deny
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 sm:h-8 px-3 sm:px-3.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90"
                        disabled={resolvingId === request.id}
                        onClick={async () => {
                          setResolvingId(request.id);
                          try {
                            await approveRequest(request.id);
                            toast.success("Payment approved", {
                              description: `${formatINR(request.amount)} released to ${request.merchant}.`,
                            });
                          } catch {
                            toast.error("Could not approve payment", {
                              description: "The request was restored. Please try again.",
                            });
                          } finally {
                            setResolvingId(null);
                          }
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve once
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
