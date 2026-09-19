import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

// ─── Shared types ────────────────────────────────────────────────────────────

/**
 * Partial form state sent by the frontend so the extraction model
 * understands what is already filled and can avoid overwriting it
 * unless the user explicitly re-stated the value.
 */
export interface MandateFormState {
  agentName?: string;
  category?: string;
  purpose?: string;
  monthlyLimit?: number;
  perTransactionCap?: number;
  approvedMerchants?: string[];
}

/**
 * Diff returned by the NLU extraction step.
 *
 * Only fields the model is confident about are included.
 * Ambiguous or unclear values always land in `unresolvedFields`
 * rather than being guessed — wrong numbers on a finance form
 * are worse than empty fields.
 */
const numberOrNull = z.preprocess((val) => {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}, z.number().positive().nullable());

const stringOrNull = z.preprocess((val) => {
  if (val == null) return null;
  if (Array.isArray(val)) return val.join("; ");
  if (typeof val === "string") return val.trim() || null;
  return String(val);
}, z.string().nullable());

export const MandateExtractionSchema = z.object({
  agentName: z.string().min(1).nullable(),
  category: z.string().nullable(),
  purpose: z.string().nullable(),
  monthlyLimit: numberOrNull,
  perTransactionCap: numberOrNull,
  approvedMerchants: z.array(z.string()).nullable(),
  unresolvedFields: z.array(z.string()),
  ambiguities: stringOrNull,
});

export type MandateExtraction = z.infer<typeof MandateExtractionSchema>;

// ─── API constants ────────────────────────────────────────────────────────────

// Multi-model pools for resilience against single-model traffic spikes (503 UNAVAILABLE) and quota limits
const TRANSCRIPTION_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

const NLU_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

// ─── Runtime prompt builders ──────────────────────────────────────────────────
// All prompts are built at request-time from the dynamic category/brand lists
// fetched from DynamoDB, so adding a new category in the UI immediately
// affects what the voice-fill model understands.

function buildTranscriptionHint(brandNames: string[]): string {
  return `KavachPay, ${brandNames.join(", ")}, monthly limit, per transaction cap, lakh, crore`;
}

function buildExtractionPrompt(categories: string[], brandNames: string[]): string {
  const categoryChoices = categories.map((c) => `"${c}"`).join(" | ");
  const canonicalMerchants = brandNames.join(", ");

  return `
You are the voice-fill assistant for KavachPay, a financial mandate management platform.

Your ONLY job is to extract mandate fields from a spoken transcript and return a valid JSON object.

FIELD DEFINITIONS
- agentName: The name for the AI agent (e.g. "Pharmacy Agent", "Grocery Bot")
- category: Spending category. You MUST choose EXACTLY one value from this list (copy it verbatim):
  ${categoryChoices}
- purpose: A short description of what the agent is allowed to do (free text, 1-2 sentences)
- monthlyLimit: The periodic spending limit in INR as a plain integer (no currency symbol, no commas)
- perTransactionCap: The per-transaction ceiling in INR as a plain integer
- approvedMerchants: JSON array of merchant name strings the agent may spend at
- unresolvedFields: JSON array of field name strings the user mentioned but whose value was unclear
- ambiguities: string or null — explanation of any unclear values

HARD RULES
1. NEVER guess a number. If a number's meaning is ambiguous, add the field name to unresolvedFields.
2. NEVER invent merchant names not explicitly stated by the user.
3. For fields not mentioned in the transcript, return null.
4. Always include every field defined in the output schema. Use null for fields not mentioned or not confidently extractable. Use [] for unresolvedFields when nothing is unresolved.
5. Output ONLY the raw JSON object. No explanation, no markdown code fences.

MERCHANT NAME CORRECTIONS
Use canonical spellings when a transcript uses a phonetic variant:
- "Farm Easy" / "farm easy" / "farmeasy" → "PharmEasy"
- "Blink it" / "blinkit" → "Blinkit"
- "Big Basket" → "BigBasket"
- "Make My Trip" → "MakeMyTrip"
- "Jio mart" → "JioMart"
- "net meds" → "Netmeds"
- "1 mg" / "one mg" → "1mg"
- "Phone Pe" → "PhonePe"
Canonical brand list for reference: ${canonicalMerchants}

INDIAN NUMBER FORMATS
- "X lakh" → X × 100000 (e.g. "2 lakh" → 200000)
- "X crore" → X × 10000000
- "X thousand" → X × 1000

CURRENT FORM STATE
The user message includes a currentFormState JSON object. Do not overwrite already-filled fields unless the user explicitly stated a new value.

FEW-SHOT EXAMPLE
User says: "Allow Farm Easy and Blink it to spend up to 3000 rupees a month, 800 per transaction, for medicines"
Return exactly: {"category":"${categories[1] ?? categories[0] ?? ""}","purpose":"Prescription and medicine purchases","monthlyLimit":3000,"perTransactionCap":800,"approvedMerchants":["PharmEasy","Blinkit"],"unresolvedFields":[]}
`.trim();
}

// ─── Gemini Service ────────────────────────────────────────────────────────────

export class GroqService {
  /**
   * Read API key lazily at call-time so that dotenv.config() in app.ts
   * has already populated process.env before the key is first accessed.
   * (Module-level singletons are instantiated before dotenv runs.)
   */
  private get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY ?? "";
  }

  private get client(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: this.geminiApiKey });
  }

  private assertGeminiKeyConfigured(): void {
    if (!this.geminiApiKey) {
      throw new Error(
        "Gemini API key is not configured. Add GEMINI_API_KEY to backend/.env."
      );
    }
  }

  private isTransientError(err: unknown): boolean {
    if (!err) return false;
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes("503") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("high demand") ||
      msg.includes("429") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Rate limit") ||
      msg.includes("quota") ||
      msg.includes("Quota") ||
      msg.includes("exceeded") ||
      msg.includes("404") ||
      msg.includes("NOT_FOUND") ||
      msg.includes("no longer available") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("ECONNRESET")
    );
  }

  /**
   * Transcribe an audio buffer (webm/wav/mp3/ogg) to text using Gemini.
   *
   * @param audioBuffer  Raw audio bytes from the browser MediaRecorder
   * @param mimeType     MIME type reported by MediaRecorder (e.g. "audio/webm;codecs=opus")
   * @returns            Transcript text string
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
    brandNames: string[] = []
  ): Promise<string> {
    this.assertGeminiKeyConfigured();

    // Normalize MIME to a type Gemini's inline audio supports
    const normalizedMime = this.normalizeMime(mimeType);

    // Encode buffer as base64 for inline data
    const base64Audio = audioBuffer.toString("base64");

    let lastError: unknown;
    for (const model of TRANSCRIPTION_MODELS) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Transcribe the following audio accurately. This is Indian English audio about financial transactions and e-commerce. Use these correct spellings for brand names: ${buildTranscriptionHint(brandNames)}. Return ONLY the transcript text, nothing else.`,
                },
                {
                  inlineData: {
                    mimeType: normalizedMime,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        });

        const rawText = response.text?.trim();
        if (!rawText) {
          console.warn(
            `[Transcribe] Model ${model} returned empty transcript. Trying fallback model...`
          );
          continue;
        }

        // Layer 2: Post-transcription normalisation (alias map + Indian number expansion)
        return this.normaliseTranscript(rawText);
      } catch (err) {
        lastError = err;
        if (this.isTransientError(err)) {
          console.warn(
            `[Transcribe] Model ${model} returned transient error. Trying fallback model...`
          );
          continue;
        }
        throw err;
      }
    }

    throw (
      lastError ??
      new Error(
        "No speech detected in the recording. Please speak clearly into your microphone and try again."
      )
    );
  }

  /**
   * Extract mandate fields from a transcript via Gemini.
   *
   * Returns only the fields the model is confident about (diff).
   * Ambiguous or unclear values land in unresolvedFields, never in
   * the diff itself.
   */
  async extractMandateFields(
    transcript: string,
    currentFormState: Partial<MandateFormState>,
    categories: string[] = [],
    brandNames: string[] = []
  ): Promise<MandateExtraction> {
    this.assertGeminiKeyConfigured();

    const userMessage = JSON.stringify({ transcript, currentFormState });
    const systemPrompt = buildExtractionPrompt(categories, brandNames);

    let lastError: unknown;
    for (const model of NLU_MODELS) {
      try {
        const config: Record<string, unknown> = {
          systemInstruction: systemPrompt,
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        };

        if (!model.includes("lite")) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await this.client.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ text: userMessage }],
            },
          ],
          config,
        });

        const rawContent = response.text?.trim();
        console.log(`[NLU] Gemini (${model}) response:`, rawContent?.slice(0, 400));

        if (!rawContent) {
          throw new Error("Gemini returned empty content for mandate extraction.");
        }

        // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
        const jsonText = rawContent
          .replace(/^```(?:json)?\r?\n?/i, "")
          .replace(/\r?\n?```$/, "")
          .trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error(
            `Gemini returned invalid JSON for mandate extraction. Content: ${jsonText.slice(0, 200)}`
          );
        }

        const result = MandateExtractionSchema.safeParse(parsed);
        if (!result.success) {
          throw new Error(
            `Gemini response failed schema validation: ${result.error.message}`
          );
        }

        return result.data;
      } catch (err) {
        lastError = err;
        if (this.isTransientError(err)) {
          console.warn(
            `[NLU] Model ${model} returned transient error. Trying fallback model...`
          );
          continue;
        }
        throw err;
      }
    }

    throw (
      lastError ??
      new Error("All Gemini models are currently experiencing high demand. Please try again.")
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Normalize a browser MIME type to one Gemini's inline audio supports.
   * Supported: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac, audio/webm
   */
  private normalizeMime(mimeType: string): string {
    const base = mimeType.split(";")[0].trim().toLowerCase();
    const map: Record<string, string> = {
      "audio/webm": "audio/webm",
      "audio/ogg": "audio/ogg",
      "audio/wav": "audio/wav",
      "audio/wave": "audio/wav",
      "audio/mpeg": "audio/mp3",
      "audio/mp3": "audio/mp3",
      "audio/mp4": "audio/aac",
      "audio/x-m4a": "audio/aac",
      "audio/flac": "audio/flac",
    };
    return map[base] ?? "audio/webm";
  }


  /**
   * Layer 2: Normalise a raw Whisper transcript.
   *
   * - Fixes phonetic mis-spellings of Indian brand names via an alias map.
   * - Expands Indian number suffixes (lakh, crore, thousand) to plain integers
   *   so the LLU extractor can parse monetary values reliably.
   *
   * The alias map is intentionally ordered longest-match-first to avoid
   * partial replacements (e.g. "Make My Trip" before "Make My").
   */
  private normaliseTranscript(text: string): string {
    // ── Brand-name alias map ───────────────────────────────────────────────
    // Keys are lowercase regex-safe patterns; values are canonical spellings.
    const aliases: [RegExp, string][] = [
      // Pharmacies & Health
      [/\bfarm\s*[- ]?easy\b/gi, "PharmEasy"],
      [/\bfarmeasy\b/gi, "PharmEasy"],
      [/\bnet\s*meds\b/gi, "Netmeds"],
      [/\b1\s*mg\b/gi, "1mg"],
      [/\bapollo\s*pharmacy\b/gi, "Apollo Pharmacy"],
      [/\bmed\s*plus\b/gi, "MedPlus"],
      // Groceries
      [/\bblink\s*[- ]?it\b/gi, "Blinkit"],
      [/\bbig\s*basket\b/gi, "BigBasket"],
      [/\bjio\s*mart\b/gi, "JioMart"],
      [/\bswiggy\s*insta\s*mart\b/gi, "Swiggy Instamart"],
      // Food Delivery
      [/\bswiggy\b/gi, "Swiggy"],
      [/\bzomato\b/gi, "Zomato"],
      // Fashion & Lifestyle
      [/\bnykaa\b/gi, "Nykaa"],
      [/\bmeesho\b/gi, "Meesho"],
      [/\bmyntra\b/gi, "Myntra"],
      [/\bflipcart\b/gi, "Flipkart"],
      [/\bflip\s*kart\b/gi, "Flipkart"],
      // Travel
      [/\bmake\s*my\s*trip\b/gi, "MakeMyTrip"],
      [/\bclear\s*trip\b/gi, "Cleartrip"],
      [/\bgo\s*ibibo\b/gi, "Goibibo"],
      [/\bred\s*bus\b/gi, "RedBus"],
      // Transport
      [/\brapido\b/gi, "Rapido"],
      // Electronics
      [/\breliance\s*digital\b/gi, "Reliance Digital"],
      // Fintech
      [/\brazorpay\b/gi, "Razorpay"],
      [/\bphone\s*pe\b/gi, "PhonePe"],
      [/\bfi\s*money\b/gi, "Fi Money"],
      // Investments
      [/\bzerodha\b/gi, "Zerodha"],
      [/\bupstox\b/gi, "Upstox"],
      [/\bind\s*money\b/gi, "INDmoney"],
      [/\bsmall\s*case\b/gi, "Smallcase"],
    ];

    let normalised = text;
    for (const [pattern, replacement] of aliases) {
      normalised = normalised.replace(pattern, replacement);
    }

    // ── Indian number suffix expansion ────────────────────────────────────
    // Runs after alias substitution so "lakh" words aren't part of brand names.
    normalised = normalised
      // X crore(s) — must come before lakh to avoid partial match
      .replace(
        /(\d+(?:\.\d+)?)\s*crores?/gi,
        (_, n) => String(Math.round(parseFloat(n) * 10_000_000))
      )
      // X lakh(s)
      .replace(
        /(\d+(?:\.\d+)?)\s*lakhs?/gi,
        (_, n) => String(Math.round(parseFloat(n) * 100_000))
      )
      // X thousand(s)
      .replace(
        /(\d+(?:\.\d+)?)\s*thousands?/gi,
        (_, n) => String(Math.round(parseFloat(n) * 1_000))
      )
      // X hundred(s)  — only expand if preceded by a digit, avoid "a hundred" edge cases
      .replace(
        /(\d+(?:\.\d+)?)\s*hundreds?/gi,
        (_, n) => String(Math.round(parseFloat(n) * 100))
      );

    return normalised;
  }

}

export const groqService = new GroqService();
