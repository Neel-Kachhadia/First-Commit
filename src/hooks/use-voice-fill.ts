import { useCallback, useEffect, useRef, useState } from "react";
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
  | "requesting"
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
  level: number;
  elapsedSeconds: number;
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

function cleanErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
    return "AI service is currently experiencing high demand. Please try again in a few seconds.";
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
    return "AI service quota or rate limit reached. Please wait a moment before trying again.";
  }
  if (raw.startsWith("{") && raw.includes('"message"')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch {}
  }
  return raw;
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
  const [level, setLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // Keep a stable ref to currentFormState for use inside callbacks
  const formStateRef = useRef<MandateFormState>(currentFormState);
  useEffect(() => {
    formStateRef.current = currentFormState;
  }, [currentFormState]);

  const stopMeter = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (timerRef.current !== null) clearInterval(timerRef.current);
      void audioContextRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = null;
    };
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState("idle");
    setTranscript(null);
    setUnresolvedFields([]);
    setAmbiguities(null);
    setError(null);
    setElapsedSeconds(0);
  }, []);

  // ── Layer 4: edit transcript before extraction ─────────────────────────────

  const editTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  // ── Step 2: run extraction on the current transcript ──────────────────────

  const runExtraction = useCallback(
    async (text: string) => {
      try {
        setError(null);
        setAmbiguities(null);
        setUnresolvedFields([]);
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
        setError(cleanErrorMessage(err, "Voice extraction failed."));
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
        if (!text?.trim()) throw new Error("No speech was detected. Try again closer to the microphone.");
        setTranscript(text);

        // Pause here — user can review/edit before extraction fires
        setState("pending_review");
      } catch (err) {
        setError(cleanErrorMessage(err, "Voice transcription failed."));
        setState("error");
      }
    },
    []
  );

  // ── Start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    reset();
    setState("requesting");

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
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof DOMException && err.name === "NotFoundError"
        ? "No microphone was found. Connect one and try again."
        : "Microphone access was not available. Check browser permission and try again.");
      setState("error");
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
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

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError("This browser could not start audio recording. Please try another browser.");
      setState("error");
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stopMeter();
      // Stop all mic tracks so the browser releases the device
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      chunksRef.current = [];
      if (blob.size === 0) {
        setError("No audio was captured. Please try recording again.");
        setState("error");
        return;
      }
      await runTranscription(blob);
    };

    mediaRecorderRef.current = recorder;
    try {
      recorder.start();
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError("Recording could not start. Please try again.");
      setState("error");
      return;
    }
    const startedAt = Date.now();
    timerRef.current = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastUpdate = 0;
      const sample = (timestamp: number) => {
        if (timestamp - lastUpdate >= 70) {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const value of samples) sum += ((value - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5));
          lastUpdate = timestamp;
        }
        animationFrameRef.current = requestAnimationFrame(sample);
      };
      animationFrameRef.current = requestAnimationFrame(sample);
    } catch {
      // Recording remains usable when live audio metering is unavailable.
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    }
    setState("recording");
  }, [reset, runTranscription, stopMeter]);

  // ── Stop recording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      setState("transcribing");
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    state,
    isRecording: state === "recording",
    isProcessing:
      state === "requesting" || state === "transcribing" || state === "extracting",
    level,
    elapsedSeconds,
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
