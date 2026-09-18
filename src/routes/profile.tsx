"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  Metric,
  StatusPill,
  agentTone,
} from "@/components/kavach/primitives";
import { AgentGlyph, AuthorityGlyph } from "@/components/kavach/icons";
import { useUserProfile, profileInitials, type AuthMethod } from "@/lib/user-profile";
import { useKavach } from "@/lib/kavach-store";
import { formatINR } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(`${label} copied`, {
        description: value,
      });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value, label]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default function ProfilePage() {
  const { profile, updateProfile, loadPersona, regenerateUserId } = useUserProfile();
  const { agents, totalAuthority, remainingFor } = useKavach();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [authMethod, setAuthMethod] = useState<AuthMethod>(profile.authMethod);
  const [saved, setSaved] = useState(false);

  // Sync draft form state when persona changes
  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone ?? "");
    setAuthMethod(profile.authMethod);
  }, [profile]);

  const handlePersonaSwitch = (persona: "arnav" | "ananya") => {
    loadPersona(persona);
    toast.success(
      persona === "arnav"
        ? "Switched to Arnav Bhandari"
        : "Switched to Ananya Iyer",
      {
        description: "Principal authority root updated across all views.",
      },
    );
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("A valid email address is required");
      return;
    }

    updateProfile({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() ? phone.trim() : undefined,
      authMethod,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2200);

    toast.success("Principal credentials saved", {
      description: `Active principal updated as ${name.trim()}.`,
    });
  };

  return (
    <div className="profile-page space-y-7">
      {/* Editorial Page Header matching Authority and Mandates */}
      <PageHeader
        title="Principal identity"
        description="Root authentication credentials for KavachPay. Authentication data is strictly isolated from financial authority; no banking KYC, PAN, Aadhaar, or UPI PIN is ever requested."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Simulate:
            </span>
            <Button
              type="button"
              variant={profile.name === "Arnav Bhandari" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePersonaSwitch("arnav")}
              className="cursor-pointer gap-1.5"
            >
              <span className="grid h-4 w-4 place-items-center rounded bg-background/20 text-[9px] font-bold">
                AB
              </span>
              Arnav Bhandari
            </Button>
            <Button
              type="button"
              variant={profile.name === "Ananya Iyer" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePersonaSwitch("ananya")}
              className="cursor-pointer gap-1.5"
            >
              <span className="grid h-4 w-4 place-items-center rounded bg-background/20 text-[9px] font-bold">
                AI
              </span>
              Ananya Iyer
            </Button>
          </div>
        }
      />

      {/* Top Metrics Ribbon */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Principal identifier"
          value={profile.userId}
          hint={`${profile.name} · Root Grantor`}
          tone="primary"
        />
        <Metric
          label="Authentication factor"
          value={
            profile.authMethod === "email_otp"
              ? "Email OTP"
              : profile.authMethod === "phone_otp"
                ? "Phone SMS OTP"
                : "Hardware / Passkey"
          }
          hint="Zero-knowledge challenge active"
          tone="success"
        />
        <Metric
          label="Financial authority"
          value="Decoupled"
          hint={`${agents.length} active agent mandates · Zero KYC`}
        />
      </section>

      {/* Master 2-Column Grid */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.85fr)] xl:items-start">
        {/* Left: Principal Credentials Form */}
        <div className="grid min-w-0 gap-6">
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-base font-semibold">Principal credentials</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Authentication parameters identifying the root authority holder.
                </p>
              </div>
              <StatusPill tone="active" label="Principal root" />
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="profile-name" className="label-caps block">
                    Display name <span className="text-destructive">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Labels the root authority in live graphs and audit trails.
                  </p>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Arnav Bhandari"
                    className="mt-1"
                    required
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="profile-email" className="label-caps block">
                    Email address <span className="text-destructive">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Primary channel for login OTPs and step-up approvals.
                  </p>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. arnav@example.com"
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              {/* Machine Identifier */}
              <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="label-caps block">Principal machine identifier</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cryptographically scoped ID used to anchor autonomous agent delegations.
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <CopyButton value={profile.userId} label="Principal ID" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        regenerateUserId();
                        toast.info("Principal ID refreshed");
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Regenerate
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between rounded border border-input bg-card px-3 py-2">
                  <code className="amount font-mono text-sm font-semibold">
                    {profile.userId}
                  </code>
                  <span className="font-mono text-[11px] text-muted-foreground uppercase">
                    Auto-generated · Non-KYC
                  </span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label htmlFor="profile-phone" className="label-caps block">
                    Phone number <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enables SMS or WhatsApp OTP verification if configured.
                  </p>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="mt-1"
                  />
                </div>

                {/* Auth Method */}
                <div className="space-y-1.5">
                  <label className="label-caps block">Authentication challenge</label>
                  <p className="text-xs text-muted-foreground">
                    Challenge presented during principal account login.
                  </p>
                  <div className="mt-1">
                    <Select
                      value={authMethod}
                      onValueChange={(val) => setAuthMethod(val as AuthMethod)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email_otp">Email OTP (Recommended)</SelectItem>
                        <SelectItem value="phone_otp">Phone SMS OTP</SelectItem>
                        <SelectItem value="password">Password + Passkey Token</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Modifications update the live authority graph and causal logs immediately.
                </p>
                <Button type="submit" className="cursor-pointer min-w-[130px]">
                  {saved ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4 text-success" />
                      Saved
                    </>
                  ) : (
                    "Save modifications"
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Session Verification Card */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-base font-semibold">Active session & tokens</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cryptographic context established for this administrative terminal.
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                SHA-256 Verified
              </span>
            </div>

            <dl className="divide-y divide-border text-xs">
              <div className="flex items-center justify-between p-4 px-5">
                <dt className="text-muted-foreground">Session token</dt>
                <dd className="font-mono font-medium text-foreground">
                  sess_kvch_active_9281
                </dd>
              </div>
              <div className="flex items-center justify-between p-4 px-5">
                <dt className="text-muted-foreground">Authority role</dt>
                <dd className="font-medium text-foreground">Root Principal (100% Control)</dd>
              </div>
              <div className="flex items-center justify-between p-4 px-5">
                <dt className="text-muted-foreground">Delegation horizon</dt>
                <dd className="font-medium text-foreground">Max 2 hops (Principal &rarr; Agent &rarr; Merchant)</dd>
              </div>
              <div className="flex items-center justify-between p-4 px-5">
                <dt className="text-muted-foreground">MFA state</dt>
                <dd className="font-medium text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Enforced via One-Time Challenge
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: Architectural Isolation & Linked Mandates */}
        <div className="grid min-w-0 gap-6">
          {/* Architectural Boundary Specification */}
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Boundary specification</h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Strict separation of identity onboarding from agent financial authorization.
              </p>
            </div>

            <div className="divide-y divide-border text-xs">
              <div className="p-4 px-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Layer 01 · Identity & Onboarding</span>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Authentication</span>
                </div>
                <p className="text-muted-foreground">
                  Collects only Name, Email, auto-generated User ID, and OTP. Never touches real KYC credentials.
                </p>
              </div>

              <div className="p-4 px-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Layer 02 · Financial Authority</span>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Authorization</span>
                </div>
                <p className="text-muted-foreground">
                  Granted only when configuring autonomous agents. Authority is bounded by monthly spend limits, merchant scopes, and approval step-ups.
                </p>
              </div>

              <div className="p-4 px-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Layer 03 · Settlement Sandbox</span>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Settlement</span>
                </div>
                <p className="text-muted-foreground">
                  Draws from isolated virtual escrow ({profile.syntheticAccount.bankName} •••• {profile.syntheticAccount.last4}). Zero exposure to personal bank accounts or UPI rails.
                </p>
              </div>
            </div>

            <div className="border-t border-border bg-muted/20 p-4 px-5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Hackathon prototype policy:</span>{" "}
              Agents never possess payment credentials. All transactions are evaluated against signed programmatic mandates.
            </div>
          </div>

          {/* Active Agent Mandates Under This Principal */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2">
                  <AgentGlyph className="h-4 w-4 text-destructive" />
                  <h2 className="text-base font-semibold">Active agent authorities</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Delegated financial capacities rooted in this principal.
                </p>
              </div>
              <span className="amount shrink-0 text-sm font-semibold">
                {formatINR(totalAuthority)}
              </span>
            </div>

            <div className="divide-y divide-border">
              {agents.map((agent) => {
                const tone = agentTone(agent.status);
                const remaining = remainingFor(agent);
                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-4 px-5 transition-colors hover:bg-raised"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {agent.name}
                        </span>
                        <StatusPill
                          tone={tone.tone}
                          label={tone.label}
                          className="px-1.5 py-0.5 text-[8px]"
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {agent.rule.category} · Limit {formatINR(agent.rule.monthlyLimit)}/mo · Reachable {formatINR(remaining)}
                      </p>
                    </div>

                    <Button variant="ghost" size="sm" asChild className="shrink-0 h-8 px-2 text-xs">
                      <Link href={`/agents/${agent.id}`}>
                        Details
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border p-4 px-5 bg-card text-xs">
              <Link
                href="/authority"
                className="font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                <AuthorityGlyph className="h-3.5 w-3.5" />
                Live authority graph
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/rules"
                className="text-muted-foreground hover:text-foreground"
              >
                Create child mandate
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
