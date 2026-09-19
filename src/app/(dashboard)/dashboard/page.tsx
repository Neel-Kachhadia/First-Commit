import type { Metadata } from "next";
import Overview from "@/routes/index";

export const metadata: Metadata = {
  title: "Command Center — KavachPay",
  description:
    "Monitor live financial authority, exposure, approvals and agent payment decisions.",
};

export default function DashboardPage() {
  return <Overview />;
}
