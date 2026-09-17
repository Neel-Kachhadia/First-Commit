import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  Plus,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthorityBar,
  PageHeader,
  StatusPill,
  agentTone,
} from "@/components/kavach/primitives";
import { AnimatedList, CountUpValue } from "@/components/ui/motion-primitives";
import { useKavach } from "@/lib/kavach-store";
import { formatINR } from "@/lib/kavach-data";

export const Route = createFileRoute("/agents/")({
  head: () => ({
    meta: [
      { title: "Agents — KavachPay mandates and limits" },
      {
        name: "description",
        content:
          "Every AI agent with its mandate, spending rule, approved merchants and remaining authority for the month.",
      },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { agents, remainingFor, frozen } = useKavach();
  const live = agents.filter((agent) => agent.status === "active").length;
  const reachable = agents.reduce((sum, agent) => sum + remainingFor(agent), 0);
  const merchants = new Set(agents.flatMap((agent) => agent.rule.merchants))
    .size;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Agent authority"
        description="Every connected agent, the mandate it inherited, and the exact amount it can still move."
        actions={
          <Button asChild>
            <Link to="/rules">
              <Plus className="h-4 w-4" /> Issue mandate
            </Link>
          </Button>
        }
      />

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        <div className="bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="label-caps">Active agents</p>
            <Bot className="h-4 w-4 text-success" />
          </div>
          <p className="amount mt-3 text-2xl font-medium">
            <CountUpValue value={live} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            of {agents.length} connected
          </p>
        </div>
        <div className="bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="label-caps">Reachable authority</p>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="amount mt-3 text-2xl font-medium">
            <CountUpValue value={reachable} format={formatINR} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            available right now
          </p>
        </div>
        <div className="bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="label-caps">Approved merchants</p>
            <Store className="h-4 w-4 text-stepup" />
          </div>
          <p className="amount mt-3 text-2xl font-medium">
            <CountUpValue value={merchants} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            across all mandates
          </p>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Mandate registry</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Select an agent to inspect or change its authority.
            </p>
          </div>
          <span className="amount text-xs text-muted-foreground">
            {agents.length} records
          </span>
        </div>

        <AnimatedList>
          {agents.map((agent) => {
            const tone = agentTone(agent.status);
            const remaining = remainingFor(agent);
            return (
              <Link
                key={agent.id}
                to="/agents/$agentId"
                params={{ agentId: agent.id }}
                className="agent-row group grid gap-4 border-b border-border p-5 last:border-b-0 md:grid-cols-[minmax(210px,1.2fr)_minmax(170px,1fr)_minmax(150px,.8fr)_auto] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-muted/50 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {agent.name}
                      </p>
                      <StatusPill tone={tone.tone} label={tone.label} />
                    </div>
                    <p className="amount mt-0.5 truncate text-[11px] text-muted-foreground">
                      {agent.mandateId} · {agent.rule.category}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>{formatINR(agent.consumed)} used</span>
                    <span className="amount text-foreground">
                      {formatINR(remaining)} left
                    </span>
                  </div>
                  <AuthorityBar
                    consumed={agent.consumed}
                    limit={agent.rule.monthlyLimit}
                    muted={agent.status === "revoked" || frozen}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {agent.rule.merchants.slice(0, 2).map((merchant) => (
                    <span
                      key={merchant}
                      className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {merchant}
                    </span>
                  ))}
                  {agent.rule.merchants.length > 2 ? (
                    <span className="px-1 py-1 text-[11px] text-muted-foreground">
                      +{agent.rule.merchants.length - 2}
                    </span>
                  ) : null}
                </div>

                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  Inspect <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </AnimatedList>
      </section>
    </div>
  );
}
