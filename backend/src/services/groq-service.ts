import { z } from "zod";
import { randomUUID } from "crypto";
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
  blockedCategories?: string[];
  blockedItems?: string[];
  expiresAt?: string;
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
  blockedCategories: z.array(z.string()).default([]),
  blockedItems: z.array(z.string()).default([]),
  expiresAt: stringOrNull, // ISO date string YYYY-MM-DD or null
  unresolvedFields: z.array(z.string()),
  ambiguities: stringOrNull,
});

export type MandateExtraction = z.infer<typeof MandateExtractionSchema>;

// ─── Voice Workflow schema ────────────────────────────────────────────────────

export const VoiceCreateMandateParamsSchema = z.object({
  label: z.string().default("Voice Mandate"),
  category: z.string().default("Groceries"),
  monthlyLimit: numberOrNull,
  perTransactionCap: numberOrNull,
  merchants: z.array(z.string()).default([]),
  purpose: z.string().default(""),
  window: z.enum(["TRANSACTION", "DAILY", "WEEKLY", "MONTHLY"]).default("MONTHLY"),
  blockedCategories: z.array(z.string()).default([]),
  blockedItems: z.array(z.string()).default([]),
});

export const VoiceCreateDelegationParamsSchema = z.object({
  label: z.string().default("Delegated Agent"),
  capacity: numberOrNull,
  parentActionId: z.string().default("A1"),
});

export const VoiceStartAgentParamsSchema = z.object({
  agentActionId: z.string().min(1),
});

export const VoiceOrderItemSchema = z.union([
  z.string().transform((name) => ({ name, category: undefined as string | undefined })),
  z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    amount: z.number().optional(),
    quantity: z.number().optional(),
  }),
]);

export const VoiceCreateOrderParamsSchema = z.object({
  merchant: z.string().default(""),
  category: z.string().default(""),
  items: z.array(VoiceOrderItemSchema).default([]),
  estimatedAmount: numberOrNull,
  agentActionId: z.string().default(""),
});

export const VoiceActionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("CREATE_MANDATE"),
    dependsOn: z.array(z.string()).default([]),
    params: VoiceCreateMandateParamsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("CREATE_DELEGATION"),
    dependsOn: z.array(z.string()).default([]),
    params: VoiceCreateDelegationParamsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("START_AGENT"),
    dependsOn: z.array(z.string()).default([]),
    params: VoiceStartAgentParamsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("CREATE_ORDER"),
    dependsOn: z.array(z.string()).default([]),
    params: VoiceCreateOrderParamsSchema,
  }),
]);

export const VoiceWorkflowSchema = z.object({
  commandId: z.string().min(1),
  actions: z.array(VoiceActionSchema).min(1),
  missingFields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type VoiceAction = z.infer<typeof VoiceActionSchema>;
export type VoiceWorkflow = z.infer<typeof VoiceWorkflowSchema>;

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
- blockedCategories: JSON array of uppercase prohibited category codes if explicitly blocked by the user (e.g. ["ALCOHOL", "TOBACCO", "GAMBLING"]). If none mentioned, return []
- blockedItems: JSON array of specific item/SKU names explicitly forbidden by the user (e.g. ["alcohol", "beer", "wine", "gift cards"]). If none mentioned, return []
- expiresAt: ISO date string (YYYY-MM-DD) for the mandate expiry date. Extract whenever the user mentions an expiry date, valid until date, or end date (e.g. "expiry date 21 September 2028" → "2028-09-21", "valid until 21st Sep 2028" → "2028-09-21", "valid until March 2026" → "2026-03-31", "1 year from now" → calculate from today). Today's date is ${new Date().toISOString().slice(0, 10)}. Return null if no expiry or duration was mentioned.
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

FEW-SHOT EXAMPLES
Example 1:
User says: "Allow Farm Easy and Blink it to spend up to 3000 rupees a month, 800 per transaction, for medicines"
Return exactly: {"agentName":null,"category":"${categories[1] ?? categories[0] ?? "Pharmacy / Healthcare"}","purpose":"Prescription and medicine purchases","monthlyLimit":3000,"perTransactionCap":800,"approvedMerchants":["PharmEasy","Blinkit"],"blockedCategories":[],"blockedItems":[],"expiresAt":null,"unresolvedFields":[],"ambiguities":null}

Example 2:
User says: "Grocery agent for Blinkit and Zepto, 5000 monthly, 1500 per transaction, block alcohol, expiry date would be 21 September 2028"
Return exactly: {"agentName":"Grocery agent","category":"${categories[0] ?? "Groceries"}","purpose":"Grocery orders via Blinkit and Zepto","monthlyLimit":5000,"perTransactionCap":1500,"approvedMerchants":["Blinkit","Zepto"],"blockedCategories":["ALCOHOL"],"blockedItems":["alcohol"],"expiresAt":"2028-09-21","unresolvedFields":[],"ambiguities":null}
`.trim();
}

function buildWorkflowExtractionPrompt(categories: string[], brandNames: string[]): string {
  const categoryChoices = categories.map((c) => `"${c}"`).join(" | ");
  const canonicalMerchants = brandNames.join(", ");

  return `
You are the workflow compiler for KavachPay, a financial authority management platform.
You will be given a spoken instruction (transcript) and must compile it into a structured, executable action bundle.

OUTPUT FORMAT
Return ONLY a single raw JSON object matching this exact schema. No explanation, no markdown fences.
{
  "commandId": "VCMD-<unique 6-char hex>",
  "actions": [ ...action objects... ],
  "missingFields": [ ...field names that are critical but absent from the transcript ],
  "warnings": [ ...non-blocking notes ]
}

ACTION TYPES
Each action must have: id ("A1", "A2", ...), type, dependsOn (array of action ids), params.

1. CREATE_MANDATE
   dependsOn: [] (always the root, no dependencies)
   params: { label, category, monthlyLimit, perTransactionCap, merchants, purpose, window, blockedCategories, blockedItems }
   - category MUST be one of: ${categoryChoices}
     * Household supplies, household essentials, stationery, electronics, apparel map to "Retail & apparel".
     * Groceries, food items map to "Groceries".
     * Medicines, prescription refills map to "Pharmacy / Healthcare".
   - window: "MONTHLY" | "WEEKLY" | "DAILY" (default "MONTHLY". If user says "weekly limit" or "per week", set "WEEKLY").
   - monthlyLimit and perTransactionCap: positive integers in INR. "lakh" = ×100000, "crore" = ×10000000. monthlyLimit represents the period authority amount.
   - perTransactionCap: The "automatic threshold", "auto-approval limit", "cap", or "per-transaction limit".
     CRITICAL: When the user mentions an "automatic threshold", "auto limit", "cap", or "per-transaction cap" (e.g. "weekly 10000 with automatic approval limit of 5000"), perTransactionCap MUST be set to that specific threshold (5000), which is less than the limit.
   - blockedCategories: array of UPPERCASE categories explicitly prohibited by the user (e.g. ["ALCOHOL"], ["TOBACCO"], ["GAMBLING"]). If user says "Alcohol is explicitly blocked", output: ["ALCOHOL"].
   - blockedItems: array of specific item names explicitly prohibited (e.g. ["Gift Card", "Lottery Ticket"]).
   - merchants: array of canonical merchant names from transcript.

2. CREATE_DELEGATION
   dependsOn: [id of CREATE_MANDATE it delegates from]
   params: { label, capacity, parentActionId }
   - capacity must NOT exceed the parent mandate's limit
   - label is the agent name (e.g. "Grocery Agent", "Shopping Bot")

3. START_AGENT
   dependsOn: [id of CREATE_DELEGATION or CREATE_MANDATE to activate]
   params: { agentActionId } — the id of the delegation/mandate to start
   Include START_AGENT if the user says "start", "activate", "launch" the agent.
   If no explicit start is mentioned but an order is requested, still include START_AGENT.

4. CREATE_ORDER
   dependsOn: [id of delegation/mandate + id of START_AGENT]
   params: { merchant, category, items, estimatedAmount, agentActionId }
   - Only include if user explicitly mentions ordering or purchasing specific items.
   - items: array of structured objects: [{ "name": "Notebooks", "category": "STATIONERY" }, { "name": "Earphone", "category": "ELECTRONICS" }, { "name": "Alcohol", "category": "ALCOHOL" }].
   - estimatedAmount: your best estimate for the items at the named merchant in INR.
   - category must match the parent mandate's category.

DEPENDENCY RULES
- CREATE_DELEGATION depends on CREATE_MANDATE
- START_AGENT depends on CREATE_DELEGATION (or CREATE_MANDATE if no delegation)
- CREATE_ORDER depends on START_AGENT (and CREATE_DELEGATION if present)

CANONICAL MERCHANT NAMES
Use correct spellings: ${canonicalMerchants}

MISSING FIELDS
If monthlyLimit or perTransactionCap is missing or unclear, add to missingFields: ["monthlyLimit"] or ["perTransactionCap"].
Do NOT guess critical financial values.

EXAMPLE 1
Transcript: "Create a grocery mandate for 4000 rupees a month, per transaction cap 1500, Blinkit and Zepto, delegate 2500 to Grocery Agent, order milk and eggs from Blinkit, start the agent"
Output:
{
  "commandId": "VCMD-ab12ef",
  "actions": [
    { "id": "A1", "type": "CREATE_MANDATE", "dependsOn": [], "params": { "label": "Grocery Mandate", "category": "${categories[0] ?? "Groceries"}", "monthlyLimit": 4000, "perTransactionCap": 1500, "merchants": ["Blinkit", "Zepto"], "purpose": "Weekly grocery shopping from approved merchants.", "window": "MONTHLY", "blockedCategories": [], "blockedItems": [] } },
    { "id": "A2", "type": "CREATE_DELEGATION", "dependsOn": ["A1"], "params": { "label": "Grocery Agent", "capacity": 2500, "parentActionId": "A1" } },
    { "id": "A3", "type": "START_AGENT", "dependsOn": ["A2"], "params": { "agentActionId": "A2" } },
    { "id": "A4", "type": "CREATE_ORDER", "dependsOn": ["A2", "A3"], "params": { "merchant": "Blinkit", "category": "${categories[0] ?? "Groceries"}", "items": [{ "name": "Milk", "category": "GROCERY" }, { "name": "Eggs", "category": "GROCERY" }], "estimatedAmount": 320, "agentActionId": "A2" } }
  ],
  "missingFields": [],
  "warnings": []
}

EXAMPLE 2
Transcript: "Create a pharmacy mandate for 10000 monthly with automatic threshold 2000 Apollo Pharmacy and PharmEasy"
Output:
{
  "commandId": "VCMD-cd34ef",
  "actions": [
    { "id": "A1", "type": "CREATE_MANDATE", "dependsOn": [], "params": { "label": "Pharmacy Mandate", "category": "${categories[1] ?? "Pharmacy / Healthcare"}", "monthlyLimit": 10000, "perTransactionCap": 2000, "merchants": ["Apollo Pharmacy", "PharmEasy"], "purpose": "Prescription refills and healthcare purchases.", "window": "MONTHLY", "blockedCategories": [], "blockedItems": [] } }
  ],
  "missingFields": [],
  "warnings": []
}

EXAMPLE 3
Transcript: "create a mandate named Retail Agent the category for this is HouseHold supplies. Create a absolute threshold of 10000 rupees weekly limit with automatic approval limit of 5000 rupees. The purpose is to buy household essentials from platforms like amazon zepto blinkit flipkart. The items to buy are notebooks diaries earphone alcohol. Alcohol is explicitly blocked. after creation of mandate launch the payment agent"
Output:
{
  "commandId": "VCMD-ef56ab",
  "actions": [
    {
      "id": "A1",
      "type": "CREATE_MANDATE",
      "dependsOn": [],
      "params": {
        "label": "Retail Agent",
        "category": "Retail & apparel",
        "window": "WEEKLY",
        "monthlyLimit": 10000,
        "perTransactionCap": 5000,
        "merchants": ["Amazon", "Zepto", "Blinkit", "Flipkart"],
        "purpose": "Buy household essentials from approved platforms.",
        "blockedCategories": ["ALCOHOL"],
        "blockedItems": []
      }
    },
    {
      "id": "A2",
      "type": "START_AGENT",
      "dependsOn": ["A1"],
      "params": { "agentActionId": "A1" }
    },
    {
      "id": "A3",
      "type": "CREATE_ORDER",
      "dependsOn": ["A1", "A2"],
      "params": {
        "merchant": "Amazon",
        "category": "Retail & apparel",
        "items": [
          { "name": "Notebooks", "category": "STATIONERY" },
          { "name": "Diaries", "category": "STATIONERY" },
          { "name": "Earphone", "category": "ELECTRONICS" },
          { "name": "Alcohol", "category": "ALCOHOL" }
        ],
        "estimatedAmount": 4200,
        "agentActionId": "A1"
      }
    }
  ],
  "missingFields": [],
  "warnings": ["Requested item 'Alcohol' falls under explicitly blocked category 'ALCOHOL'; this transaction will be rejected by policy at runtime."]
}
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

  /**
   * Parse a transcript into a structured multi-action VoiceWorkflow bundle.
   *
   * Understands: CREATE_MANDATE, CREATE_DELEGATION, START_AGENT, CREATE_ORDER.
   * Does NOT execute any mutations — parsing only.
   */
  async parseVoiceWorkflow(
    transcript: string,
    categories: string[] = [],
    brandNames: string[] = []
  ): Promise<VoiceWorkflow> {
    this.assertGeminiKeyConfigured();

    const systemPrompt = buildWorkflowExtractionPrompt(categories, brandNames);
    const commandId = `VCMD-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
    const userMessage = JSON.stringify({ transcript, commandId });

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
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          config,
        });

        const rawContent = response.text?.trim();
        console.log(`[VoiceWorkflow] Gemini (${model}) response:`, rawContent?.slice(0, 600));

        if (!rawContent) {
          throw new Error("Gemini returned empty content for workflow extraction.");
        }

        const jsonText = rawContent
          .replace(/^```(?:json)?\r?\n?/i, "")
          .replace(/\r?\n?```$/, "")
          .trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error(
            `Gemini returned invalid JSON for workflow extraction. Content: ${jsonText.slice(0, 300)}`
          );
        }

        // Ensure commandId is present (model may omit it)
        if (parsed && typeof parsed === "object" && !(parsed as Record<string, unknown>).commandId) {
          (parsed as Record<string, unknown>).commandId = commandId;
        }

        const result = VoiceWorkflowSchema.safeParse(parsed);
        if (!result.success) {
          throw new Error(
            `Gemini workflow response failed schema validation: ${result.error.message}`
          );
        }

        const data = result.data;
        const missing = new Set(data.missingFields ?? []);
        for (const action of data.actions) {
          if (action.type === "CREATE_MANDATE") {
            if (action.params.monthlyLimit == null) missing.add("monthlyLimit");
            if (action.params.perTransactionCap == null) missing.add("perTransactionCap");
          } else if (action.type === "CREATE_DELEGATION") {
            if (action.params.capacity == null) missing.add("capacity");
          } else if (action.type === "CREATE_ORDER") {
            if (action.params.estimatedAmount == null) missing.add("estimatedAmount");
            if (!action.params.items || action.params.items.length === 0) missing.add("items");
          }
        }
        data.missingFields = Array.from(missing);

        return data;
      } catch (err) {
        lastError = err;
        if (this.isTransientError(err)) {
          console.warn(
            `[VoiceWorkflow] Model ${model} returned transient error. Trying fallback...`
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
