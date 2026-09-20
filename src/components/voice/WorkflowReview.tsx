"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Shield, GitBranch, Play, ShoppingCart, CircleAlert, Mic, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/kavach-data";
import type { VoiceWorkflow, VoiceAction, VoiceActionType } from "@/lib/voice-workflow-types";
import { ACTION_LABELS } from "@/lib/voice-workflow-types";
import s from "./voice.module.css";

const FIELD_LABELS: Record<string, string> = {
  monthlyLimit: "Monthly spending limit",
  perTransactionCap: "Auto-approval threshold / cap",
  capacity: "Agent delegation capacity",
  estimatedAmount: "Estimated order amount",
  items: "Order items",
};

// ─── Action icon ──────────────────────────────────────────────────────────────

function ActionIcon({ type }: { type: VoiceActionType }) {
  switch (type) {
    case "CREATE_MANDATE":    return <Shield size={15} />;
    case "CREATE_DELEGATION": return <GitBranch size={15} />;
    case "START_AGENT":       return <Play size={15} />;
    case "CREATE_ORDER":      return <ShoppingCart size={15} />;
  }
}

// ─── Helpers for missing fields ───────────────────────────────────────────────

function getMissingFieldsForAction(action: VoiceAction): string[] {
  const missing: string[] = [];
  const p = action.params;
  if (action.type === "CREATE_MANDATE") {
    if (p.monthlyLimit == null || Number.isNaN(Number(p.monthlyLimit)) || Number(p.monthlyLimit) <= 0) {
      missing.push("monthlyLimit");
    }
    if (p.perTransactionCap == null || Number.isNaN(Number(p.perTransactionCap)) || Number(p.perTransactionCap) <= 0) {
      missing.push("perTransactionCap");
    }
  } else if (action.type === "CREATE_DELEGATION") {
    if (p.capacity == null || Number.isNaN(Number(p.capacity)) || Number(p.capacity) <= 0) {
      missing.push("capacity");
    }
  } else if (action.type === "CREATE_ORDER") {
    if (p.estimatedAmount == null || Number.isNaN(Number(p.estimatedAmount)) || Number(p.estimatedAmount) <= 0) {
      missing.push("estimatedAmount");
    }
  }
  return missing;
}

// ─── Action description builder ───────────────────────────────────────────────

function describeAction(action: VoiceAction): string {
  const p = action.params;
  switch (action.type) {
    case "CREATE_MANDATE": {
      const limit = typeof p.monthlyLimit === "number" && p.monthlyLimit > 0 ? formatINR(p.monthlyLimit) : "Limit not set";
      const cap = typeof p.perTransactionCap === "number" && p.perTransactionCap > 0 ? `${formatINR(p.perTransactionCap)} auto-cap` : "Cap not set";
      const category = String(p.category ?? "General");
      const windowStr = String(p.window ?? "MONTHLY").toLowerCase();
      const merchants = Array.isArray(p.merchants) && p.merchants.length > 0
        ? (p.merchants as string[]).slice(0, 3).join(", ")
        : "all merchants";
      return `${category} · ${limit}/${windowStr} · ${cap} · ${merchants}`;
    }
    case "CREATE_DELEGATION": {
      const capacity = typeof p.capacity === "number" && p.capacity > 0 ? formatINR(p.capacity) : "Capacity not set";
      return `Capacity ${capacity} · Delegated from ${String(p.parentActionId ?? "root")}`;
    }
    case "START_AGENT": {
      return `Activates agent from ${String(p.agentActionId ?? "delegation")}`;
    }
    case "CREATE_ORDER": {
      const amount = typeof p.estimatedAmount === "number" && p.estimatedAmount > 0 ? formatINR(p.estimatedAmount) : "Amount not set";
      const items = Array.isArray(p.items) && p.items.length > 0
        ? (p.items as Array<string | { name: string }>).map((it) => typeof it === "string" ? it : it.name).join(", ")
        : "unspecified items";
      return `${String(p.merchant ?? "?")} · ${items} · Est. ${amount}`;
    }
    default:
      return JSON.stringify(action.params);
  }
}

// ─── Single action card ───────────────────────────────────────────────────────

interface ActionCardProps {
  action: VoiceAction;
  selected: boolean;
  missingKeys: string[];
  onToggle: (id: string) => void;
  onUpdateParam: (actionId: string, paramKey: string, value: unknown) => void;
}

function ActionCard({ action, selected, missingKeys, onToggle, onUpdateParam }: ActionCardProps) {
  const p = action.params;
  const blockedCategories = Array.isArray(p.blockedCategories) ? (p.blockedCategories as string[]) : [];
  const blockedItems = Array.isArray(p.blockedItems) ? (p.blockedItems as string[]) : [];
  const hasRestrictions = blockedCategories.length > 0 || blockedItems.length > 0;

  return (
    <div
      className={s.actionCard}
      data-selected={selected}
      style={{ cursor: "default" }}
    >
      <div className={s.actionIcon}>
        <ActionIcon type={action.type} />
      </div>
      <div className={s.actionBody}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p className={s.actionTitle}>{action.id} — {ACTION_LABELS[action.type]}</p>
          <input
            id={`vc-action-${action.id}`}
            type="checkbox"
            className={s.actionCheckbox}
            checked={selected}
            onChange={() => onToggle(action.id)}
            aria-label={`Include ${ACTION_LABELS[action.type]} in workflow`}
          />
        </div>
        <p className={s.actionDesc}>{describeAction(action)}</p>

        {hasRestrictions && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {blockedCategories.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 10,
                  color: "#ef4444",
                  fontWeight: 600,
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                Prohibited Category: {c}
              </span>
            ))}
            {blockedItems.map((item) => (
              <span
                key={item}
                style={{
                  fontSize: 10,
                  color: "#ef4444",
                  fontWeight: 600,
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                Prohibited Item: {item}
              </span>
            ))}
          </div>
        )}

        {action.dependsOn.length > 0 && (
          <div className={s.actionDeps}>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Requires:</span>
            {action.dependsOn.map((dep) => (
              <span key={dep} className={s.depPill}>{dep}</span>
            ))}
          </div>
        )}

        {/* Inline editable inputs for missing values */}
        {missingKeys.length > 0 && (
          <div className={s.cardMissingInputs}>
            <div className={s.missingInputsNotice}>
              Enter required values for this action:
            </div>
            <div className={s.inputsGrid}>
              {missingKeys.map((key) => (
                <div key={key} className={s.inputField}>
                  <label className={s.inputLabel} htmlFor={`input-${action.id}-${key}`}>
                    {FIELD_LABELS[key] ?? key} *
                  </label>
                  <div className={s.inputWrapper}>
                    <span className={s.currencyPrefix}>₹</span>
                    <input
                      id={`input-${action.id}-${key}`}
                      type="number"
                      min="1"
                      step="1"
                      className={s.numberInput}
                      placeholder={
                        key === "monthlyLimit"
                          ? "e.g. 5000"
                          : key === "perTransactionCap"
                          ? "e.g. 1500"
                          : "e.g. 2500"
                      }
                      value={typeof p[key] === "number" && (p[key] as number) > 0 ? (p[key] as number) : ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const num = val === "" ? null : Number(val);
                        onUpdateParam(action.id, key, num != null && !Number.isNaN(num) && num > 0 ? num : null);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main review component ────────────────────────────────────────────────────

interface WorkflowReviewProps {
  workflow: VoiceWorkflow;
  transcript: string | null;
  onAuthorize: (confirmedIds: string[], updatedWorkflow?: VoiceWorkflow) => void;
  onRecordAgain: () => void;
  onCancel: () => void;
}

export function WorkflowReview({
  workflow,
  transcript,
  onAuthorize,
  onRecordAgain,
  onCancel,
}: WorkflowReviewProps) {
  const [actions, setActions] = useState<VoiceAction[]>(() => workflow.actions);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(workflow.actions.map((a) => a.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also deselect dependents
        for (const action of actions) {
          if (action.dependsOn.includes(id)) next.delete(action.id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateParam = (actionId: string, paramKey: string, value: unknown) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId) return a;
        return {
          ...a,
          params: {
            ...a.params,
            [paramKey]: value,
          },
        };
      })
    );
  };

  // Compute missing fields dynamically from current action state for selected actions
  const actionMissingMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of actions) {
      map.set(a.id, getMissingFieldsForAction(a));
    }
    return map;
  }, [actions]);

  const selectedIds = actions.map((a) => a.id).filter((id) => selected.has(id));

  const allSelectedMissingFields = useMemo(() => {
    const set = new Set<string>();
    for (const id of selectedIds) {
      const missing = actionMissingMap.get(id) ?? [];
      for (const m of missing) set.add(m);
    }
    return Array.from(set);
  }, [selectedIds, actionMissingMap]);

  const hasMissing = allSelectedMissingFields.length > 0;
  const canAuthorize = selectedIds.length > 0 && !hasMissing;

  const handleAuthorize = () => {
    if (!canAuthorize) return;
    const updatedWorkflow: VoiceWorkflow = {
      ...workflow,
      actions,
      missingFields: allSelectedMissingFields,
    };
    onAuthorize(selectedIds, updatedWorkflow);
  };

  return (
    <div className={s.reviewStage}>
      <div className={s.reviewHeader}>
        <h2 className={s.reviewTitle}>Review Autonomous Workflow</h2>
        <p className={s.reviewSub}>
          Verify the extracted actions below. Enter any missing values or tap <strong>Record Again</strong> to speak again.
        </p>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className={s.transcriptBox}>
          <div className={s.transcriptLabel}>Your command</div>
          <div className={s.transcriptText}>&ldquo;{transcript}&rdquo;</div>
        </div>
      )}

      {/* Missing fields alert banner with direct Record Again button */}
      {hasMissing ? (
        <div className={s.missingCard}>
          <div className={s.missingCardHeader}>
            <div className={s.missingTitleGroup}>
              <CircleAlert size={20} className={s.missingIcon} />
              <div>
                <h3 className={s.missingTitle}>Additional values needed</h3>
                <p className={s.missingSub}>
                  We need a few more numbers to complete this workflow. Enter them in the fields below, or tap <strong>Record Again</strong> to speak with the amounts.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRecordAgain}
            >
              <Mic size={14} className="mr-1.5 text-primary" />
              Record Again
            </Button>
          </div>

          <div className={s.missingTags}>
            {allSelectedMissingFields.map((field) => (
              <span key={field} className={s.missingPill}>
                Missing: {FIELD_LABELS[field] ?? field}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "color-mix(in srgb, var(--success, #16a34a) 8%, var(--card))",
          border: "1px solid color-mix(in srgb, var(--success, #16a34a) 30%, var(--border))",
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 13,
          color: "var(--foreground)",
        }}>
          <CheckCircle2 size={16} style={{ color: "var(--success, #16a34a)", flexShrink: 0 }} />
          <span>All required parameters are configured. Ready to authorize.</span>
        </div>
      )}

      {/* Warnings */}
      {workflow.warnings.length > 0 && (
        <div className={s.warningsBox}>
          {workflow.warnings.map((w, i) => (
            <div key={i} className={s.warningItem}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Action cards */}
      <div className={s.actionsSection}>
        <div className={s.sectionLabel}>Actions · {selectedIds.length} / {actions.length} selected</div>
        <div className={s.actionCards}>
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              selected={selected.has(action.id)}
              missingKeys={actionMissingMap.get(action.id) ?? []}
              onToggle={toggle}
              onUpdateParam={updateParam}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={s.reviewFooter}>
        <p className={s.footerHint}>
          Voice creates intent. You create authority. KavachPay controls execution.
        </p>
        <div className={s.footerButtons}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRecordAgain}
          >
            <Mic size={14} className="mr-1.5 text-primary" />
            Record Again
          </Button>
          <Button
            onClick={handleAuthorize}
            disabled={!canAuthorize}
            id="voice-authorize-btn"
          >
            Authorize {selectedIds.length} action{selectedIds.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
