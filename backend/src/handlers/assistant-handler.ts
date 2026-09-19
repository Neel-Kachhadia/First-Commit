import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { groqService, type MandateFormState } from "../services/groq-service.js";
import { categoryService } from "../services/category-service.js";

// ─── Multer config ────────────────────────────────────────────────────────────

const AUDIO_MIME_ALLOWLIST = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/flac",
]);

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Multer instance for the /transcribe route.
 * Stores in memory (buffers) — no disk writes.
 */
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, cb) => {
    // Accept both the full MIME (audio/webm;codecs=opus) and the base type
    const base = file.mimetype.split(";")[0].trim().toLowerCase();
    if (AUDIO_MIME_ALLOWLIST.has(base)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

// ─── Sanitisation helpers ─────────────────────────────────────────────────────

/** Strip HTML / script tags from a string. */
function sanitizeText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // strip tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim();
}

/** Truncate a string to at most `max` characters. */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function formatAiErrorMessage(
  error: unknown,
  defaultMessage: string
): { message: string; status: number } {
  const raw = error instanceof Error ? error.message : defaultMessage;
  let message = raw;

  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
    message = "AI service is currently experiencing high demand. Please try again in a few seconds.";
  } else if (
    raw.includes("429") ||
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("Quota exceeded") ||
    raw.includes("quota")
  ) {
    message = "AI service rate limit reached. Please wait a moment before trying again.";
  } else if (raw.startsWith("{") && raw.includes('"message"')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        message = parsed.error.message;
      } else if (parsed?.message) {
        message = parsed.message;
      }
    } catch {}
  }

  const status = message.includes("not configured") ? 503 : 500;
  return { message, status };
}

// ─── POST /api/assistant/transcribe ──────────────────────────────────────────

/**
 * Receives a multipart audio upload (field name: "audio") and returns
 * the transcript.
 *
 * Requires multer middleware to run first — see app.ts registration.
 */
export async function transcribeHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No audio file received. Send the recording as a multipart field named "audio".',
      });
      return;
    }

    // Fetch dynamic brand list for hint prompt
    const userId = req.user?.sub ?? "__anonymous__";
    const allCategories = await categoryService.listCategories(userId);
    const brandNames = categoryService.buildCanonicalBrandList();

    const text = await groqService.transcribeAudio(file.buffer, file.mimetype, brandNames);

    res.status(200).json({ success: true, text });
  } catch (error) {
    console.error("[transcribeHandler] error:", error);

    const { message, status } = formatAiErrorMessage(error, "Transcription failed.");
    res.status(status).json({ success: false, error: message });
  }
}

// ─── POST /api/assistant/extract-mandate ──────────────────────────────────────

/**
 * Receives { transcript, currentFormState } and returns a MandateExtraction diff.
 *
 * The diff only contains fields the model is confident about.
 * Ambiguous values always land in unresolvedFields — never guessed.
 */
export async function extractMandateVoiceHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const rawTranscript = req.body?.transcript;
    const currentFormState: Partial<MandateFormState> =
      req.body?.currentFormState ?? {};

    if (
      typeof rawTranscript !== "string" ||
      rawTranscript.trim().length === 0
    ) {
      res.status(400).json({
        success: false,
        error: "transcript is required and must be a non-empty string.",
      });
      return;
    }

    // Sanitize before passing to AI or storing
    const transcript = truncate(sanitizeText(rawTranscript), 2000);

    if (transcript.length === 0) {
      res.status(400).json({
        success: false,
        error: "Transcript was empty after sanitization.",
      });
      return;
    }

    // Fetch dynamic categories + brand list for the NLU prompt
    const userId = req.user?.sub ?? "__anonymous__";
    const allCategories = await categoryService.listCategories(userId);
    const categoryNames = allCategories.map((c) => c.name);
    const brandNames = categoryService.buildCanonicalBrandList();

    const extraction = await groqService.extractMandateFields(
      transcript,
      currentFormState,
      categoryNames,
      brandNames
    );

    // ── Audit log ─────────────────────────────────────────────────────────────
    const filledFields = [
      extraction.agentName != null && "agentName",
      extraction.category != null && "category",
      extraction.purpose != null && "purpose",
      extraction.monthlyLimit != null && "monthlyLimit",
      extraction.perTransactionCap != null && "perTransactionCap",
      extraction.approvedMerchants != null && "approvedMerchants",
    ].filter(Boolean);

    console.log(
      JSON.stringify({
        event: "voice_fill",
        timestamp: new Date().toISOString(),
        transcript,
        filledFields,
        unresolvedFields: extraction.unresolvedFields,
        ambiguities: extraction.ambiguities ?? null,
      })
    );

    res.status(200).json({ success: true, extraction });
  } catch (error) {
    console.error("[extractMandateVoiceHandler] error:", error);

    const { message, status } = formatAiErrorMessage(error, "Mandate extraction failed.");
    res.status(status).json({ success: false, error: message });
  }
}

// ─── Multer error handler middleware ──────────────────────────────────────────

/**
 * Must be used as the fourth argument (err, req, res, next) after the
 * multer middleware + route handler so Express routes multer errors here.
 */
export function audioUploadErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    // e.g. LIMIT_FILE_SIZE
    res.status(413).json({ success: false, error: `Upload error: ${err.message}` });
    return;
  }
  // fileFilter rejection or other errors
  res.status(400).json({ success: false, error: err.message });
}
