"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth/auth-context";

export default function ProductLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show nothing while hydrating auth state to prevent flashing protected content.
  if (isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0805",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          letterSpacing: "0.22em",
          color: "rgba(200,185,160,0.35)",
          textTransform: "uppercase",
        }}
        aria-live="polite"
        aria-label="Loading KavachPay"
      >
        KAVACHPAY…
      </div>
    );
  }

  if (!isAuthenticated) {
    // Router replace is in flight — render nothing to avoid flash.
    return null;
  }

  return (
    <DashboardShell>{children}</DashboardShell>
  );
}
