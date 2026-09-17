import type { Metadata } from "next";
import RulesPage from "@/routes/rules";

export const metadata: Metadata = {
  title: "Mandate Studio — KavachPay",
  description: "Define, test, review and activate a financial mandate.",
};

export default function Page() {
  return <RulesPage />;
}
