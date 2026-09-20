"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarIcon,
  Check,
  ChevronDown,
  FileCheck2,
  FlaskConical,
  Mic,
  MicOff,
  Square,
  AudioLines,
  LoaderCircle,
  RotateCcw,
  CircleAlert,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ApprovalGlyph, MandateGlyph } from "@/components/kavach/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PageHeader } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { CATEGORIES, formatINR, type LedgerStatus } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";
import { useVoiceFill } from "@/hooks/use-voice-fill";
import type { MandateExtraction } from "@/lib/api-client";
import voiceStyles from "./rules-voice.module.css";

// ─── AI-filled field highlight classes ───────────────────────────────────────

const AI_RING =
  "ring-2 ring-primary/40 ring-offset-1 bg-primary/5 transition-shadow";
const UNRESOLVED_RING =
  "ring-2 ring-amber-400/60 ring-offset-1 transition-shadow";

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

function normalizeDateToIso(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Check YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, "0");
    const dd = isoMatch[3].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, "0");
    const mm = dmyMatch[2].padStart(2, "0");
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // Check "21 September 2028" or "21st Sep 2028"
  const wordMatch1 = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (wordMatch1) {
    const dd = wordMatch1[1].padStart(2, "0");
    const mm = MONTH_MAP[wordMatch1[2].toLowerCase()];
    const yyyy = wordMatch1[3];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }
  // Check "September 21, 2028" or "Sep 21 2028"
  const wordMatch2 = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (wordMatch2) {
    const mm = MONTH_MAP[wordMatch2[1].toLowerCase()];
    const dd = wordMatch2[2].padStart(2, "0");
    const yyyy = wordMatch2[3];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }
  // Fallback: parse date string
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    try {
      return format(d, "yyyy-MM-dd");
    } catch {
      return null;
    }
  }
  return null;
}

function aiClass(
  fieldKey: string,
  aiFilled: Record<string, boolean>,
  unresolvedFields: string[]
): string {
  if (aiFilled[fieldKey]) return AI_RING;
  if (
    unresolvedFields.includes(fieldKey) ||
    (fieldKey === "expiresOn" && (unresolvedFields.includes("expiresAt") || unresolvedFields.includes("expiresOn"))) ||
    (fieldKey === "cap" && unresolvedFields.includes("perTransactionCap")) ||
    (fieldKey === "limit" && unresolvedFields.includes("monthlyLimit")) ||
    (fieldKey === "merchants" && unresolvedFields.includes("approvedMerchants"))
  ) {
    return UNRESOLVED_RING;
  }
  return "";
}

// ─── Mic button component ─────────────────────────────────────────────────────

function MicButton({
  state,
  onStart,
  onStop,
}: {
  state: ReturnType<typeof useVoiceFill>["state"];
  onStart: () => void;
  onStop: () => void;
}) {
  const recording = state === "recording";
  const processing = state === "requesting" || state === "transcribing" || state === "extracting";
  return (
    <button
      type="button"
      onClick={recording ? onStop : onStart}
      disabled={processing}
      aria-label={recording ? "Stop recording mandate" : processing ? "Processing voice mandate" : "Speak mandate"}
      className={voiceStyles.trigger}
      data-state={recording ? "recording" : processing ? "processing" : "ready"}
    >
      <span className={voiceStyles.triggerIcon} aria-hidden="true">
        {recording ? <Square size={13} fill="currentColor" /> : processing ? <LoaderCircle size={18} className={voiceStyles.spin} /> : <Mic size={18} />}
      </span>
      <span className={voiceStyles.triggerCopy}>
        <strong>{recording ? "Stop recording" : processing ? "Working on your voice…" : state === "idle" ? "Speak mandate" : "Speak again"}</strong>
        <small>{recording ? "Microphone is live" : processing ? "Keep this page open" : "Describe the rule aloud"}</small>
      </span>
    </button>
  );
}

// ─── AI-filled badge ──────────────────────────────────────────────────────────

function AiFilledBadge() {
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary/80">
      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Suggested by voice — verify before confirming
    </span>
  );
}

function UnresolvedBadge({ fieldLabel }: { fieldLabel: string }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-stepup">
      <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Unclear from voice — please enter{" "}
      {fieldLabel} manually
    </span>
  );
}

const CATEGORY_PRESETS: Record<
  string,
  { purpose: string; merchants: string[] }
> = {
  Groceries: {
    purpose: "Weekly household restocking from approved grocery merchants.",
    merchants: ["Blinkit", "BigBasket", "Zepto"],
  },
  "Pharmacy / Healthcare": {
    purpose: "Prescription refills from approved pharmacies.",
    merchants: ["Apollo Pharmacy", "Tata 1mg", "PharmEasy"],
  },
  Travel: {
    purpose: "Domestic flights and hotels inside the approved travel scope.",
    merchants: ["MakeMyTrip", "IRCTC", "Indigo"],
  },
  "Retail & apparel": {
    purpose: "Approved household and apparel replenishment.",
    merchants: ["Amazon", "Myntra", "Ajio"],
  },
  "Food delivery": {
    purpose: "Meal orders from approved delivery providers.",
    merchants: ["Swiggy", "Zomato"],
  },
  Utilities: {
    purpose: "Recurring household utility payments.",
    merchants: ["BESCOM", "Airtel", "Jio"],
  },
};

type Draft = {
  name: string;
  purpose: string;
  category: string;
  period: string;
  limit: string;
  cap: string;
  merchants: string;
  expiresOn: string;
  allowDelegation: boolean;
  delegationDepth: string;
  blockedCategories: string[];
  blockedItems: string;
};
type TestResult = {
  label: string;
  amount: number;
  merchant: string;
  status: LedgerStatus;
  reason: string;
};

const initialDraft: Draft = {
  name: "Pharmacy Agent",
  purpose: CATEGORY_PRESETS["Pharmacy / Healthcare"]!.purpose,
  category: "Pharmacy / Healthcare",
  period: "Calendar month",
  limit: "3000",
  cap: "1000",
  merchants: CATEGORY_PRESETS["Pharmacy / Healthcare"]!.merchants.join(", "),
  expiresOn: "2026-09-30",
  allowDelegation: false,
  delegationDepth: "0",
  blockedCategories: [],
  blockedItems: "",
};

function evaluateDraft(
  draft: Draft,
  merchant: string,
  amount: number,
  itemName?: string,
): TestResult {
  const approved = draft.merchants
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const limit = Number(draft.limit);
  const cap = Number(draft.cap);

  // Prohibited item / category check
  if (itemName && itemName.trim()) {
    const lowerItem = itemName.trim().toLowerCase();
    const blockedItemsList = draft.blockedItems
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const matchesItem = blockedItemsList.some((blocked) => lowerItem.includes(blocked));
    const matchesCategory = draft.blockedCategories.some((cat) => {
      if (cat === "ALCOHOL" && /alcohol|beer|wine|vodka|whiskey|liquor/i.test(lowerItem)) return true;
      if (cat === "TOBACCO" && /tobacco|cigarette|vape|cigar/i.test(lowerItem)) return true;
      if (cat === "GAMBLING" && /lottery|bet|casino|gambl/i.test(lowerItem)) return true;
      return false;
    });

    if (matchesItem || matchesCategory) {
      return {
        label: "Prohibited item blocked",
        merchant,
        amount,
        status: "DENIED",
        reason: `Item "${itemName}" is prohibited by mandate policy (${matchesCategory ? "restricted category" : "explicitly blocked item"}). Payment provider not invoked.`,
      };
    }
  }

  if (!approved.includes(merchant.trim().toLowerCase()))
    return {
      label: "Merchant outside scope",
      merchant,
      amount,
      status: "DENIED",
      reason: `${merchant} is not in the current draft's approved merchant set.`,
    };
  if (amount > limit)
    return {
      label: "Authority exceeded",
      merchant,
      amount,
      status: "DENIED",
      reason: `Exceeds the ${formatINR(limit)} ${draft.period.toLowerCase()} authority.`,
    };
  if (amount > cap)
    return {
      label: "Step-up required",
      merchant,
      amount,
      status: "PENDING",
      reason: `Above the ${formatINR(cap)} automatic threshold; a one-time approval is required.`,
    };
  return {
    label: "Allowed automatically",
    merchant,
    amount,
    status: "APPROVED",
    reason: `Matches ${draft.category}, approved merchant scope, period budget and automatic threshold.`,
  };
}

export default function RulesPage() {
  const { createAgent, getAgent, remainingFor } = useKavach();
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentGrantId = searchParams.get("parentGrantId") ?? undefined;
  const parentAgent = parentGrantId ? getAgent(parentGrantId) : undefined;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tested, setTested] = useState(false);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [customMerchant, setCustomMerchant] = useState("Apollo Pharmacy");
  const [customAmount, setCustomAmount] = useState("750");
  const [customItem, setCustomItem] = useState("");
  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  // ── AI-filled tracking ─────────────────────────────────────────────────────
  const [aiFilled, setAiFilled] = useState<Record<string, boolean>>({});

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    return draft.expiresOn && isValid(parseISO(draft.expiresOn))
      ? parseISO(draft.expiresOn)
      : new Date();
  });

  useEffect(() => {
    if (draft.expiresOn && isValid(parseISO(draft.expiresOn))) {
      setCalendarMonth(parseISO(draft.expiresOn));
    }
  }, [draft.expiresOn]);

  const markAiFilled = useCallback((field: string) => {
    setAiFilled((prev) => ({ ...prev, [field]: true }));
  }, []);

  const clearAiFilled = useCallback((field: string) => {
    setAiFilled((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const merchantList = useMemo(
    () =>
      draft.merchants
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [draft.merchants],
  );

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    clearAiFilled(key as string);
    setTested(false);
    setTests([]);
  };

  // ── Voice fill integration ──────────────────────────────────────────────────
  const handleExtracted = useCallback(
    (diff: MandateExtraction) => {
      setDraft((current) => {
        const next = { ...current };
        if (diff.agentName) {
          next.name = diff.agentName;
          markAiFilled("name");
        }
        if (diff.category) {
          const needle = diff.category.toLowerCase();
          // Pass 1: exact case-insensitive match
          let matched = CATEGORIES.find((c) => c.toLowerCase() === needle);
          // Pass 2: one contains the other (handles "Pharmacy" → "Pharmacy / Healthcare")
          if (!matched) {
            matched = CATEGORIES.find(
              (c) => c.toLowerCase().includes(needle) || needle.includes(c.toLowerCase())
            );
          }
          // Pass 3: any word in the needle matches a word in the category
          if (!matched) {
            const needleWords = needle.split(/[\s/&,]+/).filter(Boolean);
            matched = CATEGORIES.find((c) => {
              const catWords = c.toLowerCase().split(/[\s/&,]+/).filter(Boolean);
              return needleWords.some((w) => catWords.includes(w));
            });
          }
          if (matched) {
            next.category = matched;
            markAiFilled("category");
          }
        }
        if (diff.purpose) {
          next.purpose = diff.purpose;
          markAiFilled("purpose");
        }
        if (diff.monthlyLimit != null) {
          next.limit = String(diff.monthlyLimit);
          markAiFilled("limit");
        }
        if (diff.perTransactionCap != null) {
          next.cap = String(diff.perTransactionCap);
          markAiFilled("cap");
        }
        if (diff.approvedMerchants != null && diff.approvedMerchants.length > 0) {
          next.merchants = diff.approvedMerchants.join(", ");
          markAiFilled("merchants");
        }
        if (diff.blockedCategories && diff.blockedCategories.length > 0) {
          next.blockedCategories = Array.from(new Set([...next.blockedCategories, ...diff.blockedCategories]));
          markAiFilled("blockedCategories");
        }
        if (diff.blockedItems && diff.blockedItems.length > 0) {
          const combined = [
            ...next.blockedItems.split(",").map((s) => s.trim()).filter(Boolean),
            ...diff.blockedItems,
          ];
          next.blockedItems = Array.from(new Set(combined)).join(", ");
          markAiFilled("blockedItems");
        }
        // Apply voice-extracted expiry date to the date picker field.
        // The NLU returns an ISO string like "2028-09-21". We normalize and
        // store as "yyyy-MM-dd" which parseISO / format in the picker expect.
        if (diff.expiresAt) {
          const normalized = normalizeDateToIso(diff.expiresAt);
          if (normalized) {
            next.expiresOn = normalized;
            markAiFilled("expiresOn");
          }
        }
        return next;
      });

      const filledCount = [
        diff.agentName,
        diff.category,
        diff.purpose,
        diff.monthlyLimit,
        diff.perTransactionCap,
        diff.approvedMerchants?.length,
        diff.blockedCategories?.length,
        diff.blockedItems?.length,
        diff.expiresAt,
      ].filter(Boolean).length;

      if (filledCount > 0) {
        toast.success(`Voice filled ${filledCount} field${filledCount > 1 ? "s" : ""}`, {
          description: diff.unresolvedFields.length
            ? `Couldn't resolve: ${diff.unresolvedFields.join(", ")} — please fill manually.`
            : "Review highlighted fields before continuing to test.",
        });
      } else {
        toast.warning("No fields extracted", {
          description:
            diff.ambiguities ??
            "Try speaking more clearly, e.g. 'Pharmacy agent, 3000 rupees monthly, 800 per transaction, Apollo and Tata 1mg'.",
        });
      }
    },
    [markAiFilled]
  );

  const voice = useVoiceFill({
    currentFormState: {
      ...(draft.name && { agentName: draft.name }),
      ...(draft.category && { category: draft.category }),
      ...(draft.purpose && { purpose: draft.purpose }),
      ...(draft.limit && { monthlyLimit: Number(draft.limit) }),
      ...(draft.cap && { perTransactionCap: Number(draft.cap) }),
      ...(draft.merchants && {
        approvedMerchants: draft.merchants.split(",").map((s) => s.trim()).filter(Boolean),
      }),
      ...(draft.blockedCategories.length > 0 && { blockedCategories: draft.blockedCategories }),
      ...(draft.blockedItems && {
        blockedItems: draft.blockedItems.split(",").map((s) => s.trim()).filter(Boolean),
      }),
      ...(draft.expiresOn && { expiresAt: draft.expiresOn }),
    },
    onExtracted: handleExtracted,
  });

  useEffect(() => {
    if (voice.state === "pending_review") transcriptRef.current?.focus();
  }, [voice.state]);

  const validate = () => {
    const next: Record<string, string> = {};
    const limit = Number(draft.limit);
    const cap = Number(draft.cap);
    if (draft.name.trim().length < 3) next["name"] = "Enter an agent name.";
    if (draft.purpose.trim().length < 10)
      next["purpose"] = "Describe the intended purpose.";
    if (!Number.isFinite(limit) || limit <= 0)
      next["limit"] = "Enter a valid period authority.";
    if (!Number.isFinite(cap) || cap <= 0 || cap > limit)
      next["cap"] = "Threshold must be positive and no higher than authority.";
    if (merchantList.length === 0)
      next["merchants"] = "Add at least one approved merchant.";
    if (!draft.expiresOn) next["expiresOn"] = "Choose an expiry date.";
    if (parentAgent && limit > remainingFor(parentAgent)) {
      next["limit"] = `Child authority cannot exceed the parent's available authority of ${formatINR(remainingFor(parentAgent))}.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const goToTest = () => {
    if (voice.isRecording || voice.isProcessing) {
      toast.info("Finish the voice step before testing this mandate.");
      return;
    }
    if (validate()) setStep(2);
  };
  const runSuite = () => {
    const approvedMerchant = merchantList[0] ?? "Approved merchant";
    const cap = Number(draft.cap);
    const limit = Number(draft.limit);
    const suite: TestResult[] = [
      evaluateDraft(draft, approvedMerchant, Math.max(100, Math.floor(cap / 2))),
      evaluateDraft(draft, approvedMerchant, cap + 1),
      evaluateDraft(draft, "Rogue Merchant Unknown", 500),
      evaluateDraft(draft, approvedMerchant, limit + 1),
    ];
    if (draft.blockedCategories.length > 0 || draft.blockedItems.trim().length > 0) {
      const prohibitedTestItem = draft.blockedCategories.includes("ALCOHOL")
        ? "Alcohol / Wine"
        : draft.blockedCategories.includes("TOBACCO")
        ? "Tobacco"
        : draft.blockedItems.split(",")[0]?.trim() || "Prohibited Item";
      suite.push(evaluateDraft(draft, approvedMerchant, 250, prohibitedTestItem));
    }
    setTests(suite);
    setTested(true);
  };
  const runCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(customAmount);
    if (!customMerchant.trim() || !Number.isFinite(amount) || amount <= 0)
      return;
    const item = evaluateDraft(draft, customMerchant.trim(), amount, customItem);
    setTests((current) => [item, ...current]);
    setTested(true);
  };
  const [activating, setActivating] = useState(false);
  const activate = async () => {
    setActivating(true);
    try {
      const id = await createAgent({
        name: draft.name.trim(),
        purpose: draft.purpose.trim(),
        parentGrantId,
        rule: {
          monthlyLimit: Number(draft.limit),
          perTransactionCap: Number(draft.cap),
          category: draft.category,
          merchants: merchantList,
          window: draft.period.toLowerCase().includes("week") ? "WEEKLY" : "MONTHLY",
          blockedCategories: draft.blockedCategories,
          blockedItems: draft.blockedItems
            ? draft.blockedItems.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          expiresOn: draft.expiresOn,
          allowDelegation: draft.allowDelegation,
          delegationDepth: draft.allowDelegation
            ? Number(draft.delegationDepth)
            : 0,
        },
      });
      toast.success("Mandate activated", {
        description: `${draft.name} now holds ${formatINR(Number(draft.limit))} per ${draft.period.toLowerCase()}.`,
      });
      router.push(`/agents/${id}`);
    } catch (err) {
      toast.error("Failed to activate mandate", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="mandates-page space-y-7">
      {parentAgent ? (
        <div className="surface-card p-5 border-l-4 border-l-primary">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CREATE CHILD MANDATE</h3>
          <p className="text-xs text-muted-foreground mt-3 mb-1">Derived from</p>
          <p className="text-lg font-medium">{parentAgent.name}</p>
          <p className="text-sm mt-1">Available authority: {formatINR(remainingFor(parentAgent))}</p>
          <p className="text-xs text-muted-foreground mt-3">This mandate must derive its authority from the parent mandate.</p>
        </div>
      ) : (
        <PageHeader
          title="Mandate Studio"
          description="Define financial intent, prove the boundaries against the current draft, then review the exact policy artifact before activation."
          actions={
            <Button variant="outline" asChild>
              <Link href="/agents">
                View active mandates <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      )}

      <ol className="mandate-rail mandate-stepper grid overflow-hidden border-y border-border sm:grid-cols-3 sm:gap-px">
        {[
          { n: 1, title: "Define", detail: "Scope financial intent" },
          { n: 2, title: "Test", detail: "Evaluate this draft" },
          { n: 3, title: "Review & activate", detail: "Confirm exact policy" },
        ].map((item) => (
          <li
            key={item.n}
            className={cn(
              "border-b border-border bg-card p-4 last:border-b-0 sm:border-b-0",
              step === item.n && "bg-raised",
              step > item.n && "text-success",
            )}
            aria-current={step === item.n ? "step" : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full border border-border font-mono text-[10px]",
                  step === item.n &&
                    "border-foreground bg-foreground text-background",
                )}
              >
                {step > item.n ? <Check className="h-3 w-3" /> : `0${item.n}`}
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.06em]">
                {item.title}
              </p>
            </div>
            <p className="mt-2 pl-8 text-xs text-muted-foreground">
              {item.detail}
            </p>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border p-5 sm:p-6">
            <div className={voiceStyles.header}>
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">
                    01 / Define the mandate
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every field below becomes an enforceable policy boundary.
                </p>
                <p className={voiceStyles.voiceInvitation}>Speak a first draft, then inspect every suggested field before activation.</p>
              </div>
              <MicButton
                state={voice.state}
                onStart={voice.startRecording}
                onStop={voice.stopRecording}
              />
            </div>

            {voice.state !== "idle" && (
              <div className={voiceStyles.session} data-state={voice.state}>
                <div className={voiceStyles.sessionHeading}>
                  <span className={voiceStyles.sessionStep}>VOICE / {voice.state === "requesting" ? "MICROPHONE" : voice.state === "recording" ? "CAPTURE" : voice.state === "transcribing" ? "TRANSCRIBE" : voice.state === "extracting" ? "FILL FIELDS" : voice.state === "error" ? "RETRY" : "REVIEW"}</span>
                  <span className={voiceStyles.sessionStatus} role="status" aria-live="polite">
                    {voice.state === "recording" ? "Microphone live" : voice.state === "requesting" ? "Waiting for permission" : voice.state === "transcribing" ? "Transcribing audio" : voice.state === "extracting" ? "Finding policy fields" : voice.state === "done" ? "Suggestions added to draft" : voice.state === "error" ? "Needs attention" : "Transcript ready"}
                  </span>
                </div>

                {voice.state === "recording" && (
                  <div className={voiceStyles.liveStage}>
                    <div className={voiceStyles.blobFrame} aria-hidden="true">
                      <span className={voiceStyles.blobHalo} />
                      <span className={voiceStyles.blob} style={{ "--voice-scale": 1 + voice.level * .3 } as CSSProperties}><AudioLines size={31} /></span>
                    </div>
                    <div className={voiceStyles.liveCopy}>
                      <strong>Listening to your mandate</strong>
                      <p>Say the agent, amount, per-payment threshold and approved merchants. Audio is sent for transcription when you stop.</p>
                      <div className={voiceStyles.liveMeta}><span className={voiceStyles.liveDot} /> Live · {Math.floor(voice.elapsedSeconds / 60).toString().padStart(2, "0")}:{(voice.elapsedSeconds % 60).toString().padStart(2, "0")}</div>
                    </div>
                    <button className={voiceStyles.stopButton} type="button" onClick={voice.stopRecording}><Square size={15} fill="currentColor" aria-hidden="true" /> Stop & transcribe</button>
                  </div>
                )}

                {(voice.state === "requesting" || voice.state === "transcribing") && (
                  <div className={voiceStyles.processingStage} role="status">
                    <LoaderCircle size={30} className={voiceStyles.spin} aria-hidden="true" />
                    <div><strong>{voice.state === "requesting" ? "Allow microphone access" : "Turning speech into text"}</strong><p>{voice.state === "requesting" ? "Your browser may ask for permission." : "Your transcript will appear here for review before any fields change."}</p></div>
                    <div className={voiceStyles.processingLines} aria-hidden="true"><span /><span /></div>
                  </div>
                )}

                {voice.transcript !== null && (
                  <div className={voiceStyles.transcriptPanel}>
                    <div className={voiceStyles.transcriptHeader}>
                      <div><h3>Your words</h3><p>{voice.state === "done" ? "Suggestions were added below. Review the highlighted fields." : "Edit any misheard details before filling the mandate."}</p></div>
                      <span>EDITABLE TRANSCRIPT</span>
                    </div>
                    <label className="sr-only" htmlFor="voice-transcript-editor">Voice transcript</label>
                    <textarea ref={transcriptRef} id="voice-transcript-editor" value={voice.transcript} onChange={(event) => voice.editTranscript(event.target.value)} disabled={voice.state === "extracting"} rows={3} className={voiceStyles.transcriptInput} />
                    {voice.state === "extracting" && <div className={voiceStyles.extracting} role="status"><LoaderCircle size={18} className={voiceStyles.spin} aria-hidden="true" /><span>Identifying category, limits and merchants…</span></div>}
                    {voice.ambiguities && <p className={voiceStyles.ambiguity}><MicOff size={17} aria-hidden="true" />{voice.ambiguities}</p>}
                    <div className={voiceStyles.transcriptActions}>
                      <button id="voice-confirm-extract-btn" type="button" onClick={voice.confirmAndExtract} disabled={voice.isProcessing || !voice.transcript.trim()} className={voiceStyles.applyButton}>
                        {voice.state === "extracting" ? <LoaderCircle size={17} className={voiceStyles.spin} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                        {voice.state === "extracting" ? "Applying suggestions…" : voice.state === "done" ? "Apply edits again" : "Use this to fill fields"}
                      </button>
                      <button type="button" onClick={voice.startRecording} disabled={voice.isProcessing} className={voiceStyles.secondaryButton}><RotateCcw size={16} aria-hidden="true" /> Record again</button>
                    </div>
                  </div>
                )}

                {voice.error && (
                  <div className={voiceStyles.errorPanel} role="alert"><CircleAlert size={19} aria-hidden="true" /><div><strong>Voice step interrupted</strong><p>{voice.error}</p></div>{voice.transcript === null && <button type="button" onClick={voice.startRecording}>Try again</button>}</div>
                )}
              </div>
            )}
          </div>

          <form
            className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              goToTest();
            }}
            noValidate
          >
            <Field label="Agent name" id="agent-name" error={errors["name"]}>
              <Input
                id="agent-name"
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                className={aiClass("name", aiFilled, voice.unresolvedFields)}
              />
              {aiFilled["name"] && <AiFilledBadge />}
              {voice.unresolvedFields.includes("agentName") && (
                <UnresolvedBadge fieldLabel="agent name" />
              )}
            </Field>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={draft.category}
                onValueChange={(value) => {
                  const preset = CATEGORY_PRESETS[value];
                  setDraft((prev) => ({
                    ...prev,
                    category: value,
                    ...(preset && !aiFilled["purpose"] && !prev.purpose
                      ? { purpose: preset.purpose }
                      : {}),
                    ...(preset && !aiFilled["merchants"] && !prev.merchants
                      ? { merchants: preset.merchants.join(", ") }
                      : {}),
                  }));
                  clearAiFilled("category");
                  setTested(false);
                  setTests([]);
                }}
              >
                <SelectTrigger
                  id="category"
                  className={cn(
                    "w-full",
                    aiClass("category", aiFilled, voice.unresolvedFields)
                  )}
                >
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {aiFilled["category"] && <AiFilledBadge />}
              {voice.unresolvedFields.includes("category") && (
                <p className="text-xs text-amber-500">
                  Category unclear — try mentioning it in your mandate (e.g. &ldquo;groceries&rdquo;, &ldquo;pharmacy&rdquo;).
                </p>
              )}
            </div>


            <Field
              label="Purpose"
              id="agent-purpose"
              error={errors["purpose"]}
              className="sm:col-span-2"
            >
              <Textarea
                id="agent-purpose"
                rows={3}
                value={draft.purpose}
                onChange={(e) => update("purpose", e.target.value)}
                className={aiClass("purpose", aiFilled, voice.unresolvedFields)}
              />
              {aiFilled["purpose"] && <AiFilledBadge />}
              {voice.unresolvedFields.includes("purpose") && (
                <UnresolvedBadge fieldLabel="purpose" />
              )}
            </Field>
            <div className="grid gap-1.5">
              <Label htmlFor="period">Budget period</Label>
              <Select
                value={draft.period}
                onValueChange={(value) => update("period", value)}
              >
                <SelectTrigger id="period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Calendar month">Calendar month</SelectItem>
                  <SelectItem value="Calendar week">Calendar week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Period authority (₹)"
              id="limit"
              error={errors["limit"]}
            >
              <Input
                id="limit"
                inputMode="numeric"
                value={draft.limit}
                onChange={(e) => update("limit", e.target.value)}
                className={aiClass("limit", aiFilled, voice.unresolvedFields)}
              />
              {aiFilled["limit"] && <AiFilledBadge />}
              {voice.unresolvedFields.includes("monthlyLimit") && (
                <UnresolvedBadge fieldLabel="period authority" />
              )}
            </Field>
            <Field
              label="Automatic threshold (₹)"
              id="cap"
              error={errors["cap"]}
            >
              <Input
                id="cap"
                inputMode="numeric"
                value={draft.cap}
                onChange={(e) => update("cap", e.target.value)}
                className={aiClass("cap", aiFilled, voice.unresolvedFields)}
              />
              {aiFilled["cap"] && <AiFilledBadge />}
              {voice.unresolvedFields.includes("perTransactionCap") && (
                <UnresolvedBadge fieldLabel="automatic threshold" />
              )}
            </Field>
            <Field label="Expiry" id="expiry" error={errors["expiresOn"]}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    id="expiry"
                    type="button"
                    className={cn(
                      "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "hover:border-ring/60",
                      !draft.expiresOn && "text-muted-foreground",
                      aiClass("expiresOn", aiFilled, voice.unresolvedFields)
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {draft.expiresOn && isValid(parseISO(draft.expiresOn))
                        ? format(parseISO(draft.expiresOn), "dd MMM yyyy")
                        : "Pick a date"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selected={draft.expiresOn && isValid(parseISO(draft.expiresOn)) ? parseISO(draft.expiresOn) : undefined}
                    onSelect={(day) => {
                      update("expiresOn", day ? format(day, "yyyy-MM-dd") : "");
                    }}
                    disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 10}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {aiFilled["expiresOn"] && <AiFilledBadge />}
              {(voice.unresolvedFields.includes("expiresAt") ||
                voice.unresolvedFields.includes("expiresOn")) && (
                <UnresolvedBadge fieldLabel="expiry date" />
              )}
            </Field>
            <Field
              label="Approved merchants"
              id="merchants"
              error={errors["merchants"]}
              className="sm:col-span-2"
            >
              <Input
                id="merchants"
                value={draft.merchants}
                onChange={(e) => update("merchants", e.target.value)}
                className={aiClass("merchants", aiFilled, voice.unresolvedFields)}
              />
              <p className="text-xs text-muted-foreground">
                Category presets keep purpose and merchant scope consistent.
                Separate custom names with commas.
              </p>
              {aiFilled["merchants"] && <AiFilledBadge />}
              {voice.unresolvedFields.includes("approvedMerchants") && (
                <UnresolvedBadge fieldLabel="approved merchants" />
              )}
            </Field>

            <div className="sm:col-span-2 space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-lg font-semibold">Purchases to block</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Select categories or add specific items. Matching payments are denied before the payment provider is contacted.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Restricted categories</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "ALCOHOL", label: "Alcohol & Liquor" },
                    { id: "TOBACCO", label: "Tobacco & Vapes" },
                    { id: "GAMBLING", label: "Gambling & Lottery" },
                  ].map((cat) => {
                    const isSelected = draft.blockedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          update(
                            "blockedCategories",
                            isSelected
                              ? draft.blockedCategories.filter((c) => c !== cat.id)
                              : [...draft.blockedCategories, cat.id]
                          );
                        }}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-muted"
                        )}
                      >
                        {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="blocked-items" className="text-sm font-semibold">
                  Specific items
                </Label>
                <Input
                  id="blocked-items"
                  placeholder="e.g. Gift cards, lottery tickets"
                  value={draft.blockedItems}
                  onChange={(e) => update("blockedItems", e.target.value)}
                  className={aiClass("blockedItems", aiFilled, voice.unresolvedFields)}
                />
                <p className="text-sm text-muted-foreground">
                  Separate names with commas. The match ignores capitalization.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4 sm:col-span-2">
              <div>
                <Label htmlFor="delegation">Allow child delegation</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permit this agent to derive narrower authority.
                </p>
              </div>
              <Switch
                id="delegation"
                checked={draft.allowDelegation}
                onCheckedChange={(value) => update("allowDelegation", value)}
              />
            </div>
            {draft.allowDelegation ? (
              <Field
                label="Maximum delegation depth"
                id="depth"
                className="sm:col-span-2"
              >
                <Input
                  id="depth"
                  inputMode="numeric"
                  min="1"
                  max="3"
                  value={draft.delegationDepth}
                  onChange={(e) => update("delegationDepth", e.target.value)}
                />
              </Field>
            ) : null}
            <div className="flex justify-end border-t border-border pt-5 sm:col-span-2">
              <Button type="submit">
                Continue to test <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
          <div className="surface-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-stepup" />
              <h2 className="text-base font-semibold">
                02 / Test current draft
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Tests are isolated; no live transaction or budget state is
              changed.
            </p>
            <dl className="mt-5 space-y-3 rounded-md border border-border bg-muted/25 p-4 text-xs">
              <SummaryRow label="Agent" value={draft.name} />
              <SummaryRow label="Scope" value={draft.category} />
              <SummaryRow
                label="Authority"
                value={`${formatINR(Number(draft.limit))} / ${draft.period.toLowerCase()}`}
              />
              <SummaryRow
                label="Threshold"
                value={formatINR(Number(draft.cap))}
              />
              <SummaryRow label="Approved" value={merchantList.join(", ")} />
              <SummaryRow
                label="Prohibited"
                value={
                  [
                    ...draft.blockedCategories.map((c) => `Category: ${c}`),
                    ...(draft.blockedItems
                      ? draft.blockedItems.split(",").map((s) => s.trim()).filter(Boolean).map((i) => `Item: ${i}`)
                      : []),
                  ].join(" · ") || "None"
                }
              />
            </dl>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button onClick={runSuite}>Run standard test suite</Button>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Edit draft
              </Button>
            </div>
          </div>
          <div className="surface-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold">Custom scenario</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Simulate any arbitrary transaction against this draft.
            </p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_.8fr_auto]"
              onSubmit={runCustom}
            >
              <Input
                placeholder="Merchant"
                value={customMerchant}
                onChange={(e) => setCustomMerchant(e.target.value)}
              />
              <Input
                placeholder="Item (e.g. Alcohol / Notebooks)"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
              />
              <Input
                placeholder="Amount (₹)"
                inputMode="numeric"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
              <Button type="submit" variant="outline">
                Run test
              </Button>
            </form>
            <div className="mt-5 space-y-2">
              {tests.map((test, index) => (
                <div
                  key={`${test.merchant}-${test.amount}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <span>{test.merchant}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{formatINR(test.amount)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{test.reason}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]",
                      test.status === "APPROVED" &&
                        "border border-success/30 bg-success/10 text-success",
                      test.status === "PENDING" &&
                        "border border-stepup/30 bg-stepup/10 text-stepup",
                      test.status === "DENIED" &&
                        "border border-destructive/30 bg-destructive/10 text-destructive",
                    )}
                  >
                    {test.label}
                  </span>
                </div>
              ))}
              {tests.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  Run the standard suite or evaluate a custom transaction to
                  verify this draft.
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end border-t border-border pt-5">
              <Button disabled={!tested} onClick={() => setStep(3)}>
                Proceed to review <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">
                03 / Review policy contract
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Verify the exact financial mandate before minting live authority.
            </p>
          </div>
          <div className="border-b border-border bg-muted/20 p-6">
            <p className="label-caps">Agent identity</p>
            <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight">
              {draft.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {draft.purpose}
            </p>
          </div>
          <div className="p-6">
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              <ReviewItem
                label="Period authority"
                value={`${formatINR(Number(draft.limit))} / ${draft.period.toLowerCase()}`}
              />
              <ReviewItem
                label="Automatic threshold"
                value={formatINR(Number(draft.cap))}
              />
              <ReviewItem label="Scope" value={draft.category} />
              <ReviewItem
                label="Expires"
                value={new Date(
                  `${draft.expiresOn}T00:00:00`,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              />
              <ReviewItem
                label="Approved merchants"
                value={merchantList.join(" · ")}
              />
              <ReviewItem
                label="Prohibited restrictions"
                value={
                  [
                    ...draft.blockedCategories.map((c) => `Category: ${c}`),
                    ...(draft.blockedItems
                      ? draft.blockedItems.split(",").map((s) => s.trim()).filter(Boolean).map((i) => `Item: ${i}`)
                      : []),
                  ].join(" · ") || "None specified"
                }
              />
              <ReviewItem
                label="Delegation"
                value={
                  draft.allowDelegation
                    ? `Allowed · depth ${draft.delegationDepth}`
                    : "Not allowed"
                }
              />
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-md border border-success/20 bg-success/8 p-4">
              <MandateGlyph className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                The test suite passed against this exact policy version.
                Activation creates live authority; it does not retroactively
                approve any payment.
              </p>
            </div>
            
            {parentAgent && (
              <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
                <p className="label-caps mb-3">Authority Derivation</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Parent remaining ({parentAgent.name})</span>
                    <span>{formatINR(remainingFor(parentAgent))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Child requested</span>
                    <span>{formatINR(Number(draft.limit))}</span>
                  </div>
                  <div className="my-2 border-t border-border border-dashed"></div>
                  <div className="flex justify-between font-medium">
                    <span>Effective authority</span>
                    <span className={Number(draft.limit) > remainingFor(parentAgent) ? "text-destructive" : ""}>
                      {formatINR(Math.min(Number(draft.limit), remainingFor(parentAgent)))}
                    </span>
                  </div>
                  {Number(draft.limit) > remainingFor(parentAgent) && (
                    <p className="text-xs text-destructive mt-1">
                      ✕ Child authority exceeds parent authority. Please reduce the limit before activating.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Back to test
              </Button>
              <Button onClick={activate} disabled={activating || (!!parentAgent && Number(draft.limit) > remainingFor(parentAgent))}>
                {activating ? "Activating…" : "Activate mandate"} <ApprovalGlyph className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  error,
  className,
  children,
}: {
  label: string;
  id: string;
  error?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] text-right font-medium">{value}</dd>
    </div>
  );
}
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
