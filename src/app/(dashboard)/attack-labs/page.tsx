import type { Metadata } from "next";
import AttackLabsPage from "@/routes/attack-labs";

export const metadata: Metadata = {
  title: "Attack Labs — KavachPay",
  description: "Run authorized sandbox scenarios and inspect the control plane response and evidence.",
};

export default function Page() {
  return <AttackLabsPage />;
}
