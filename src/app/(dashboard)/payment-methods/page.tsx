import type { Metadata } from "next";
import PaymentMethodsPage from "@/routes/payment-methods";

export const metadata: Metadata = {
  title: "Payment Methods — KavachPay",
  description:
    "Configure execution context. Connect a simulated Razorpay TEST payment profile for root mandates.",
};

export default function Page() {
  return <PaymentMethodsPage />;
}
