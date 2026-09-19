"use client";

import { Check, X, Minus, Shield, GitBranch, Play, ShoppingCart } from "lucide-react";
import type { ActionResult, VoiceAction, VoiceActionType } from "@/lib/voice-workflow-types";
import { ACTION_LABELS } from "@/lib/voice-workflow-types";
import s from "./voice.module.css";

function ActionIcon({ type }: { type: VoiceActionType }) {
  const size = 14;
  switch (type) {
    case "CREATE_MANDATE":    return <Shield size={size} />;
    case "CREATE_DELEGATION": return <GitBranch size={size} />;
    case "START_AGENT":       return <Play size={size} />;
    case "CREATE_ORDER":      return <ShoppingCart size={size} />;
    default:                  return <Shield size={size} />;
  }
}

function describeOutput(result: ActionResult): string {
  if (!result.output) return "";
  const out = result.output;
  const parts: string[] = [];
  if (out.grantId)  parts.push(`Grant ${String(out.grantId).slice(-8)}`);
  if (out.intentId) parts.push(`Intent ${String(out.intentId).slice(-8)}`);
  if (out.decision) parts.push(`Decision: ${String(out.decision)}`);
  return parts.join(" · ");
}

interface TimelineStepProps {
  action: VoiceAction;
  result?: ActionResult;
  isExecuting: boolean;
}

function TimelineStep({ action, result, isExecuting }: TimelineStepProps) {
  const status = result?.status;
  const isRunning = isExecuting && !result;
  const indicatorStatus = isRunning ? "running" : status ?? "pending";

  return (
    <div className={s.timelineStep}>
      <div className={s.stepIndicator} data-status={indicatorStatus}>
        {isRunning ? (
          <span className={s.stepSpinner} />
        ) : status === "SUCCESS" ? (
          <Check size={13} />
        ) : status === "FAILED" ? (
          <X size={13} />
        ) : status === "SKIPPED" ? (
          <Minus size={13} />
        ) : (
          <ActionIcon type={action.type} />
        )}
      </div>
      <div className={s.stepBody}>
        <p className={s.stepName}>
          {action.id} — {ACTION_LABELS[action.type]}
        </p>
        {result ? (
          <p className={s.stepResult} data-status={result.status}>
            {result.status === "SUCCESS"
              ? describeOutput(result) || "Complete"
              : result.error ?? result.status.toLowerCase()}
          </p>
        ) : isRunning ? (
          <p className={s.stepResult}>Running…</p>
        ) : (
          <p className={s.stepResult}>Pending</p>
        )}
      </div>
    </div>
  );
}

interface WorkflowTimelineProps {
  actions: VoiceAction[];
  results: ActionResult[];
  isExecuting: boolean;
}

export function WorkflowTimeline({ actions, results, isExecuting }: WorkflowTimelineProps) {
  const resultMap = new Map(results.map((r) => [r.actionId, r]));

  return (
    <div className={s.timeline}>
      {actions.map((action) => (
        <TimelineStep
          key={action.id}
          action={action}
          result={resultMap.get(action.id)}
          isExecuting={isExecuting}
        />
      ))}
    </div>
  );
}
