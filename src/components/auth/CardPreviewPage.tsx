"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Check, ShieldAlert, Loader2, Plus, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type PaymentProfile } from "@/lib/api-client";
import {
  usePaymentProfiles,
  useCreatePaymentProfile,
  useDisablePaymentProfile,
} from "@/lib/payment-profiles";
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
import styles from "./CardPreviewPage.module.css";

// ── Mandate count helper ───────────────────────────────────────────────────────
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
      <DialogContent className="sm:max-w-md bg-[#161614] text-[#ebe1c9] border-[#3f3a32]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#f0e7d3]">Connect Test Payment Method</DialogTitle>
          <DialogDescription className="text-xs text-[#a99e8a]">
            Configure a simulated Razorpay TEST payment profile. No real payment credentials are collected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="flex items-center justify-between rounded border border-[#3f3a32] bg-[#1d1d1a] px-4 py-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#a99e8a]">Provider</p>
              <p className="font-semibold text-[#f0e7d3] mt-0.5">Razorpay</p>
            </div>
            <span className="font-mono text-[10px] bg-[#2a2924] text-[#d55448] px-2 py-0.5 rounded border border-[#4a4135]">
              TEST MODE
            </span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="connect-display-name" className="text-xs text-[#c8bca5]">Display name</Label>
            <Input
              id="connect-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Visa •••• 1111"
              className="bg-[#21201c] border-[#4a4135] text-[#f0e7d3]"
            />
          </div>

          <div className="rounded border border-[#a92a24]/40 bg-[#a92a24]/10 p-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#e7665a] mb-1">
              SIMULATED TEST PROFILE · ₹0 REAL FUNDS
            </p>
            <p className="text-[11px] text-[#c8bca5] leading-relaxed">
              No real payment credentials are collected or stored. This profile provides the execution context for Razorpay TEST MODE only.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending} className="border-[#4a4135] text-[#c8bca5]">
            Cancel
          </Button>
          <Button
            id="connect-test-profile-submit"
            onClick={handleConnect}
            disabled={createMutation.isPending}
            className="bg-[#a92a24] hover:bg-[#7f1d19] text-[#fff8e9]"
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        <DialogContent className="sm:max-w-md bg-[#161614] text-[#ebe1c9] border-[#3f3a32]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#f0e7d3]">Manage Payment Profile</DialogTitle>
            <DialogDescription className="font-mono text-xs text-[#a99e8a]">
              {profile.paymentProfileId}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border border-[#3f3a32] bg-[#1d1d1a] p-4 text-xs space-y-2.5 py-2 font-mono">
            {[
              ["Display name", profile.displayName],
              ["Profile ID", profile.paymentProfileId],
              ["Provider", `${profile.provider} · ${profile.environment}`],
              ["Connection", profile.connectionMode],
              ["Status", profile.status],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-[#8c8273]">{label}</span>
                <span
                  className={
                    label === "Status" && profile.status === "ACTIVE"
                      ? "text-emerald-400 font-bold"
                      : label === "Connection"
                      ? "text-[#e7665a]"
                      : "text-[#f0e7d3]"
                  }
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} className="border-[#4a4135] text-[#c8bca5]">
              Close
            </Button>
            {profile.status === "ACTIVE" && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDisable(true)}
                className="bg-[#a92a24] hover:bg-[#7f1d19]"
              >
                Disable Test Profile
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDisable} onOpenChange={(v) => !v && setConfirmDisable(false)}>
        <AlertDialogContent className="bg-[#161614] text-[#ebe1c9] border-[#3f3a32]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#f0e7d3]">Disable this payment profile?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#a99e8a]">
              Disabling <span className="font-mono text-[#e7665a]">{profile.paymentProfileId}</span> will
              prevent it from being selected for new root mandates. Existing mandates already bound to this profile retain their reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDisable(false)} className="border-[#4a4135] text-[#c8bca5]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDisable}
              disabled={disableMutation.isPending}
            >
              {disableMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main CardPreviewPage Component ───────────────────────────────────────────
export function CardPreviewPage() {
  const router = useRouter();
  const [side, setSide] = useState<"front" | "back">("front");
  const [copied, setCopied] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [managingProfile, setManagingProfile] = useState<PaymentProfile | null>(null);

  const { data: profiles, isLoading } = usePaymentProfiles();
  const activeProfile = profiles?.find((p) => p.status === "ACTIVE") || profiles?.[0];
  const mandateCount = useMandateCountForProfile(activeProfile?.paymentProfileId ?? "");

  const copyProfileId = () => {
    if (!activeProfile) return;
    navigator.clipboard.writeText(activeProfile.paymentProfileId);
    setCopied(true);
    toast.success("Profile ID copied to clipboard", {
      description: activeProfile.paymentProfileId,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className={styles.root}>
      <div className={styles.filmEdge} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className={styles.content}>
        <header className={styles.header}>
          <Link href="/dashboard" className={styles.brand}>
            KavachPay
          </Link>
          <Link href="/dashboard" className={styles.signInLink}>
            Go to Command Center ↗
          </Link>
        </header>

        <div className={styles.layout}>
          <section className={styles.intro} aria-labelledby="preview-title">
            <span className={styles.eyebrow}>PAYMENT EXECUTION LAYER</span>
            <h1 id="preview-title">
              Payment, <em>bounded by authority.</em>
            </h1>
            <p>
              Agents receive bounded authority, not payment credentials. Root mandates bind to this simulated Razorpay test profile to execute authorized transactions.
            </p>

            <div className={styles.notice} role="note">
              <strong>Razorpay TEST MODE · ₹0 Real Funds</strong>
              <span>
                Simulated test payment profile. No real payment credentials are charged, transmitted, or stored. Agents never receive this card or payment secrets.
              </span>
            </div>
          </section>

          <section className={styles.workbench} aria-label="Connected Payment Method">
            <div className={styles.specimenTop}>
              <span>CONNECTED PAYMENT PROFILE</span>
              <span>RAZORPAY · TEST MODE</span>
            </div>

            {/* 3D Flippable Card displaying real active test profile */}
            <div className={styles.previewStage}>
              <div className={styles.cardRotator} data-side={side}>
                {/* Front */}
                <div
                  className={`${styles.previewCard} ${styles.front}`}
                  aria-hidden={side === "back"}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardWordmark}>KavachPay</span>
                    <span className={styles.network}>VISA TEST</span>
                  </div>
                  <div className={styles.cardStroke} aria-hidden="true" />
                  <div className={styles.cardNumber}>•••• •••• •••• 1111</div>
                  <div className={styles.cardBottom}>
                    <span>{activeProfile?.displayName || "Visa •••• 1111"}</span>
                    <span>KP</span>
                  </div>
                </div>

                {/* Back */}
                <div
                  className={`${styles.previewCard} ${styles.back}`}
                  aria-hidden={side === "front"}
                >
                  <div className={styles.magneticStrip} />
                  <div className={styles.backContent}>
                    <div>
                      <small>EXPIRES</small>
                      <strong>TEST MODE</strong>
                    </div>
                    <div className={styles.signature}>
                      <small>SECURITY CODE</small>
                      <strong>••• / BOUNDED</strong>
                    </div>
                  </div>
                  <div className={styles.backFooter}>
                    <span>KavachPay</span>
                    <span>AUTHORITY FIRST</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side toggle controls */}
            <div className={styles.sideControls} aria-label="Preview card side">
              <button
                type="button"
                aria-pressed={side === "front"}
                onClick={() => setSide("front")}
              >
                Front
              </button>
              <button
                type="button"
                aria-pressed={side === "back"}
                onClick={() => setSide("back")}
              >
                Back
              </button>
            </div>

            {/* Real Payment Profile Specimen Details (ZERO fake inputs!) */}
            <div className={styles.profileSpecimen}>
              <div className={styles.specimenRow}>
                <span className={styles.specimenLabel}>Profile ID</span>
                <span className={styles.specimenValue}>
                  {isLoading ? (
                    "Loading..."
                  ) : activeProfile ? (
                    <>
                      <span>{activeProfile.paymentProfileId}</span>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={copyProfileId}
                        title="Copy profile ID"
                      >
                        {copied ? <Check className="h-3 w-3 inline" /> : <Copy className="h-3 w-3 inline" />} {copied ? "Copied" : "Copy"}
                      </button>
                    </>
                  ) : (
                    "No profile found"
                  )}
                </span>
              </div>

              <div className={styles.specimenRow}>
                <span className={styles.specimenLabel}>Display Name</span>
                <span className={styles.specimenValue}>
                  {activeProfile?.displayName || "Visa •••• 1111"}
                </span>
              </div>

              <div className={styles.specimenRow}>
                <span className={styles.specimenLabel}>Status</span>
                <span className={styles.specimenValue}>
                  <span
                    className={
                      activeProfile?.status === "ACTIVE"
                        ? styles.statusBadgeActive
                        : styles.statusBadgeDisabled
                    }
                  >
                    ● {activeProfile?.status || "ACTIVE"}
                  </span>
                </span>
              </div>

              <div className={styles.specimenRow}>
                <span className={styles.specimenLabel}>Provider / Mode</span>
                <span className={styles.specimenValue}>
                  <span>Razorpay TEST</span>
                  <span className={styles.modeBadge}>SIMULATED</span>
                </span>
              </div>

              <div className={styles.specimenRow}>
                <span className={styles.specimenLabel}>Real Funds at Risk</span>
                <span className={styles.specimenValue}>₹0 (Simulated Test Mode)</span>
              </div>

              <div className={styles.specimenRow}>
                <span className={styles.specimenLabel}>Root Mandates Bound</span>
                <span className={styles.specimenValue}>
                  {mandateCount} {mandateCount === 1 ? "mandate" : "mandates"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actionGroup}>
              <button
                type="button"
                className={styles.continue}
                onClick={() => router.push("/dashboard")}
              >
                <span>Continue to Command Center</span>
                <span aria-hidden="true">↗</span>
              </button>

              <div className={styles.secondaryActions}>
                {activeProfile && (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setManagingProfile(activeProfile)}
                  >
                    <Settings className="h-3.5 w-3.5 inline mr-1.5" />
                    Manage Profile
                  </button>
                )}
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setConnectOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1.5" />
                  Connect Profile
                </button>
              </div>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <span>SIMULATED TEST PROFILE / ZERO REAL CREDENTIALS</span>
          <span>© KAVACHPAY CONTROL PLANE</span>
        </footer>
      </div>

      {/* Dialogs */}
      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      <ManageDialog
        profile={managingProfile}
        onClose={() => setManagingProfile(null)}
      />
    </main>
  );
}
