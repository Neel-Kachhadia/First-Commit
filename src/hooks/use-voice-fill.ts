import { useCallback, useRef, useState } from "react";
import {
  apiClient,
  type MandateExtraction,
  type MandateFormState,
} from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseVoiceFillOptions {
  /** Current form values so the NLU model knows what's already filled. */
  currentFormState: MandateFormState;
  /** Called with the extraction diff once the full pipeline completes. */
  onExtracted: (diff: MandateExtraction) => void;
}

type VoiceFillState =
  | "idle"
  | "recording"
  | "transcribing"
  | "pending_review"   // transcript ready — waiting for user to confirm / edit
  | "extracting"
  | "done"
  | "error";

interface UseVoiceFillReturn {
  state: VoiceFillState;
  /** Convenience booleans derived from state */
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string | null;
  unresolvedFields: string[];
  ambiguities: string | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  /** Layer 4: let the user correct the transcript before extraction */
  editTranscript: (text: string) => void;
  /** Layer 4: run extraction on the (possibly edited) transcript */
  confirmAndExtract: () => Promise<void>;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceFill({
  currentFormState,
  onExtracted,
}: UseVoiceFillOptions): UseVoiceFillReturn {
  const [state, setState] = useState<VoiceFillState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [unresolvedFields, setUnresolvedFields] = useState<string[]>([]);
  const [ambiguities, setAmbiguities] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // Keep a stable ref to currentFormState for use inside callbacks
  const formStateRef = useRef<MandateFormState>(currentFormState);
  formStateRef.current = currentFormState;

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState("idle");
    setTranscript(null);
    setUnresolvedFields([]);
    setAmbiguities(null);
    setError(null);
  }, []);

  // ── Layer 4: edit transcript before extraction ─────────────────────────────

  const editTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  // ── Step 2: run extraction on the current transcript ──────────────────────

  const runExtraction = useCallback(
    async (text: string) => {
      try {
        setState("extracting");
        const { extraction } = await apiClient.extractMandateFields(
          text,
          formStateRef.current
        );

        setUnresolvedFields(extraction.unresolvedFields ?? []);
        setAmbiguities(extraction.ambiguities ?? null);

        // Notify form to patch fields
        onExtracted(extraction);

        setState("done");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Voice extraction failed.";
        setError(message);
        setState("error");
      }
    },
    [onExtracted]
  );

  // ── Layer 4: confirmAndExtract — triggered by user after reviewing transcript

  const confirmAndExtract = useCallback(async () => {
    if (!transcript || transcript.trim().length === 0) return;
    await runExtraction(transcript);
  }, [transcript, runExtraction]);

  // ── Step 1: transcribe audio → set pending_review ─────────────────────────

  const runTranscription = useCallback(
    async (audioBlob: Blob) => {
      try {
        setState("transcribing");
        const { text } = await apiClient.transcribeAudio(audioBlob);
        setTranscript(text);

        // Pause here — user can review/edit before extraction fires
        setState("pending_review");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Voice transcription failed.";
        setError(message);
        setState("error");
      }
    },
    []
  );

  // ── Start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    reset();

    // Check browser support
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Your browser does not support microphone access.");
      setState("error");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("Your browser does not support MediaRecorder.");
      setState("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Microphone permission denied. Please allow microphone access and try again."
      );
      setState("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // Pick the best supported MIME type
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Stop all mic tracks so the browser releases the device
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      chunksRef.current = [];
      await runTranscription(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }, [reset, runTranscription]);

  // ── Stop recording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      // State transitions to "transcribing" inside onstop → runTranscription
    }
  }, []);

  return {
    state,
    isRecording: state === "recording",
    isProcessing:
      state === "transcribing" || state === "extracting",
    transcript,
    unresolvedFields,
    ambiguities,
    error,
    startRecording,
    stopRecording,
    editTranscript,
    confirmAndExtract,
    reset,
  };
}
