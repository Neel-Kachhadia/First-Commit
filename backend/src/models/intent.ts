import { z } from "zod";

export const IntentStatusSchema = z.enum([
  "PENDING",
  "STEP_UP_REQUIRED",
  "APPROVED",
  "DENIED",
  "RESERVED",
  "EXECUTED",
  "FAILED",
  "REVERSED",
]);

export const DecisionTypeSchema = z.enum([
  "ALLOW",
  "STEP_UP",
  "DENY",
]);

export const IntentSchema = z.object({
  intentId: z.string().min(1),

  userId: z.string().min(1),

  grantId: z.string().min(1),

  amount: z.number().positive(),

  currency: z.string().length(3).default("INR"),

  merchant: z.object({
    merchantId: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
  }),

  description: z.string().optional(),

  idempotencyKey: z.string().min(1),

  evidence: z
    .object({
      sourceProtocol: z.string().optional(),
      mandateRef: z.string().optional(),
      signedBy: z.string().optional(),
    })
    .optional(),

  status: IntentStatusSchema.default("PENDING"),

  createdAt: z.string().datetime(),

  expiresAt: z.string().datetime().optional(),
});

export type Intent = z.infer<typeof IntentSchema>;

export type IntentStatus =
  z.infer<typeof IntentStatusSchema>;

export type DecisionType =
  z.infer<typeof DecisionTypeSchema>;
