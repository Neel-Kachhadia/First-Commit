import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { themeBootstrapScript } from "@/lib/theme";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
