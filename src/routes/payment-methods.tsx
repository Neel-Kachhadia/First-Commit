"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePaymentProfiles,
  useCreatePaymentProfile,
  useDisablePaymentProfile,
} from "@/lib/payment-profiles";
import type { PaymentProfile } from "@/lib/api-client";
import { PageHeader } from "@/components/kavach/primitives";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

// ── Mandate count helper ───────────────────────────────────────────────────────

/**
 * Returns the number of ROOT grants directly bound to this profile.
 * Child grants (parentGrantId set) inherit the profile through the authority chain
 * and are NOT counted here.
 */
function useMandateCountForProfile(paymentProfileId: string): number {
  const { data: grantsData } = useQuery({
    queryKey: ["grants"],
    queryFn: () => apiClient.getGrants(),
    staleTime: 30_000,
    retry: 1,
  });

  if (!grantsData?.grants) return 0;

  return (grantsData.grants as Array<{ paymentProfileId?: string; parentGrantId?: string }>).filter(
    (g) => !g.parentGrantId && g.paymentProfileId === paymentProfileId
  ).length;
}

// ── Simulated test disclosure ─────────────────────────────────────────────────

function SimulatedDisclosure() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <p>
        <span className="font-semibold text-foreground">
          Razorpay TEST MODE · ₹0 real funds.
        </span>{" "}
        This prototype uses a simulated test payment profile. No real payment
        credentials are stored or transmitted.
      </p>
    </div>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────

function ProfileCard({
  profile,
  onManage,
}: {
  profile: PaymentProfile;
  onManage: (profile: PaymentProfile) => void;
}) {
  const isActive = profile.status === "ACTIVE";
  const mandateCount = useMandateCountForProfile(profile.paymentProfileId);

  return (
    <div className="surface-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-card">
              <CreditCard className="h-4 w-4 text-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold">{profile.displayName}</p>
              <p className="text-xs text-muted-foreground">Test Payment Profile</p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]",
              isActive
                ? "border border-success/30 bg-success/10 text-success"
                : "border border-border bg-muted/30 text-muted-foreground"
            )}
          >
            {isActive ? "● ACTIVE" : "DISABLED"}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="divide-y divide-border">
        <div className="flex items-center justify-between px-5 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">Provider</p>
          <p className="flex items-center gap-1.5 text-xs font-medium">
            {profile.provider}
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
              TEST MODE
            </span>
          </p>
        </div>
        <div className="flex items-center justify-between px-5 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">Mode</p>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            SIMULATED TEST PROFILE
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">Profile ID</p>
          <p className="font-mono text-[11px] text-foreground">{profile.paymentProfileId}</p>
        </div>
        <div className="flex items-center justify-between px-5 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">Used by</p>
          <p className="text-xs font-medium">
            {mandateCount} {mandateCount === 1 ? "mandate" : "mandates"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border px-5 py-4 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => onManage(profile)}>
          Manage
        </Button>
      </div>
    </div>
  );
}

// ── Connect modal ─────────────────────────────────────────────────────────────

function ConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState("Visa •••• 1111");
  const createMutation = useCreatePaymentProfile();

  const handleConnect = async () => {
    try {
      await createMutation.mutateAsync({
        provider: "RAZORPAY",
        environment: "TEST",
        methodType: "CARD",
        displayName: displayName.trim() || "Visa •••• 1111",
      });
      toast.success("Test payment profile connected", {
        description: "Your simulated Razorpay TEST profile is now active.",
      });
      setDisplayName("Visa •••• 1111");
      onClose();
    } catch (err) {
      toast.error("Failed to connect profile", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Test Payment Method</DialogTitle>
          <DialogDescription className="sr-only">
            Configure a simulated Razorpay TEST payment profile. No real payment
            credentials are collected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider */}
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Provider
              </p>
              <p className="mt-0.5 text-sm font-medium">Razorpay</p>
            </div>
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
              TEST MODE
            </span>
          </div>

          {/* Method */}
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Method
              </p>
              <p className="mt-0.5 text-sm font-medium">Card</p>
            </div>
          </div>

          {/* Display name */}
          <div className="grid gap-1.5">
            <Label htmlFor="connect-display-name">Display name</Label>
            <Input
              id="connect-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Visa •••• 1111"
            />
          </div>

          {/* Simulated notice */}
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
              SIMULATED TEST PROFILE · ₹0 REAL FUNDS
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No real payment credentials are collected or stored. This profile
              is used as an execution context for Razorpay TEST MODE only.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            id="connect-test-profile-submit"
            onClick={handleConnect}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Connect Test Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Manage / Disable dialog ───────────────────────────────────────────────────

function ManageDialog({
  profile,
  onClose,
}: {
  profile: PaymentProfile | null;
  onClose: () => void;
}) {
  const [confirmDisable, setConfirmDisable] = useState(false);
  const disableMutation = useDisablePaymentProfile();

  if (!profile) return null;

  const handleDisable = async () => {
    try {
      await disableMutation.mutateAsync(profile.paymentProfileId);
      toast.success("Payment profile disabled");
      setConfirmDisable(false);
      onClose();
    } catch (err) {
      toast.error("Failed to disable profile", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <>
      <Dialog open={!!profile} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Profile</DialogTitle>
            <DialogDescription className="sr-only">
              Profile {profile.paymentProfileId}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted/30 p-4 text-xs space-y-2.5 py-2">
            {[
              ["Display name", profile.displayName],
              ["Profile ID", profile.paymentProfileId],
              ["Provider", `${profile.provider} · ${profile.environment}`],
              ["Connection", profile.connectionMode],
              ["Status", profile.status],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    "font-mono",
                    label === "Status" && profile.status === "ACTIVE" && "font-semibold text-success",
                    label === "Status" && profile.status === "DISABLED" && "text-muted-foreground",
                    label === "Connection" && "text-primary font-semibold uppercase"
                  )}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {profile.status === "ACTIVE" && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDisable(true)}
              >
                Disable Test Profile
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDisable}
        onOpenChange={(v) => !v && setConfirmDisable(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable this payment profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Disabling{" "}
              <span className="font-mono">{profile.paymentProfileId}</span> will
              prevent it from being selected for new root mandates. Existing
              mandates already bound to this profile retain their reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDisable(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDisable}
              disabled={disableMutation.isPending}
            >
              {disableMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Disable Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaymentMethodsPage() {
  const [connectOpen, setConnectOpen] = useState(false);
  const [managingProfile, setManagingProfile] = useState<PaymentProfile | null>(
    null
  );

  const { data: profiles, isLoading, isError } = usePaymentProfiles();

  return (
    <div className="space-y-7">
      <PageHeader
        title="Payment Methods"
        description="Configure the execution context for root mandates that may reach provider execution."
        actions={
          <Button
            id="connect-payment-method-btn"
            onClick={() => setConnectOpen(true)}
          >
            + Connect Test Payment Method
          </Button>
        }
      />

      <SimulatedDisclosure />

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-[240px] w-full rounded-lg" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load payment profiles. Please refresh the page.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && profiles !== undefined && profiles.length === 0 && (
        <div className="surface-card flex flex-col items-center gap-6 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              No test payment source configured
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
              KavachPay requires an execution context for root mandates that may
              reach provider execution.
            </p>
          </div>
          <Button
            id="connect-first-payment-method-btn"
            onClick={() => setConnectOpen(true)}
          >
            Connect Test Payment Method
          </Button>
        </div>
      )}

      {/* Profile cards */}
      {!isLoading && !isError && profiles && profiles.length > 0 && (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.paymentProfileId}
              profile={profile}
              onManage={setManagingProfile}
            />
          ))}
        </div>
      )}

      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
      />

      <ManageDialog
        profile={managingProfile}
        onClose={() => setManagingProfile(null)}
      />
    </div>
  );
}
