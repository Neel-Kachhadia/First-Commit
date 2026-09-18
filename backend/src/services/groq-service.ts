import { z } from "zod";
import { MANDATE_CATEGORIES } from "../utils/categories.js";

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
export const MandateExtractionSchema = z.object({
  agentName: z.string().min(1).nullable(),
  category: z.string().nullable(),
  purpose: z.string().nullable(),
  monthlyLimit: z.number().positive().nullable(),
  perTransactionCap: z.number().positive().nullable(),
  approvedMerchants: z.array(z.string()).nullable(),
  unresolvedFields: z.array(z.string()),
  ambiguities: z.string().nullable(),
});

// ─── Strict JSON Schema for Groq Structured Outputs ──────────────────────────
// All properties are required and nullable (not optional) so Groq strict mode
// can enforce the schema at the model layer.  This eliminates the
// "Generated JSON does not match the expected schema" error class.

const MANDATE_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    agentName: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    purpose: { type: ["string", "null"] },
    monthlyLimit: { type: ["number", "null"] },
    perTransactionCap: { type: ["number", "null"] },
    approvedMerchants: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    unresolvedFields: {
      type: "array",
      items: { type: "string" },
    },
    ambiguities: { type: ["string", "null"] },
  },
  required: [
    "agentName",
    "category",
    "purpose",
    "monthlyLimit",
    "perTransactionCap",
    "approvedMerchants",
    "unresolvedFields",
    "ambiguities",
  ],
  additionalProperties: false,
} as const;

export type MandateExtraction = z.infer<typeof MandateExtractionSchema>;

// ─── API constants ────────────────────────────────────────────────────────────

// Groq is used exclusively for Whisper (audio transcription) — it is the only
// service that offers the Whisper endpoint at an acceptable quality/price point.
const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const WHISPER_MODEL = "whisper-large-v3-turbo";

// NLU (text extraction) is routed through OpenRouter so we can use free models.
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/**
 * Ordered list of free OpenRouter models to try for NLU extraction.
 * On a 429 (rate-limit) or 5xx the next model is tried automatically.
 * Add / reorder entries here to tune the fallback preference.
 */
const NLU_MODELS = [
  // ── Confirmed working ─────────────────────────────────────────────────────
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", // 256K ctx ✓
  // ── Largest / highest quality ────────────────────────────────────────────
  "nvidia/nemotron-3-ultra-550b-a55b:free",       // 550B MoE, 1M ctx
  "nvidia/nemotron-3-super-120b-a12b:free",        // 120B MoE, 262K ctx
  "nvidia/nemotron-3.5-lightning:free",            // 1M ctx
  // ── Google Gemma 4 ───────────────────────────────────────────────────────
  "google/gemma-4-31b-it:free",                   // 31B, 262K ctx
  "google/gemma-4-26b-a4b-it:free",               // 26B MoE, 262K ctx
  // ── Qwen 3 ───────────────────────────────────────────────────────────────
  "qwen/qwen3.8-27b:free",                        // 27B, 262K ctx
  // ── DeepSeek ─────────────────────────────────────────────────────────────
  "deepseek/deepseek-v4-flash-0731:free",         // 1M ctx
  // ── Poolside ─────────────────────────────────────────────────────────────
  "poolside/laguna-s-2.1:free",                   // 262K ctx
  "poolside/laguna-xs-2.1:free",                  // 262K ctx
  // ── Nex AGI ──────────────────────────────────────────────────────────────
  "nex-agi/nex-n2.5-pro:free",                    // 262K ctx
  "nex-agi/nex-n2.5-mini:free",                   // 262K ctx
  // ── ThinkingMachines (small, agentic-safe variant) ───────────────────────
  "thinkingmachines/inkling-small:free",          // 1M ctx (smaller variant)
  // ── Dots / Cohere ────────────────────────────────────────────────────────
  "dots-studio/dots-3-note-preview:free",         // 512K ctx
  "cohere/north-mini-code:free",                  // 256K ctx
] as const;

/**
 * Seed the Whisper beam-search decoder with domain-specific spellings.
 * This biases the ASR toward the correct spellings of Indian brand names
 * and fintech terms without restricting what the model can transcribe.
 */
const WHISPER_PROMPT =
  "KavachPay, PharmEasy, Blinkit, Zepto, BigBasket, JioMart, Nykaa, Myntra, Meesho, " +
  "Swiggy, Zomato, Dunzo, Ola, Uber, MakeMyTrip, Cleartrip, Goibibo, Yatra, RedBus, " +
  "Rapido, Porter, Delhivery, Shadowfax, Ecom Express, Flipkart, Amazon, AJIO, " +
  "Tata Cliq, Reliance Digital, Croma, Vijay Sales, Decathlon, " +
  "Razorpay, Paytm, PhonePe, Google Pay, CRED, Jupiter, Fi Money, " +
  "Groww, Zerodha, Upstox, INDmoney, Smallcase, Navi, Slice, OneCard, " +
  "Healthcare, Groceries, Travel, Food & Dining, Entertainment, Software & Tools, " +
  "Office Supplies, Utilities, General, monthly limit, per transaction cap, lakh, crore";

// ─── System prompt for NLU extraction ────────────────────────────────────────

/**
 * Canonical Indian merchant/brand reference for the LLM.
 * Keeps the model from hallucinating or mis-spelling brand names that
 * Whisper may have partially mis-transcribed.
 */
const CANONICAL_MERCHANTS = [
  // Pharmacies & Health
  "PharmEasy", "Netmeds", "1mg", "Apollo Pharmacy", "MedPlus",
  // Groceries
  "Blinkit", "Zepto", "BigBasket", "JioMart", "Dunzo", "Swiggy Instamart",
  // Food Delivery
  "Swiggy", "Zomato",
  // Fashion & Lifestyle
  "Myntra", "Nykaa", "Meesho", "AJIO", "Flipkart", "Amazon",
  // Travel
  "MakeMyTrip", "Cleartrip", "Goibibo", "Yatra", "RedBus", "Ola", "Uber", "Rapido",
  // Electronics & Appliances
  "Reliance Digital", "Croma", "Vijay Sales", "Decathlon",
  // Fintech
  "Razorpay", "Paytm", "PhonePe", "CRED", "Jupiter", "Fi Money",
  // Investments
  "Groww", "Zerodha", "Upstox", "INDmoney", "Navi",
].join(", ");

/**
 * Category labels — imported from the shared source of truth so backend
 * and frontend always stay in sync without any manual copying.
 */
const VALID_CATEGORIES: readonly string[] = MANDATE_CATEGORIES;

const EXTRACTION_SYSTEM_PROMPT = `
You are the voice-fill assistant for KavachPay, a financial mandate management platform.

Your ONLY job is to extract mandate fields from a spoken transcript and return a valid JSON object.

FIELD DEFINITIONS
- agentName: The name for the AI agent (e.g. "Pharmacy Agent", "Grocery Bot")
- category: Spending category. You MUST choose EXACTLY one value from this list (copy it verbatim):
  ${VALID_CATEGORIES.map((c) => `"${c}"`).join(" | ")}
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
Canonical brand list for reference: ${CANONICAL_MERCHANTS}

INDIAN NUMBER FORMATS
- "X lakh" → X × 100000 (e.g. "2 lakh" → 200000)
- "X crore" → X × 10000000
- "X thousand" → X × 1000

CURRENT FORM STATE
The user message includes a currentFormState JSON object. Do not overwrite already-filled fields unless the user explicitly stated a new value.

FEW-SHOT EXAMPLE
User says: "Allow Farm Easy and Blink it to spend up to 3000 rupees a month, 800 per transaction, for medicines"
Return exactly: {"category":"${VALID_CATEGORIES[1]}","purpose":"Prescription and medicine purchases","monthlyLimit":3000,"perTransactionCap":800,"approvedMerchants":["PharmEasy","Blinkit"],"unresolvedFields":[]}
`.trim();

// ─── Groq Service ─────────────────────────────────────────────────────────────

export class GroqService {
  /**
   * Read API keys lazily at call-time so that dotenv.config() in app.ts
   * has already populated process.env before the keys are first accessed.
   * (Module-level singletons are instantiated before dotenv runs.)
   */
  private get groqApiKey(): string {
    return process.env.GROQ_API_KEY ?? "";
  }

  private get openRouterApiKey(): string {
    return process.env.OPENROUTER_API_KEY ?? "";
  }

  private assertGroqKeyConfigured(): void {
    if (!this.groqApiKey) {
      throw new Error(
        "Groq API key is not configured. Add GROQ_API_KEY to backend/.env."
      );
    }
  }

  private assertOpenRouterKeyConfigured(): void {
    if (!this.openRouterApiKey) {
      throw new Error(
        "OpenRouter API key is not configured. Add OPENROUTER_API_KEY to backend/.env."
      );
    }
  }

  /**
   * Transcribe an audio buffer (webm/wav/mp3/ogg) to text using Groq Whisper.
   *
   * @param audioBuffer  Raw audio bytes from the browser MediaRecorder
   * @param mimeType     MIME type reported by MediaRecorder (e.g. "audio/webm;codecs=opus")
   * @returns            Transcript text string
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    this.assertGroqKeyConfigured();

    // Derive a file extension Groq recognises from the MIME type
    const extension = this.mimeToExtension(mimeType);

    const formData = new FormData();
    // Copy buffer bytes into a plain ArrayBuffer so Blob's BlobPart constraint
    // is satisfied — Node Buffer's underlying .buffer may be SharedArrayBuffer.
    const arrayBuffer: ArrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: mimeType });
    formData.append("file", blob, `audio.${extension}`);
    formData.append("model", WHISPER_MODEL);
    formData.append("response_format", "json");
    // Hint for Indian English
    formData.append("language", "en");
    // Layer 1: Bias Whisper's beam-search decoder toward domain-specific spellings
    formData.append("prompt", WHISPER_PROMPT);

    const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.groqApiKey}`,
        // Do NOT set Content-Type manually — fetch sets it with the boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Groq Whisper API error ${response.status}: ${errorBody}`
      );
    }

    const data = (await response.json()) as { text?: string };
    const rawText = data.text?.trim();

    if (!rawText) {
      throw new Error("Groq Whisper returned an empty transcript.");
    }

    // Layer 2: Post-transcription normalisation (alias map + Indian number expansion)
    return this.normaliseTranscript(rawText);
  }

  /**
   * Extract mandate fields from a transcript via OpenRouter (free model).
   *
   * Returns only the fields the model is confident about (diff).
   * Ambiguous or unclear values land in unresolvedFields, never in
   * the diff itself.
   */
  async extractMandateFields(
    transcript: string,
    currentFormState: Partial<MandateFormState>
  ): Promise<MandateExtraction> {
    this.assertOpenRouterKeyConfigured();

    const userMessage = JSON.stringify({ transcript, currentFormState });
    const headers = {
      Authorization: `Bearer ${this.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kavachpay.local",
      "X-Title": "KavachPay",
    };

    const lastErrors: string[] = [];

    for (const model of NLU_MODELS) {
      let response: Response;
      try {
        response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
            temperature: 0,
            max_tokens: 800,
            // No response_format — not universally supported across OpenRouter models.
            // The system prompt instructs the model to return raw JSON only.
          }),
        });
      } catch (networkErr) {
        const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
        console.warn(`[NLU] Network error with model ${model}: ${msg}`);
        lastErrors.push(`${model}: network error — ${msg}`);
        continue;
      }

      // Skip to next model on rate-limit, forbidden, or server errors
      if (response.status === 429 || response.status === 403 || response.status >= 500) {
        const body = await response.text();
        console.warn(`[NLU] Model ${model} returned ${response.status} — trying next. Body: ${body.slice(0, 200)}`);
        lastErrors.push(`${model}: HTTP ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter Chat API error ${response.status} (${model}): ${body}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      console.log(`[NLU] Using model: ${model} | response:`, JSON.stringify(data).slice(0, 400));

      if (data.error?.message) {
        console.warn(`[NLU] Model ${model} returned API error: ${data.error.message} — trying next.`);
        lastErrors.push(`${model}: ${data.error.message}`);
        continue;
      }

      const rawContent = data.choices?.[0]?.message?.content?.trim();
      if (!rawContent) {
        console.warn(`[NLU] Model ${model} returned empty content — trying next.`);
        lastErrors.push(`${model}: empty content`);
        continue;
      }

      // Strip <think>...</think> blocks (Qwen3 / reasoning models)
      const withoutThink = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      // Strip markdown code fences (```json ... ``` or ``` ... ```)
      const jsonText = withoutThink
        .replace(/^```(?:json)?\r?\n?/i, "")
        .replace(/\r?\n?```$/, "")
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        console.warn(`[NLU] Model ${model} returned invalid JSON — trying next. Content: ${jsonText.slice(0, 200)}`);
        lastErrors.push(`${model}: invalid JSON`);
        continue;
      }

      const result = MandateExtractionSchema.safeParse(parsed);
      if (!result.success) {
        console.warn(`[NLU] Model ${model} failed Zod validation — trying next. Error: ${result.error.message}`);
        lastErrors.push(`${model}: Zod validation failed`);
        continue;
      }

      return result.data;
    }

    // Every model in the chain failed
    throw new Error(
      `All NLU models failed. Errors:\n${lastErrors.join("\n")}`
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  private mimeToExtension(mimeType: string): string {
    const base = mimeType.split(";")[0].trim().toLowerCase();
    const map: Record<string, string> = {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/flac": "flac",
    };
    return map[base] ?? "webm"; // Groq default fallback
  }
}

export const groqService = new GroqService();
