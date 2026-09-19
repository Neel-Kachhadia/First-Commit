import type { Metadata } from "next";
import { CardPreviewPage } from "@/components/auth/CardPreviewPage";

export const metadata: Metadata = {
  title: "Card preview — KavachPay",
  description: "An animated visual card preview. No payment method is linked or charged.",
};

export default function CardPreviewRoute() {
  return <CardPreviewPage />;
}
