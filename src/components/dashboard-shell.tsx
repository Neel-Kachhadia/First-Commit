"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { KavachProvider } from "@/lib/kavach-store";
import { ThemeProvider } from "@/lib/theme";
import { UserProfileProvider } from "@/lib/user-profile";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 5,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UserProfileProvider>
          <KavachProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </KavachProvider>
        </UserProfileProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
