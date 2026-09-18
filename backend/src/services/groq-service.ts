import { z } from "zod";

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
  agentName: z.string().min(1).optional(),
  category: z.string().optional(),
  purpose: z.string().optional(),
  monthlyLimit: z.number().positive().optional(),
  perTransactionCap: z.number().positive().optional(),
  approvedMerchants: z.array(z.string()).optional(),
  unresolvedFields: z.array(z.string()).default([]),
  ambiguities: z.string().optional(),
});

export type MandateExtraction = z.infer<typeof MandateExtractionSchema>;

// ─── Groq API constants ───────────────────────────────────────────────────────

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const WHISPER_MODEL = "whisper-large-v3-turbo";
const NLU_MODEL = "openai/gpt-oss-120b";

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
 * Exact category labels the frontend uses (must stay in sync with
 * src/lib/kavach-data.ts CATEGORIES array).
 */
const VALID_CATEGORIES = [
  "Groceries",
  "Pharmacy / Healthcare",
  "Travel",
  "Retail & apparel",
  "Food delivery",
  "Utilities",
];

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
- unresolvedFields: JSON array of field name strings the user mentioned but whose value was unclear — ALWAYS include this key, use empty array [] if nothing is unresolved
- ambiguities: Optional string explaining unclear values

HARD RULES
1. NEVER guess a number. If a number's meaning is ambiguous, add the field name to unresolvedFields.
2. NEVER invent merchant names not explicitly stated by the user.
3. Omit any field that was not mentioned in the transcript.
4. Always include "unresolvedFields" — use [] if nothing is unresolved.
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
Return exactly: {"category":"Pharmacy / Healthcare","purpose":"Prescription and medicine purchases","monthlyLimit":3000,"perTransactionCap":800,"approvedMerchants":["PharmEasy","Blinkit"],"unresolvedFields":[]}
`.trim();

// ─── Groq Service ─────────────────────────────────────────────────────────────

export class GroqService {
  /**
   * Read the API key lazily at call-time so that dotenv.config() in app.ts
   * has already populated process.env before the key is first accessed.
   * (Module-level singletons are instantiated before dotenv runs.)
   */
  private get apiKey(): string {
    return process.env.GROQ_API_KEY ?? "";
  }

  private assertKeyConfigured(): void {
    if (!this.apiKey) {
      throw new Error(
        "Groq API key is not configured. Add GROQ_API_KEY to backend/.env."
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
    this.assertKeyConfigured();

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
        Authorization: `Bearer ${this.apiKey}`,
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
   * Extract mandate fields from a transcript using Groq Llama 3.3 70B.
   *
   * Returns only the fields the model is confident about (diff).
   * Ambiguous or unclear values land in unresolvedFields, never in
   * the diff itself.
   */
  async extractMandateFields(
    transcript: string,
    currentFormState: Partial<MandateFormState>
  ): Promise<MandateExtraction> {
    this.assertKeyConfigured();

    const userMessage = JSON.stringify({
      transcript,
      currentFormState,
    });

    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NLU_MODEL,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Groq Chat API error ${response.status}: ${errorBody}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawContent = data.choices?.[0]?.message?.content?.trim();
    if (!rawContent) {
      throw new Error("Groq returned an empty NLU response.");
    }

    // Strip markdown fences some models emit despite json_object mode
    const jsonText = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(
        `Groq returned invalid JSON for mandate extraction: ${jsonText.slice(0, 300)}`
      );
    }

    // Validate with Zod; fall back to a safe empty extraction rather than
    // crashing the whole request if a non-critical field has an unexpected type.
    const result = MandateExtractionSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    // Attempt a more lenient extraction by picking only the known-safe fields
    const raw = parsed as Record<string, unknown>;
    return MandateExtractionSchema.parse({
      agentName: typeof raw["agentName"] === "string" ? raw["agentName"] : undefined,
      category: typeof raw["category"] === "string" ? raw["category"] : undefined,
      purpose: typeof raw["purpose"] === "string" ? raw["purpose"] : undefined,
      monthlyLimit: typeof raw["monthlyLimit"] === "number" ? raw["monthlyLimit"] : undefined,
      perTransactionCap: typeof raw["perTransactionCap"] === "number" ? raw["perTransactionCap"] : undefined,
      approvedMerchants: Array.isArray(raw["approvedMerchants"])
        ? (raw["approvedMerchants"] as unknown[]).filter((v): v is string => typeof v === "string")
        : undefined,
      unresolvedFields: Array.isArray(raw["unresolvedFields"])
        ? (raw["unresolvedFields"] as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      ambiguities: typeof raw["ambiguities"] === "string" ? raw["ambiguities"] : undefined,
    });
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
