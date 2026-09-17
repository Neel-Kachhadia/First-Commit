import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  GaugeCircle,
  Bot,
  Network,
  ShieldCheck,
  Receipt,
  SlidersHorizontal,
  Menu,
  Moon,
  Sun,
  OctagonPause,
  Play,
} from "lucide-react";
import { KavachMark } from "@/components/kavach/logo";
import { useKavach } from "@/lib/kavach-store";
import { useTheme } from "@/lib/theme";
import { formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: GaugeCircle, exact: true },
  { to: "/agents", label: "Agents", icon: Bot, exact: false },
  { to: "/authority", label: "Authority graph", icon: Network, exact: false },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, exact: false },
  { to: "/activity", label: "Activity", icon: Receipt, exact: false },
  { to: "/rules", label: "Spending rules", icon: SlidersHorizontal, exact: false },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { approvals } = useKavach();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: item.exact }}
            className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.label === "Approvals" && approvals.length > 0 ? (
              <span className="amount rounded-full bg-stepup/15 px-2 py-0.5 text-xs font-medium text-stepup">
                {approvals.length}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function EmergencyStop() {
  const { frozen, setFrozen, maxPossibleSpend } = useKavach();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={frozen ? "outline" : "destructive"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {frozen ? (
          <Play className="h-4 w-4" aria-hidden="true" />
        ) : (
          <OctagonPause className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {frozen ? "Resume spending" : "Emergency stop"}
        </span>
        <span className="sm:hidden">{frozen ? "Resume" : "Stop"}</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {frozen ? "Resume all agent spending?" : "Stop all agent spending?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {frozen
                ? "Every mandate returns to its remaining authority. Agents can transact again immediately, subject to their spending rules."
                : `Every active mandate is suspended at once. Maximum possible spend drops from ${formatINR(maxPossibleSpend)} to ₹0 and all in-flight agent payments are declined until you resume.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                frozen
                  ? undefined
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
              onClick={() => {
                setFrozen(!frozen);
                setOpen(false);
              }}
            >
              {frozen ? "Resume spending" : "Stop all spending"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn("flex min-w-0 items-center gap-2.5 rounded-md", className)}
    >
      <KavachMark className="h-7 w-7 shrink-0 text-primary" />
      <span className="font-serif text-lg font-semibold tracking-tight">KavachPay</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { frozen } = useKavach();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList />
        </div>
        <div className="border-t border-border p-4">
          <p className="label-caps">Account</p>
          <p className="mt-1 truncate text-sm font-medium">Ananya Iyer</p>
          <p className="truncate text-xs text-muted-foreground">
            HDFC •••• 4417 · Primary mandate
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-16 items-center border-b border-border px-5">
                  <Brand />
                </div>
                <div className="p-3">
                  <NavList onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <Brand className="lg:hidden" />
              <p className="label-caps hidden lg:block">
                {NAV.find((n) =>
                  n.exact ? pathname === n.to : pathname.startsWith(n.to),
                )?.label ?? "Overview"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <EmergencyStop />
            </div>
          </div>
          {frozen ? (
            <div className="border-t border-destructive/30 bg-destructive/10">
              <p className="mx-auto max-w-6xl px-4 py-2 text-xs font-medium text-destructive sm:px-6 lg:px-8">
                Emergency stop is active. All agent spending is halted until you resume.
              </p>
            </div>
          ) : null}
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
