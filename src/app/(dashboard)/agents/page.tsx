import type { Metadata } from "next";
import AgentsPage from "@/routes/agents-list";

export const metadata: Metadata = {
  title: "Agents — KavachPay mandates and limits",
  description:
    "Every AI agent with its mandate, spending rule, approved merchants and remaining authority.",
};

export default function Page() {
  return <AgentsPage />;
}
