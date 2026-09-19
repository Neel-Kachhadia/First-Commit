"use client";

import { useState } from "react";
import { AlertTriangle, Shield, GitBranch, Play, ShoppingCart, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/kavach-data";
import type { VoiceWorkflow, VoiceAction, VoiceActionType } from "@/lib/voice-workflow-types";
import { ACTION_LABELS } from "@/lib/voice-workflow-types";
import s from "./voice.module.css";

// ─── Action icon ──────────────────────────────────────────────────────────────

function ActionIcon({ type }: { type: VoiceActionType }) {
  switch (type) {
    case "CREATE_MANDATE":    return <Shield size={15} />;
    case "CREATE_DELEGATION": return <GitBranch size={15} />;
    case "START_AGENT":       return <Play size={15} />;
    case "CREATE_ORDER":      return <ShoppingCart size={15} />;
  }
}

// ─── Action description builder ───────────────────────────────────────────────

function describeAction(action: VoiceAction): string {
  const p = action.params;
  switch (action.type) {
    case "CREATE_MANDATE": {
      const limit = typeof p.monthlyLimit === "number" ? formatINR(p.monthlyLimit) : "?";
      const cap = typeof p.perTransactionCap === "number" ? formatINR(p.perTransactionCap) : "?";
      const category = String(p.category ?? "General");
      const windowStr = String(p.window ?? "MONTHLY").toLowerCase();
      const merchants = Array.isArray(p.merchants) && p.merchants.length > 0
        ? (p.merchants as string[]).slice(0, 3).join(", ")
        : "all merchants";
      return `${category} · ${limit}/${windowStr} · ${cap} auto-cap · ${merchants}`;
    }
    case "CREATE_DELEGATION": {
      const capacity = typeof p.capacity === "number" ? formatINR(p.capacity) : "?";
      return `Capacity ${capacity} · Delegated from ${String(p.parentActionId ?? "root")}`;
    }
    case "START_AGENT": {
      return `Activates agent from ${String(p.agentActionId ?? "delegation")}`;
    }
    case "CREATE_ORDER": {
      const amount = typeof p.estimatedAmount === "number" ? formatINR(p.estimatedAmount) : "?";
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
  onToggle: (id: string) => void;
}

function ActionCard({ action, selected, onToggle }: ActionCardProps) {
  const p = action.params;
  const blockedCategories = Array.isArray(p.blockedCategories) ? (p.blockedCategories as string[]) : [];
  const blockedItems = Array.isArray(p.blockedItems) ? (p.blockedItems as string[]) : [];
  const hasRestrictions = blockedCategories.length > 0 || blockedItems.length > 0;

  return (
    <label
      className={s.actionCard}
      data-selected={selected}
      htmlFor={`vc-action-${action.id}`}
      style={{ cursor: "pointer" }}
    >
      <div className={s.actionIcon}>
        <ActionIcon type={action.type} />
      </div>
      <div className={s.actionBody}>
        <p className={s.actionTitle}>{action.id} — {ACTION_LABELS[action.type]}</p>
        <p className={s.actionDesc}>{describeAction(action)}</p>
        {hasRestrictions && (
          <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
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
      </div>
      <input
        id={`vc-action-${action.id}`}
        type="checkbox"
        className={s.actionCheckbox}
        checked={selected}
        onChange={() => onToggle(action.id)}
        aria-label={`Include ${ACTION_LABELS[action.type]} in workflow`}
      />
    </label>
  );
}

// ─── Main review component ────────────────────────────────────────────────────

interface WorkflowReviewProps {
  workflow: VoiceWorkflow;
  transcript: string | null;
  onAuthorize: (confirmedIds: string[]) => void;
  onCancel: () => void;
}

export function WorkflowReview({
  workflow,
  transcript,
  onAuthorize,
  onCancel,
}: WorkflowReviewProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(workflow.actions.map((a) => a.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also deselect dependents
        for (const action of workflow.actions) {
          if (action.dependsOn.includes(id)) next.delete(action.id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedIds = workflow.actions.map((a) => a.id).filter((id) => selected.has(id));
  const hasMissing = workflow.missingFields.length > 0;
  const canAuthorize = selectedIds.length > 0 && !hasMissing;

  return (
    <div className={s.reviewStage}>
      <div className={s.reviewHeader}>
        <h2 className={s.reviewTitle}>Review Autonomous Workflow</h2>
        <p className={s.reviewSub}>
          Verify the extracted actions below. Uncheck any you don&apos;t want to execute.
          Press <strong>Authorize</strong> to execute under your Cognito identity.
        </p>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className={s.transcriptBox}>
          <div className={s.transcriptLabel}>Your command</div>
          <div className={s.transcriptText}>&ldquo;{transcript}&rdquo;</div>
        </div>
      )}

      {/* Missing fields warning */}
      {hasMissing && (
        <div className={s.missingBox}>
          <CircleAlert size={14} style={{ display: "inline", marginRight: 6 }} />
          <strong>Missing required values:</strong>{" "}
          {workflow.missingFields.join(", ")}.{" "}
          Authorization is blocked until these are resolved. Try speaking again with these values.
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
        <div className={s.sectionLabel}>Actions · {selectedIds.length} / {workflow.actions.length} selected</div>
        <div className={s.actionCards}>
          {workflow.actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              selected={selected.has(action.id)}
              onToggle={toggle}
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
            onClick={() => onAuthorize(selectedIds)}
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
