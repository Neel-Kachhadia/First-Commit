import type { Metadata } from "next";
import AgentDetail from "@/routes/agent-detail";

export const metadata: Metadata = {
  title: "Agent mandate — KavachPay",
  description:
    "Inspect one agent's mandate, spending rule, approved merchants and decision history.",
};

export default function Page() {
  return <AgentDetail />;
}
