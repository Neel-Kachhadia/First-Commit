import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { themeBootstrapScript } from "@/lib/theme";
import Script from "next/script";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script id="theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
