import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  VoiceWorkflow,
  VoiceWorkflowState,
  WorkflowExecutionResult,
  ActionResult,
} from "@/lib/voice-workflow-types";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseVoiceWorkflowReturn {
  state: VoiceWorkflowState;
  isRecording: boolean;
  isProcessing: boolean;
  level: number;
  elapsedSeconds: number;
  transcript: string | null;
  workflow: VoiceWorkflow | null;
  executionResult: WorkflowExecutionResult | null;
  /** Per-action progress updates during execution */
  liveResults: ActionResult[];
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  /** Called by the user from the review screen to begin execution */
  authorize: (confirmedActionIds?: string[], updatedWorkflow?: VoiceWorkflow) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

function cleanError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand"))
    return "AI service is under high demand. Please try again in a few seconds.";
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota"))
    return "AI service quota reached. Please wait before retrying.";
  return raw;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceWorkflow(): UseVoiceWorkflowReturn {
  const [state, setState] = useState<VoiceWorkflowState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<VoiceWorkflow | null>(null);
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionResult | null>(null);
  const [liveResults, setLiveResults] = useState<ActionResult[]>([]);
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (timerRef.current !== null) clearInterval(timerRef.current);
      void audioContextRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = null;
    };
  }, []);

  const stopMeter = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setLevel(0);
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setTranscript(null);
    setWorkflow(null);
    setExecutionResult(null);
    setLiveResults([]);
    setError(null);
    setElapsedSeconds(0);
  }, []);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopMeter();
    reset();
  }, [reset, stopMeter]);

  // ── Step 2: Parse transcript → workflow bundle ─────────────────────────────

  const runParsing = useCallback(async (text: string) => {
    try {
      setState("parsing");
      setError(null);
      const { workflow: parsed } = await apiClient.parseVoiceWorkflow(text);
      if (!mountedRef.current) return;
      setWorkflow(parsed);
      setState("review_required");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(cleanError(err, "Voice workflow parsing failed."));
      setState("error");
    }
  }, []);

  // ── Step 1: Transcribe audio ───────────────────────────────────────────────

  const runTranscription = useCallback(async (audioBlob: Blob) => {
    try {
      setState("transcribing");
      const { text } = await apiClient.transcribeAudio(audioBlob);
      if (!mountedRef.current) return;
      if (!text?.trim()) throw new Error("No speech was detected. Try again closer to the microphone.");
      setTranscript(text);
      await runParsing(text);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(cleanError(err, "Transcription failed."));
      setState("error");
    }
  }, [runParsing]);

  // ── Step 3: Execute authorized workflow ──────────────────────────────────

  const authorize = useCallback(async (confirmedActionIds?: string[], updatedWorkflow?: VoiceWorkflow) => {
    const wf = updatedWorkflow ?? workflow;
    if (!wf) return;
    const ids = confirmedActionIds ?? wf.actions.map((a) => a.id);
    if (ids.length === 0) return;

    setWorkflow(wf);
    setState("executing");
    setLiveResults([]);
    setError(null);

    try {
      const result = await apiClient.executeVoiceWorkflow(wf, ids);
      if (!mountedRef.current) return;
      setExecutionResult(result);
      setLiveResults(result.results);
      setState(
        result.status === "COMPLETED" ? "completed" :
        result.status === "PARTIALLY_COMPLETED" ? "partially_completed" :
        "failed"
      );
    } catch (err) {
      if (!mountedRef.current) return;
      setError(cleanError(err, "Workflow execution failed."));
      setState("error");
    }
  }, [workflow]);

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    reset();
    setState("requesting");

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone access.");
      setState("error");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("Your browser does not support audio recording.");
      setState("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof DOMException && err.name === "NotFoundError"
          ? "No microphone found. Connect one and try again."
          : "Microphone access denied. Check browser permissions."
      );
      setState("error");
      return;
    }

    if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

    streamRef.current = stream;
    chunksRef.current = [];

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
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError("Could not start audio recording. Please try a different browser.");
      setState("error");
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stopMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      chunksRef.current = [];
      if (blob.size === 0) {
        setError("No audio was captured. Please try again.");
        setState("error");
        return;
      }
      await runTranscription(blob);
    };

    mediaRecorderRef.current = recorder;
    try {
      recorder.start();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError("Recording could not start. Please try again.");
      setState("error");
      return;
    }

    const startedAt = Date.now();
    timerRef.current = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      250
    );

    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastUpdate = 0;
      const sample = (ts: number) => {
        if (ts - lastUpdate >= 70) {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5));
          lastUpdate = ts;
        }
        animationFrameRef.current = requestAnimationFrame(sample);
      };
      animationFrameRef.current = requestAnimationFrame(sample);
    } catch {
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    }

    setState("recording");
  }, [reset, runTranscription, stopMeter]);

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
      state === "requesting" ||
      state === "transcribing" ||
      state === "parsing" ||
      state === "executing",
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
  };
}
