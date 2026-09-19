import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { z } from "zod";

/**
 * Structured mandate extracted from natural language.
 *
 * Bedrock is only responsible for interpreting the user's
 * natural-language request. KavachPay's Authority Engine
 * remains responsible for the final financial decision.
 */
export const ExtractedMandateSchema = z.object({
  label: z.string().min(1),
  totalBudget: z.number().positive(),
  transactionMaximum: z.number().positive().optional(),
  currency: z.string().length(3),

  allowedMerchants: z.array(z.string()).default([]),
  blockedMerchants: z.array(z.string()).default([]),
  allowedCategories: z.array(z.string()).default([]),

  validityDays: z.number().positive().optional(),
});

export type ExtractedMandate = z.infer<
  typeof ExtractedMandateSchema
>;

const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ??
  "amazon.nova-lite-v1:0";

const client = new BedrockRuntimeClient({
  region:
    process.env.AWS_REGION ?? "ap-south-1",
});

const SYSTEM_PROMPT = `
You are the mandate extraction component of KavachPay.

Your ONLY responsibility is to convert a user's natural-language
financial mandate into structured data.

You are NOT an authorization engine.
You are NOT allowed to approve or deny payments.
You must never make a final financial authorization decision.

Return ONLY valid JSON matching this structure:

{
  "label": "string",
  "totalBudget": number,
  "transactionMaximum": number | null,
  "currency": "INR",
  "allowedMerchants": ["string"],
  "blockedMerchants": ["string"],
  "allowedCategories": ["string"],
  "validityDays": number | null
}

Rules:
- Extract only information explicitly stated or unambiguously implied.
- Use INR when the user specifies rupees or ₹.
- Do not invent merchants, categories, limits, or budgets.
- If a field is not specified, use an empty array or null.
- totalBudget is mandatory. If no total budget can be determined,
  return null for totalBudget rather than inventing one.
`;

export class BedrockService {
  async extractMandate(
    naturalLanguage: string
  ): Promise<ExtractedMandate> {
    if (
      !naturalLanguage ||
      naturalLanguage.trim().length === 0
    ) {
      throw new Error(
        "Natural-language mandate is required."
      );
    }

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,

      system: [
        {
          text: SYSTEM_PROMPT,
        },
      ],

      messages: [
        {
          role: "user",
          content: [
            {
              text: naturalLanguage.trim(),
            },
          ],
        },
      ],

      inferenceConfig: {
        temperature: 0,
        maxTokens: 500,
      },
    });

    const response = await client.send(command);

    const text =
      response.output?.message?.content
        ?.map((item) => item.text)
        .filter(
          (value): value is string =>
            typeof value === "string"
        )
        .join("")
        .trim();

    if (!text) {
      throw new Error(
        "Bedrock returned an empty mandate response."
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        "Bedrock returned invalid JSON for the mandate."
      );
    }

    return ExtractedMandateSchema.parse(parsed);
  }
}

export const bedrockService =
  new BedrockService();
