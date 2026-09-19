"use client";

import { useState, useEffect, useCallback } from "react";
import { Mic } from "lucide-react";
import { VoiceCaptureSheet } from "./VoiceCaptureSheet";
import s from "./voice.module.css";

export function GlobalVoiceTrigger() {
  const [open, setOpen] = useState(false);

  // ⌘ Space or Ctrl+Space → open voice
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        // Don't intercept if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <button
        type="button"
        id="global-voice-trigger"
        className={s.triggerButton}
        onClick={() => setOpen(true)}
        aria-label="Open voice command (Ctrl+Space)"
        title="Ask KavachPay — Ctrl+Space"
      >
        <span className={s.triggerDot} aria-hidden="true" />
        <Mic size={13} aria-hidden="true" />
        <span className={s.triggerLabel}>Ask KavachPay…</span>
        <kbd className={s.triggerKbd}>⌘ Space</kbd>
      </button>

      {open && (
        <VoiceCaptureSheet onClose={() => setOpen(false)} />
      )}
    </>
  );
}
