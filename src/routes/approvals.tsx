import { createFileRoute, Link } from "@tanstack/react-router";
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
      { property: "og:title", content: "Approvals — KavachPay step-up requests" },
      {
        property: "og:description",
        content: "Approve or decline agent payments that exceeded their spending rule.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { approvals, approveRequest, denyRequest, getAgent } = useKavach();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Step-up approvals"
        description="Payments an agent could not clear on its own. Nothing moves until you decide."
      />

      {approvals.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <h2 className="text-lg font-semibold">Nothing waiting on you</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Every agent payment so far has been settled inside its rule. New requests
            appear here the moment an agent goes over its cap.
          </p>
          <Button variant="outline" className="mt-5" asChild>
            <Link to="/activity">Review activity</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {approvals.map((request) => {
            const agent = getAgent(request.agentId);
            return (
              <li key={request.id} className="surface-card p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="label-caps">{agent?.name ?? "Agent"}</p>
                    <h2 className="mt-1 text-lg font-semibold">{request.merchant}</h2>
                    <p className="text-sm text-muted-foreground">
                      {request.description}
                    </p>
                    <p className="mt-2 text-sm text-stepup">{request.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatDateTime(request.requestedAt)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="amount text-2xl font-medium">
                      {formatINR(request.amount)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          denyRequest(request.id);
                          toast.success("Request declined", {
                            description: `${request.merchant} payment was not made.`,
                          });
                        }}
                      >
                        Decline
                      </Button>
                      <Button
                        onClick={() => {
                          approveRequest(request.id);
                          toast.success("Payment approved", {
                            description: `${formatINR(request.amount)} released to ${request.merchant}.`,
                          });
                        }}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
