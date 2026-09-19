"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  Mic,
  Square,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KavachMark } from "@/components/kavach/logo";
import { useVoiceWorkflow } from "@/hooks/use-voice-workflow";
import { WorkflowReview } from "./WorkflowReview";
import { WorkflowTimeline } from "./WorkflowTimeline";
import s from "./voice.module.css";

// ─── Waveform bars ─────────────────────────────────────────────────────────────

const BARS = 20;
const HEIGHTS = [8, 14, 20, 26, 18, 10, 22, 28, 16, 12, 24, 20, 14, 18, 26, 10, 16, 22, 12, 8];

function Waveform({ level }: { level: number }) {
  return (
    <div className={s.waveform} aria-hidden="true">
      {Array.from({ length: BARS }).map((_, i) => {
        const base = HEIGHTS[i % HEIGHTS.length];
        const height = Math.max(3, base * (0.3 + level * 0.7));
        return (
          <div
            key={i}
            className={s.waveBar}
            style={{ height: `${height}px`, opacity: 0.4 + level * 0.6 }}
          />
        );
      })}
    </div>
  );
}

// ─── Processing stage ─────────────────────────────────────────────────────────

function ProcessingStage({ label, hint, phase }: { label: string; hint: string; phase: "transcribing" | "parsing" }) {
  return (
    <div className={s.processingStage} role="status" aria-live="polite">
      <span className={s.processingGlyph} aria-hidden="true"><Mic size={22} /></span>
      <p className={s.processingEyebrow}>Preparing your review</p>
      <h2 className={s.processingLabel}>{label}</h2>
      <p className={s.processingHint}>{hint}</p>
      <div className={s.processingProgress} aria-hidden="true"><span /></div>
      <div className={s.processingSteps} aria-hidden="true">
        <span data-active={phase === "transcribing"}>Transcribe audio</span>
        <span data-active={phase === "parsing"}>Build review</span>
      </div>
    </div>
  );
}

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner({
  status,
  summary,
}: {
  status: string;
  summary?: { succeeded: number; failed: number; skipped: number };
}) {
  const map: Record<string, { icon: React.ReactNode; title: string; sub: string }> = {
    COMPLETED: {
      icon: <CheckCircle2 size={20} />,
      title: "Workflow Completed",
      sub: summary
        ? `${summary.succeeded} action${summary.succeeded !== 1 ? "s" : ""} executed successfully`
        : "All actions completed successfully",
    },
    PARTIALLY_COMPLETED: {
      icon: <AlertCircle size={20} />,
      title: "Partially Completed",
      sub: summary
        ? `${summary.succeeded} succeeded · ${summary.failed} failed · ${summary.skipped} skipped`
        : "Some actions could not complete",
    },
    FAILED: {
      icon: <XCircle size={20} />,
      title: "Workflow Failed",
      sub: "No actions completed successfully. Check the details below.",
    },
    error: {
      icon: <XCircle size={20} />,
      title: "Execution Error",
      sub: "An unexpected error occurred. Please try again.",
    },
  };

  const info = map[status] ?? map.error;

  return (
    <div className={s.resultBanner} data-status={status}>
      <div className={s.resultBannerIcon}>{info.icon}</div>
      <div className={s.resultBannerText}>
        <p className={s.resultBannerTitle}>{info.title}</p>
        <p className={s.resultBannerSub}>{info.sub}</p>
      </div>
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

interface VoiceCaptureSheetProps {
  onClose: () => void;
}

export function VoiceCaptureSheet({ onClose }: VoiceCaptureSheetProps) {
  const voice = useVoiceWorkflow();
  const {
    state,
    isRecording,
    level,
    elapsedSeconds,
    transcript,
    workflow,
    executionResult,
    liveResults,
    error,
    startRecording,
    stopRecording,
    authorize,
    cancel,
    reset,
  } = voice;

  // Close and cancel on Escape
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state === "idle" || state === "error" || state === "completed" || state === "partially_completed" || state === "failed") {
          onClose();
        } else {
          cancel();
        }
      }
    },
    [state, onClose, cancel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleClose = () => {
    cancel();
    onClose();
  };

  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  if (!mounted) return null;

  return createPortal(
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Global Voice Command">
      {/* Top bar */}
      <div className={s.topbar}>
        <div className={s.brand}>
          <KavachMark className="h-7 w-7 text-primary" />
          <span className={s.brandLabel}>Global Voice</span>
          {workflow?.commandId && (
            <span className={s.commandId}>{workflow.commandId}</span>
          )}
        </div>
        <button
          type="button"
          className={s.closeBtn}
          onClick={handleClose}
          aria-label="Close voice command"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className={s.content}>
        {/* ── Idle / recording stage ── */}
        {(state === "idle" || state === "recording" || state === "requesting") && (
          <div className={s.recordStage}>
            <div className={s.recordIntro}>
              <p className={s.recordEyebrow}>Voice command</p>
              <h1 className={s.recordTitle}>
                {isRecording ? "I’m listening." : state === "requesting" ? "Connecting your microphone…" : "Speak your workflow."}
              </h1>
              <p className={s.recordSub}>
                Describe the mandate and any payment you want to make. You will review every action before anything runs.
              </p>
              {!isRecording && <div className={s.exampleBox}>
                <MessageSquare size={17} className={s.exampleIcon} aria-hidden="true" />
                <div>
                  <span className={s.exampleLabel}>For example</span>
                  <p className={s.exampleText}>
                    “Create a grocery mandate for ₹4,000 a month, allow Blinkit, then order milk and eggs.”
                  </p>
                </div>
              </div>}
            </div>
            <div className={s.recordControl}>
            <div className={s.blobWrap}>
              <div className={s.blobHalo} data-active={isRecording ? "true" : "false"} aria-hidden="true" />
              <button
                type="button"
                className={s.blob}
                data-recording={isRecording}
                data-disabled={state === "requesting"}
                style={{ "--voice-scale": isRecording ? `${1 + level * 0.2}` : "1" } as React.CSSProperties}
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? "Stop recording" : "Start voice command"}
                disabled={state === "requesting"}
              >
                {isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={24} />}
              </button>
            </div>

            {isRecording ? (
              <>
                <div className={s.liveMeta}>
                  <span className={s.liveDot} />
                  RECORDING · {elapsed}
                </div>
                <Waveform level={level} />
                <Button variant="outline" onClick={stopRecording}>
                  <Square size={12} fill="currentColor" className="mr-1.5" />
                  Stop &amp; Process
                </Button>
              </>
            ) : (
              <p className={s.recordHint}>{state === "requesting" ? "Waiting for browser permission" : "Tap the microphone to begin"}</p>
            )}
            </div>
            <div className={s.voiceSteps} aria-label="Voice workflow stages">
              <span>Speak naturally</span><span aria-hidden="true">→</span><span>Review the plan</span><span aria-hidden="true">→</span><span>Authorize actions</span>
            </div>
          </div>
        )}

        {/* ── Transcribing stage ── */}
        {state === "transcribing" && (
          <ProcessingStage
            label="Transcribing your voice…"
            hint="Converting speech to text"
            phase="transcribing"
          />
        )}

        {/* ── Parsing stage ── */}
        {state === "parsing" && (
          <ProcessingStage
            label="Compiling workflow…"
            hint="Organizing the actions for your approval"
            phase="parsing"
          />
        )}

        {/* ── Review stage ── */}
        {state === "review_required" && workflow && (
          <WorkflowReview
            workflow={workflow}
            transcript={transcript}
            onAuthorize={authorize}
            onCancel={() => { reset(); }}
          />
        )}

        {/* ── Executing stage ── */}
        {state === "executing" && workflow && (
          <div className={s.executionStage}>
            <div className={s.executionHeader}>
              <div className={s.spinRing} aria-hidden="true" />
              <p className={s.executionTitle}>Executing workflow…</p>
            </div>
            <WorkflowTimeline
              actions={workflow.actions}
              results={liveResults}
              isExecuting={true}
            />
          </div>
        )}

        {/* ── Result stages ── */}
        {(state === "completed" || state === "partially_completed" || state === "failed") && workflow && executionResult && (
          <div className={s.executionStage}>
            <ResultBanner
              status={executionResult.status}
              summary={executionResult.summary}
            />
            <WorkflowTimeline
              actions={workflow.actions}
              results={liveResults}
              isExecuting={false}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              {(state === "partially_completed" || state === "failed") && (
                <Button variant="outline" onClick={reset}>
                  Try Again
                </Button>
              )}
              <Button asChild onClick={onClose}>
                <Link href="/activity">
                  <Zap size={14} className="mr-1.5" />
                  View Decisions Feed
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {state === "error" && (
          <div className={s.recordStage}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "24px 20px",
              border: "1px solid var(--destructive)",
              borderRadius: 10,
              background: "color-mix(in srgb, var(--destructive) 8%, transparent)",
              maxWidth: 440,
              textAlign: "center",
            }}>
              <XCircle size={32} style={{ color: "var(--destructive)" }} />
              <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>Something went wrong</p>
              <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                {error}
              </p>
              <Button variant="outline" onClick={reset}>Try Again</Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
