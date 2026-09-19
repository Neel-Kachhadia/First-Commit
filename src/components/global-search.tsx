"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKavach } from "@/lib/kavach-store";

const PAGES = [
  { label: "Command Center", href: "/dashboard" },
  { label: "Agents", href: "/agents" },
  { label: "Authority", href: "/authority" },
  { label: "Approvals", href: "/approvals" },
  { label: "Decisions", href: "/activity" },
  { label: "Mandates", href: "/rules" },
  { label: "Attack Labs", href: "/attack-labs" },
] as const;

export function GlobalSearch() {
  const router = useRouter();
  const { agents, ledger } = useKavach();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    if (!needle) return [];
    return [
      ...PAGES.filter((page) => page.label.toLowerCase().includes(needle)).map((page) => ({
        kind: "Page", label: page.label, detail: "Workspace", href: page.href,
      })),
      ...agents.filter((agent) => `${agent.name} ${agent.mandateId} ${agent.id}`.toLowerCase().includes(needle)).slice(0, 5).map((agent) => ({
        kind: "Agent", label: agent.name, detail: agent.mandateId, href: `/agents/${encodeURIComponent(agent.id)}`,
      })),
      ...ledger.filter((entry) => `${entry.id} ${entry.merchant} ${entry.description}`.toLowerCase().includes(needle)).slice(0, 6).map((entry) => ({
        kind: "Decision", label: entry.merchant, detail: entry.id, href: `/activity?search=${encodeURIComponent(entry.id)}`,
      })),
    ].slice(0, 10);
  }, [agents, ledger, needle]);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 w-full max-w-md items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Search pages, agents and decisions"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Search ID, agent, merchant…</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[11px] md:inline">⌘K</kbd>
      </button>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Search KavachPay</DialogTitle>
            <DialogDescription>Find a page, agent, or payment decision.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) navigate(results[0].href);
              }}
              placeholder="Search pages, agents, decisions…"
              className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search pages, agents and decisions"
            />
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {needle && results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matching pages, agents, or decisions.</p>
            ) : (
              (needle ? results : PAGES.map((page) => ({ kind: "Page", label: page.label, detail: "Workspace", href: page.href }))).map((result) => (
                <button
                  key={`${result.kind}-${result.href}`}
                  type="button"
                  onClick={() => navigate(result.href)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-foreground">{result.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{result.kind} · {result.detail}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
