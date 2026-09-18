"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { KavachProvider } from "@/lib/kavach-store";
import { ThemeProvider } from "@/lib/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <KavachProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </KavachProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
