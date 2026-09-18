"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  Moon,
  Sun,
  OctagonPause,
  Play,
  ChevronDown,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { useUserProfile, profileInitials } from "@/lib/user-profile";
import { KavachMark } from "@/components/kavach/logo";
import {
  AgentGlyph,
  ApprovalGlyph,
  AuthorityGlyph,
  CommandGlyph,
  DecisionGlyph,
  MandateGlyph,
} from "@/components/kavach/icons";
import { useKavach } from "@/lib/kavach-store";
import { useTheme } from "@/lib/theme";
import { formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

const NAV = [
  {
    to: "/dashboard",
    label: "Command Center",
    icon: CommandGlyph,
    exact: true,
  },
  { to: "/agents", label: "Agents", icon: AgentGlyph, exact: false },
  { to: "/authority", label: "Authority", icon: AuthorityGlyph, exact: false },
  { to: "/approvals", label: "Approvals", icon: ApprovalGlyph, exact: false },
  { to: "/activity", label: "Decisions", icon: DecisionGlyph, exact: false },
  {
    to: "/rules",
    label: "Mandates",
    icon: MandateGlyph,
    exact: false,
  },
] as const;

function NavList({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { approvals } = useKavach();
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={onNavigate}
            data-status={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "nav-item group relative flex items-center rounded-[5px] py-3.5 text-[17px] font-semibold leading-none text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground",
              collapsed ? "justify-center px-2" : "gap-3.5 px-3.5",
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className={cn("shrink-0", collapsed ? "h-[22px] w-[22px]" : "h-5 w-5")} aria-hidden="true" />
            <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>
              {item.label}
            </span>
            {item.label === "Approvals" && approvals.length > 0 ? (
              <span
                className={cn(
                  "amount bg-stepup/15 font-medium text-stepup",
                  collapsed
                    ? "absolute right-2 top-2 h-1.5 w-1.5 rounded-full text-[0px]"
                    : "rounded-full px-2.5 py-0.5 text-sm",
                )}
              >
                {collapsed ? "" : approvals.length}
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
              {frozen
                ? "Resume all agent spending?"
                : "Stop all agent spending?"}
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
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function Brand({
  className,
  collapsed = false,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex min-w-0 items-center gap-2.5 rounded-md", className)}
    >
      <KavachMark className={cn("shrink-0 text-primary", collapsed ? "h-9 w-9" : "h-8 w-8")} />
      <span
        className={cn(
          "text-xl font-semibold tracking-[-0.025em]",
          collapsed && "sr-only",
        )}
      >
        KavachPay
      </span>
    </Link>
  );
}

function ResetDemo() {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (resetting) return;

    const confirmed = window.confirm(
      "Reset the KavachPay demo? This will clear the current demo state."
    );

    if (!confirmed) return;

    try {
      setResetting(true);
      await apiClient.resetDemo();
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset demo:", error);
      window.alert("Failed to reset the demo. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReset}
      disabled={resetting}
      className="hidden sm:inline-flex"
    >
      {resetting ? "Resetting…" : "Reset Demo"}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { frozen, approvals } = useKavach();
  const { profile, loadPersona } = useUserProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(
        window.localStorage.getItem("kavachpay-sidebar") === "collapsed",
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(
        "kavachpay-sidebar",
        next ? "collapsed" : "expanded",
      );
      return next;
    });
  };

  return (
    <div
      className="dashboard-shell min-h-screen bg-background"
      data-sidebar-collapsed={sidebarCollapsed}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="shell-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card lg:flex">
        <div
          className={cn(
            "flex h-[72px] items-center border-b border-border",
            sidebarCollapsed ? "justify-center gap-1 px-1.5" : "justify-between px-5",
          )}
        >
          <Brand collapsed={sidebarCollapsed} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0", sidebarCollapsed ? "h-9 w-7" : "h-9 w-9")}
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
        <div className={cn("flex-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-3")}>
          <p className={cn("mb-2 px-3 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground", sidebarCollapsed && "sr-only")}>
            Workspace
          </p>
          <NavList collapsed={sidebarCollapsed} />
        </div>
        <div className={cn("border-t border-border", sidebarCollapsed ? "p-3" : "p-4")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center rounded-md p-1.5 text-left transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  sidebarCollapsed ? "justify-center" : "gap-3",
                )}
                aria-label="User profile and settings"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/12 text-xs font-semibold text-primary">
                  {profileInitials(profile.name)}
                </span>
                <span className={cn("min-w-0 flex-1", sidebarCollapsed && "sr-only")}>
                  <span className="block truncate text-[15px] font-semibold text-foreground">
                    {profile.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {profile.syntheticAccount.bankName} •••• {profile.syntheticAccount.last4}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                    sidebarCollapsed && "hidden",
                  )}
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-64 p-1.5 shadow-xl border border-border bg-popover"
            >
              <DropdownMenuLabel className="font-normal px-2.5 py-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">{profile.name}</p>
                  <p className="text-xs text-muted-foreground leading-none">{profile.email}</p>
                  <div className="flex items-center gap-1.5 pt-1.5">
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {profile.userId}
                    </span>
                    <span className="inline-flex items-center rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      Principal
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setEditProfileOpen(true)}
                className="cursor-pointer gap-2 py-2"
              >
                <User className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Edit Profile</span>
                  <span className="text-[10px] text-muted-foreground">Update name, email & OTP</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer gap-2 py-2">
                <Link href="/profile">
                  <ShieldCheck className="h-4 w-4 text-stepup" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">Principal & Authority Settings</span>
                    <span className="text-[10px] text-muted-foreground">Zero-KYC authentication view</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Switch Principal Persona
              </div>
              <DropdownMenuItem
                onClick={() => loadPersona("arnav")}
                className="cursor-pointer flex items-center justify-between py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                    AB
                  </span>
                  <span className="text-xs font-medium">Arnav Bhandari</span>
                </div>
                {profile.name === "Arnav Bhandari" && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => loadPersona("ananya")}
                className="cursor-pointer flex items-center justify-between py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                    AI
                  </span>
                  <span className="text-xs font-medium">Ananya Iyer</span>
                </div>
                {profile.name === "Ananya Iyer" && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="shell-content-wrapper">
        <header className="shell-topbar sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
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
              <SheetContent side="left" className="w-72 p-0 flex flex-col justify-between">
                <div>
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="flex h-16 items-center border-b border-border px-5">
                    <Brand />
                  </div>
                  <div className="p-3">
                    <NavList onNavigate={() => setMenuOpen(false)} />
                  </div>
                </div>
                <div className="border-t border-border p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditProfileOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-muted cursor-pointer"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/12 text-xs font-semibold text-primary">
                      {profileInitials(profile.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {profile.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {profile.email}
                      </span>
                    </span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <Brand className="lg:hidden" />
              <Link
                href="/activity"
                className="hidden h-9 max-w-md items-center gap-2 rounded-md border border-input bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground md:flex"
                aria-label="Search transactions, mandates, authorities or agents"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="min-w-0 flex-1 truncate">
                  Search ID, agent, merchant…
                </span>
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px]">
                  ⌘K
                </kbd>
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-md border border-success/20 bg-success/8 px-2 py-1 text-[10px] font-medium text-success sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Sandbox
              </span>
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link
                  href="/approvals"
                  aria-label={`${approvals.length} approval notifications`}
                >
                  <Bell className="h-4 w-4" />
                  {approvals.length > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-stepup" />
                  ) : null}
                </Link>
              </Button>
              <ThemeToggle />
              <ResetDemo />
              <EmergencyStop />
            </div>
          </div>
          {frozen ? (
            <div className="border-t border-destructive/30 bg-destructive/10">
              <p className="mx-auto max-w-[1440px] px-4 py-2 text-xs font-medium text-destructive sm:px-6 lg:px-8">
                Emergency stop is active. All agent spending is halted until you
                resume.
              </p>
            </div>
          ) : null}
        </header>

        <main
          id="main"
          className="dashboard-main mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>

      <EditProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
      />
    </div>
  );
}
