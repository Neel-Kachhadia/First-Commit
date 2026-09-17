import type { Metadata } from "next";
import ActivityPage from "@/routes/activity";

export const metadata: Metadata = {
  title: "Decision Feed — KavachPay",
  description:
    "An explainable ledger of every agent payment attempt and its causal record.",
};

export default function Page() {
  return <ActivityPage />;
}
