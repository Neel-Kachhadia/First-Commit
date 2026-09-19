"use client";

import { useState, useEffect, useCallback } from "react";
import { Mic } from "lucide-react";
import { VoiceCaptureSheet } from "./VoiceCaptureSheet";
import { Button } from "@/components/ui/button";

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
      <Button
        variant="ghost"
        size="icon"
        id="global-voice-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open voice command (Ctrl+Space)"
        title="Ask KavachPay — Ctrl+Space"
        className="relative shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Mic className="h-4 w-4" aria-hidden="true" />
      </Button>

      {open && (
        <VoiceCaptureSheet onClose={() => setOpen(false)} />
      )}
    </>
  );
}
