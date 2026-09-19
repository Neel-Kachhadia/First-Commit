"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy } from "lucide-react";
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
  useUserProfile,
  profileInitials,
  type AuthMethod,
  type UserProfile,
} from "@/lib/user-profile";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

const personas = [
  { id: "ananya", name: "Ananya Iyer" },
  { id: "arnav", name: "Arnav Bhandari" },
] as const;

export default function ProfilePage() {
  const { profile, updateProfile, loadPersona } = useUserProfile();
  const { user } = useAuth();
  const profileKey = [profile.userId, profile.name, profile.email, profile.phone, profile.authMethod].join("|");

  return (
    <ProfileView
      key={profileKey}
      accountEmail={user?.email ?? ""}
      accountId={user?.sub ?? ""}
      profile={profile}
      updateProfile={updateProfile}
      loadPersona={loadPersona}
    />
  );
}

function ProfileView({
  accountEmail,
  accountId,
  profile,
  updateProfile,
  loadPersona,
}: {
  accountEmail: string;
  accountId: string;
  profile: UserProfile;
  updateProfile: (partial: Partial<Omit<UserProfile, "userId">>) => void;
  loadPersona: (persona: "ananya" | "arnav") => void;
}) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [authMethod, setAuthMethod] = useState<AuthMethod>(profile.authMethod);
  const [copied, setCopied] = useState(false);
  const changed =
    name.trim() !== profile.name ||
    email.trim() !== profile.email ||
    phone.trim() !== (profile.phone ?? "") ||
    authMethod !== profile.authMethod;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      authMethod,
    });
    toast.success("Profile saved");
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Account ID copied");
    } catch {
      toast.error("Could not copy the ID");
    }
  };

  return (
    <div className="profile-page mx-auto max-w-[900px] space-y-6 pb-10">
      <header className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-semibold text-destructive">Account</p>
        <h1 className="text-[2.15rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[2.55rem]">
          Your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your sign-in account and the demo principal shown in authority views.
        </p>
      </header>

      <section className="overflow-hidden rounded-[1.1rem_.4rem_1.1rem_.4rem] border border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-muted/25 px-5 py-5 sm:px-7">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[9px] border border-destructive/20 bg-destructive/10 text-xl font-semibold text-destructive" aria-hidden="true">
            {profileInitials(accountEmail.split("@")[0] || "KP")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold leading-tight">{accountEmail || "Signed-in account"}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              Account ID · {accountId || "Unavailable"}
            </p>
          </div>
          {accountId ? (
            <button type="button" onClick={copyId} aria-label="Copy account ID" className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-4 sm:px-7">
          <span className="text-xs font-semibold text-muted-foreground">Demo principal</span>
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-muted/40 p-1" aria-label="Demo profile">
            {personas.map((persona) => (
              <button
                key={persona.id}
                type="button"
                aria-pressed={profile.name === persona.name}
                onClick={() => {
                  if (profile.name === persona.name) return;
                  loadPersona(persona.id);
                  toast.success(`Switched to ${persona.name}`);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  profile.name === persona.name
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {persona.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={save} className="px-5 py-6 sm:px-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Demo principal details</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">These details label authority views; they do not change your sign-in account.</p>
          </div>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="text-sm font-semibold">Display name</label>
              <Input id="profile-name" name="demo-name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-email" className="text-sm font-semibold">Demo contact email</label>
              <Input id="profile-email" name="demo-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-phone" className="text-sm font-semibold">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input id="profile-phone" name="demo-phone" type="tel" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 00000" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-auth" className="text-sm font-semibold">Sign-in preference</label>
              <Select value={authMethod} onValueChange={(value) => setAuthMethod(value as AuthMethod)}>
                <SelectTrigger id="profile-auth" className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_otp">Email code</SelectItem>
                  <SelectItem value="phone_otp">SMS code</SelectItem>
                  <SelectItem value="password">Password / passkey (demo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="max-w-md text-xs text-muted-foreground">
              Saved in this browser only. Sign-in preference does not configure live authentication.
            </p>
            <Button type="submit" disabled={!changed}>Save changes</Button>
          </div>
        </form>

      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">Spending rules and agent access are managed separately.</p>
        <Link href="/authority" className="inline-flex items-center gap-1 font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-destructive">
          View authority <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
