"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  Copy,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProfile, profileInitials } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PersonaChip({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  const initials = profileInitials(name);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all cursor-pointer",
        active
          ? "border-primary/40 bg-primary/8 text-foreground font-medium"
          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold",
          active ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {initials}
      </span>
      {name}
    </button>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
    >
      {copied ? (
        <CheckCircle className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { profile, updateProfile, loadPersona, regenerateUserId } = useUserProfile();

  // Local draft state — only committed on "Save".
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");

  // Keep draft in sync when persona switch is applied externally.
  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone ?? "");
  }, [profile.name, profile.email, profile.phone]);

  const handleSave = useCallback(() => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    });
    toast.success("Profile updated", {
      description: `Welcome, ${name.trim()}.`,
    });
    onOpenChange(false);
  }, [name, email, phone, updateProfile, onOpenChange]);

  const handlePersona = useCallback(
    (persona: "ananya" | "arnav") => {
      loadPersona(persona);
      toast.success(
        persona === "arnav" ? "Switched to Arnav Bhandari" : "Switched to Ananya Iyer",
      );
    },
    [loadPersona],
  );

  const handleRegenerate = useCallback(() => {
    regenerateUserId();
    toast("User ID regenerated");
  }, [regenerateUserId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="edit-profile-dialog"
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto p-0"
      >
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-primary text-sm font-semibold text-primary-foreground">
              {profileInitials(profile.name)}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-snug">
                {profile.name}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {profile.email} · {profile.userId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="mx-6 mt-4 h-8 w-auto gap-1 bg-muted/50">
            <TabsTrigger value="identity" className="text-xs">
              Principal Identity
            </TabsTrigger>
            <TabsTrigger value="authority" className="text-xs">
              Financial Authority
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Principal Identity ─────────────────────────────── */}
          <TabsContent value="identity" className="space-y-5 px-6 pb-6 pt-4">

            {/* Zero-KYC notice */}
            <div className="flex gap-2.5 rounded-md border border-success/25 bg-success/6 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div className="min-w-0 text-xs leading-relaxed">
                <span className="font-semibold text-success">Prototype identity only.</span>{" "}
                KavachPay does not collect Aadhaar, PAN, UPI PIN, card numbers, or any real KYC
                credentials. This is a synthetic hackathon persona.
              </div>
            </div>

            {/* Demo personas */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Demo Personas
              </p>
              <div className="flex flex-wrap gap-2">
                <PersonaChip
                  name="Ananya Iyer"
                  active={profile.name === "Ananya Iyer"}
                  onClick={() => handlePersona("ananya")}
                />
                <PersonaChip
                  name="Arnav Bhandari"
                  active={profile.name === "Arnav Bhandari"}
                  onClick={() => handlePersona("arnav")}
                />
              </div>
            </div>

            <Separator />

            {/* Form fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arnav Bhandari"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="flex items-center gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. arnav@example.com"
                    autoComplete="email"
                    className="pr-24"
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center">
                    <span className="flex items-center gap-1 rounded border border-success/25 bg-success/8 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      <CheckCircle className="h-2.5 w-2.5" />
                      Verified
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Used for email OTP login and authority notifications.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-phone" className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Phone Number{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  autoComplete="tel"
                />
                <p className="text-[11px] text-muted-foreground">
                  Enables phone OTP as an alternative authentication method.
                </p>
              </div>

              {/* User ID — read-only */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Principal User ID
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm text-muted-foreground">
                    {profile.userId}
                    <CopyButton value={profile.userId} label="User ID" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleRegenerate}
                    title="Regenerate User ID"
                    aria-label="Regenerate User ID"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Auto-generated principal identifier. Used internally; not
                  displayed to agents.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 2: Financial Authority ────────────────────────────── */}
          <TabsContent value="authority" className="space-y-5 px-6 pb-6 pt-4">
            <div className="flex gap-2.5 rounded-md border border-stepup/25 bg-stepup/6 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-stepup" />
              <p className="text-xs leading-relaxed">
                <span className="font-semibold text-stepup">
                  Financial authority is separate from your identity.
                </span>{" "}
                Spending mandates, agent budgets, and merchant rules are managed
                under{" "}
                <strong>Agents</strong> and <strong>Authority</strong> in the sidebar.
              </p>
            </div>

            {/* Synthetic settlement account info */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Sandbox Settlement Pool
              </p>
              <dl className="rounded-md border border-border bg-muted/25 p-3 text-xs">
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">Bank</dt>
                  <dd className="font-medium">{profile.syntheticAccount.bankName}</dd>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">Account</dt>
                  <dd className="font-medium font-mono">
                    •••• {profile.syntheticAccount.last4}
                  </dd>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{profile.syntheticAccount.accountType}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-muted-foreground">
                This is a synthetic sandbox account for demo purposes only. No
                real money is moved. No banking credentials are stored.
              </p>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">
              To create or revoke agent authorities, use{" "}
              <span className="font-medium text-foreground">
                Agents → Create Authority
              </span>{" "}
              or{" "}
              <span className="font-medium text-foreground">Authority</span>{" "}
              in the sidebar.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            id="edit-profile-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            id="edit-profile-save"
          >
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
