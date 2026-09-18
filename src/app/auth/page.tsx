import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = {
  title: "Sign In — KavachPay",
  description:
    "Sign in or create a KavachPay account to manage your AI agent payment mandates.",
};

export default function AuthRoute() {
  return <AuthPage />;
}
