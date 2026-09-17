import type { Metadata } from "next";
import ApprovalsPage from "@/routes/approvals";

export const metadata: Metadata = {
  title: "Approvals — KavachPay step-up requests",
  description:
    "Review payments that exceeded their mandate and approve or decline each request.",
};

export default function Page() {
  return <ApprovalsPage />;
}
