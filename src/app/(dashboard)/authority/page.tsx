import type { Metadata } from "next";
import AuthorityPage from "@/routes/authority";

export const metadata: Metadata = {
  title: "Authority universe — KavachPay",
  description:
    "Inspect live financial authority, maximum reachable exposure and every event that changed it.",
};

export default function Page() {
  return <AuthorityPage />;
}
