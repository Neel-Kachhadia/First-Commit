import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  AuthorityBar,
  PageHeader,
  StatusPill,
  agentTone,
} from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatDate, formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/agents/")({
  head: () => ({
    meta: [
      { title: "Agents — KavachPay mandates and limits" },
      {
        name: "description",
        content:
          "Every AI agent with its mandate, spending rule, approved merchants and remaining authority for the month.",
      },
      { property: "og:title", content: "Agents — KavachPay mandates and limits" },
      {
        property: "og:description",
        content: "Mandates, spending rules, approved merchants and remaining authority.",
      },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { agents, remainingFor, frozen } = useKavach();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agents"
        description="Each agent holds a scoped mandate. Authority is capped per month, per transaction and per merchant."
        actions={
          <Button asChild>
            <Link to="/rules">Issue a mandate</Link>
          </Button>
        }
      />

      <div className="grid gap-4">
        {agents.map((agent) => {
          const tone = agentTone(agent.status);
          return (
            <article key={agent.id} className="surface-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{agent.name}</h2>
                    <StatusPill tone={tone.tone} label={tone.label} />
                  </div>
                  <p className="amount mt-0.5 text-xs text-muted-foreground">
                    {agent.mandateId} · issued {formatDate(agent.issuedOn)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/agents/$agentId" params={{ agentId: agent.id }}>
                    Open mandate
                  </Link>
                </Button>
              </div>

              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                {agent.purpose}
              </p>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="label-caps">Monthly limit</dt>
                  <dd className="amount mt-1 text-sm font-medium">
                    {formatINR(agent.rule.monthlyLimit)}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps">Per transaction</dt>
                  <dd className="amount mt-1 text-sm font-medium">
                    {formatINR(agent.rule.perTransactionCap)}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps">Category</dt>
                  <dd className="mt-1 text-sm font-medium">{agent.rule.category}</dd>
                </div>
                <div>
                  <dt className="label-caps">Remaining</dt>
                  <dd className="amount mt-1 text-sm font-medium">
                    {formatINR(remainingFor(agent))}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 space-y-2">
                <AuthorityBar
                  consumed={agent.consumed}
                  limit={agent.rule.monthlyLimit}
                  muted={agent.status === "revoked" || frozen}
                />
                <p className="amount text-xs text-muted-foreground">
                  {formatINR(agent.consumed)} consumed of{" "}
                  {formatINR(agent.rule.monthlyLimit)}
                </p>
              </div>

              <ul className="mt-4 flex flex-wrap gap-2">
                {agent.rule.merchants.map((m) => (
                  <li
                    key={m}
                    className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
