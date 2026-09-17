import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock3, ExternalLink, ShieldAlert, X } from "lucide-react";
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
  const { approvals, approveRequest, denyRequest, getAgent } = useKavach();
  const totalWaiting = approvals.reduce(
    (sum, request) => sum + request.amount,
    0,
  );

  return (
    <div className="space-y-7">
      <PageHeader
        title="Step-up approvals"
        description="Payments that crossed an agent's autonomous boundary. Review the exact rule and approve a one-time exception—or stop it."
        actions={
          <Button variant="outline" asChild>
            <Link to="/activity">Open decision log</Link>
          </Button>
        }
      />

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
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
        <section className="grid gap-4 lg:grid-cols-2">
          {approvals.map((request) => {
            const agent = getAgent(request.agentId);
            return (
              <article
                key={request.id}
                className="surface-card flex flex-col overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-stepup/25 bg-stepup/10 text-stepup">
                      <ShieldAlert className="h-4 w-4" />
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
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-stepup/25 bg-stepup/10 px-2 py-1 text-[10px] font-medium text-stepup">
                    <Clock3 className="h-3 w-3" /> Waiting
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

                  <div className="mt-5 rounded-md border border-stepup/20 bg-stepup/8 p-4">
                    <p className="text-xs font-medium">Policy trigger</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {request.reason}.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>Requested {formatDateTime(request.requestedAt)}</span>
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

                  <div className="mt-6 grid grid-cols-2 gap-2 border-t border-border pt-5">
                    <Button
                      variant="outline"
                      onClick={() => {
                        denyRequest(request.id);
                        toast.success("Request declined", {
                          description: `${request.merchant} payment was not made.`,
                        });
                      }}
                    >
                      <X className="h-4 w-4" /> Deny
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
