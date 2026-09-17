"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { KavachProvider } from "@/lib/kavach-store";
import { ThemeProvider } from "@/lib/theme";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <KavachProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </KavachProvider>
    </ThemeProvider>
  );
}
