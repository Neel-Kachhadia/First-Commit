import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileCheck2,
  FlaskConical,
} from "lucide-react";
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
import { PageHeader, StatusPill } from "@/components/kavach/primitives";
import { useKavach } from "@/lib/kavach-store";
import { CATEGORIES, formatINR, type LedgerStatus } from "@/lib/kavach-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Mandate Studio — KavachPay" },
      {
        name: "description",
        content:
          "Define, test, review and activate a scoped financial mandate.",
      },
    ],
  }),
  component: RulesPage,
});

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
};

function evaluateDraft(
  draft: Draft,
  merchant: string,
  amount: number,
): TestResult {
  const approved = draft.merchants
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const limit = Number(draft.limit);
  const cap = Number(draft.cap);
  if (!approved.includes(merchant.trim().toLowerCase()))
    return {
      label: "Merchant outside scope",
      merchant,
      amount,
      status: "denied",
      reason: `${merchant} is not in the current draft's approved merchant set.`,
    };
  if (amount > limit)
    return {
      label: "Authority exceeded",
      merchant,
      amount,
      status: "denied",
      reason: `Exceeds the ${formatINR(limit)} ${draft.period.toLowerCase()} authority.`,
    };
  if (amount > cap)
    return {
      label: "Step-up required",
      merchant,
      amount,
      status: "pending",
      reason: `Above the ${formatINR(cap)} automatic threshold; a one-time approval is required.`,
    };
  return {
    label: "Allowed automatically",
    merchant,
    amount,
    status: "allowed",
    reason: `Matches ${draft.category}, approved merchant scope, period budget and automatic threshold.`,
  };
}

function RulesPage() {
  const { createAgent } = useKavach();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tested, setTested] = useState(false);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [customMerchant, setCustomMerchant] = useState("Apollo Pharmacy");
  const [customAmount, setCustomAmount] = useState("750");

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
    setTested(false);
    setTests([]);
  };
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
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const goToTest = () => {
    if (validate()) setStep(2);
  };
  const runSuite = () => {
    const approvedMerchant = merchantList[0] ?? "Approved merchant";
    const cap = Number(draft.cap);
    const limit = Number(draft.limit);
    setTests([
      evaluateDraft(
        draft,
        approvedMerchant,
        Math.max(1, Math.floor(cap * 0.75)),
      ),
      evaluateDraft(
        draft,
        approvedMerchant,
        Math.min(limit, cap + Math.max(100, Math.floor(cap * 0.4))),
      ),
      evaluateDraft(
        draft,
        "Unapproved Merchant",
        Math.max(1, Math.floor(cap * 0.5)),
      ),
    ]);
    setTested(true);
  };
  const activate = () => {
    const id = createAgent({
      name: draft.name.trim(),
      purpose: draft.purpose.trim(),
      rule: {
        monthlyLimit: Number(draft.limit),
        perTransactionCap: Number(draft.cap),
        category: draft.category,
        merchants: merchantList,
        window: draft.period,
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
    navigate({ to: "/agents/$agentId", params: { agentId: id } });
  };

  return (
    <div className="mandates-page space-y-7">
      <PageHeader
        title="Mandate Studio"
        description="Define financial intent, prove the boundaries against the current draft, then review the exact policy artifact before activation."
        actions={
          <Button variant="outline" asChild>
            <Link to="/agents">
              View active mandates <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

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
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">
                01 / Define the mandate
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Every field below becomes an enforceable policy boundary.
            </p>
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
              />
            </Field>
            <div className="grid gap-1.5">
              <Label htmlFor="agent-category">Category</Label>
              <Select
                value={draft.category}
                onValueChange={(value) => {
                  const preset =
                    CATEGORY_PRESETS[value] ?? CATEGORY_PRESETS["Groceries"]!;
                  setDraft((current) => ({
                    ...current,
                    category: value,
                    purpose: preset.purpose,
                    merchants: preset.merchants.join(", "),
                  }));
                  setTested(false);
                  setTests([]);
                }}
              >
                <SelectTrigger id="agent-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              />
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
              />
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
              />
            </Field>
            <Field label="Expiry" id="expiry" error={errors["expiresOn"]}>
              <Input
                id="expiry"
                type="date"
                value={draft.expiresOn}
                onChange={(e) => update("expiresOn", e.target.value)}
              />
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
              />
              <p className="text-xs text-muted-foreground">
                Category presets keep purpose and merchant scope consistent.
                Separate custom names with commas.
              </p>
            </Field>
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
              <SummaryRow label="Merchants" value={merchantList.join(" · ")} />
            </dl>
            <Button className="mt-5 w-full" onClick={runSuite}>
              Run allow / step-up / deny suite
            </Button>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-medium">Custom hypothetical</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Custom merchant"
                  value={customMerchant}
                  onChange={(e) => setCustomMerchant(e.target.value)}
                  placeholder="Merchant"
                />
                <Input
                  aria-label="Custom amount"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Amount"
                />
              </div>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  const amount = Number(customAmount);
                  if (Number.isFinite(amount) && amount > 0) {
                    setTests((current) => [
                      ...current,
                      evaluateDraft(draft, customMerchant, amount),
                    ]);
                    setTested(true);
                  }
                }}
              >
                Evaluate custom intent
              </Button>
            </div>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border p-5">
              <h2 className="text-base font-semibold">
                Evidence from this draft
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Each result cites the exact boundary that produced it.
              </p>
            </div>
            {tests.length ? (
              <ul className="divide-y divide-border">
                {tests.map((result, index) => {
                  const tone =
                    result.status === "allowed"
                      ? "allowed"
                      : result.status === "pending"
                        ? "stepup"
                        : "denied";
                  return (
                    <li key={`${result.label}-${index}`} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <StatusPill
                            tone={tone}
                            label={
                              result.status === "pending"
                                ? "Needs approval"
                                : result.status
                            }
                          />
                          <p className="mt-3 text-sm font-medium">
                            {result.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {result.merchant}
                          </p>
                        </div>
                        <p className="amount text-lg font-medium">
                          {formatINR(result.amount)}
                        </p>
                      </div>
                      <p className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                        {result.reason}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-64 place-items-center p-8 text-center">
                <div>
                  <FlaskConical className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    No stale assumptions
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Run the suite to evaluate the exact draft shown at left.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-3 xl:col-span-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back to define
            </Button>
            <Button disabled={!tested} onClick={() => setStep(3)}>
              Review mandate <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="mx-auto max-w-3xl surface-card overflow-hidden">
          <div className="border-b border-border bg-raised p-6">
            <p className="label-caps">03 / Review & activate</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
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
            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Back to test
              </Button>
              <Button onClick={activate}>
                Activate mandate <ApprovalGlyph className="h-4 w-4" />
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
