import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { ApprovalGlyph, ReviewGlyph } from "@/components/kavach/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDateTime, formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — KavachPay step-up requests" },
      {
        name: "description",
        content:
          "Review agent payments that exceeded their rule and decide whether to approve or decline each step-up request.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { approvals, approveRequest, denyRequest, getAgent, remainingFor } =
    useKavach();
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
            <Link to="/activity">Open decision log</Link>
          </Button>
        }
      />

      <section className="review-ribbon metric-cluster grid overflow-hidden border-y border-border sm:grid-cols-3">
        <div className="bg-card p-5">
          <p className="label-caps">Requests waiting</p>
          <p className="amount mt-3 text-2xl font-medium">{approvals.length}</p>
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
        <section className="approval-stack surface-card overflow-hidden">
          {approvals.map((request) => {
            const agent = getAgent(request.agentId);
            const threshold = agent?.rule.perTransactionCap ?? 0;
            const remainingAfter = agent
              ? Math.max(0, remainingFor(agent) - request.amount)
              : 0;
            return (
              <article
                key={request.id}
                className="approval-instrument flex flex-col border-b border-border last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[5px] border border-stepup/25 bg-stepup/10 text-stepup">
                      <ApprovalGlyph className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {agent?.name ?? "Agent"}
                      </p>
                      <p className="amount truncate text-[10px] text-muted-foreground">
                        {agent?.mandateId}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-stepup/25 bg-stepup/10 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-stepup">
                    <ReviewGlyph className="h-3 w-3" /> Waiting
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {request.merchant}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </div>
                    <p className="amount shrink-0 text-2xl font-medium">
                      {formatINR(request.amount)}
                    </p>
                  </div>

                  <div className="mt-5 grid border-y border-border sm:grid-cols-2">
                    <div className="bg-stepup/5 p-4 sm:border-r sm:border-border">
                      <p className="label-caps text-stepup">Why held</p>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Requested</dt>
                          <dd className="amount font-medium">
                            {formatINR(request.amount)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Threshold</dt>
                          <dd className="amount font-medium">
                            {formatINR(threshold)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-stepup/15 pt-2">
                          <dt className="text-muted-foreground">Excess</dt>
                          <dd className="amount font-medium text-stepup">
                            {formatINR(Math.max(0, request.amount - threshold))}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="bg-muted/20 p-4">
                      <p className="label-caps">If approved</p>
                      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <li>{formatINR(request.amount)} executes once</li>
                        <li>
                          Remaining authority: {formatINR(remainingAfter)}
                        </li>
                        <li>Threshold stays {formatINR(threshold)}</li>
                        <li>Mandate remains unchanged</li>
                        <li>Unused approval expires after 10 minutes</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>Requested {formatDateTime(request.requestedAt)}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-mono hover:text-foreground"
                      onClick={async () => {
                        await navigator.clipboard.writeText(request.ledgerId);
                        toast.success("Transaction ID copied");
                      }}
                    >
                      {request.ledgerId.toUpperCase()}{" "}
                      <Copy className="h-3 w-3" />
                    </button>
                    {agent ? (
                      <Link
                        to="/agents/$agentId"
                        params={{ agentId: agent.id }}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Inspect mandate <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>

                  <div className="sticky bottom-0 -mx-5 mt-6 grid grid-cols-2 gap-2 border-t border-border bg-card px-5 pb-1 pt-5 sm:static sm:mx-0 sm:bg-transparent sm:px-0">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        denyRequest(request.id);
                        toast.success("Request declined", {
                          description: `${request.merchant} payment was not made.`,
                        });
                      }}
                    >
                      <X className="h-4 w-4" /> Deny payment
                    </Button>
                    <Button
                      onClick={() => {
                        approveRequest(request.id);
                        toast.success("Payment approved", {
                          description: `${formatINR(request.amount)} released to ${request.merchant}.`,
                        });
                      }}
                    >
                      <Check className="h-4 w-4" /> Approve once
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
