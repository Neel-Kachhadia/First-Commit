import { z } from "zod";

export const IntentStatusSchema = z.enum([
  "PENDING",
  "STEP_UP_REQUIRED",
  "APPROVED",
  "DENIED",
  "RESERVED",
  "PAYMENT_CREATED",
  "EXECUTED",
  "FAILED",
  "REVERSED",
]);

export const DecisionTypeSchema = z.enum([
  "ALLOW",
  "STEP_UP",
  "DENY",
]);

export const OrderItemSchema = z.union([
  z.string().transform((name) => ({ name, category: undefined as string | undefined })),
  z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    amount: z.number().optional(),
    quantity: z.number().int().positive().optional(),
  }),
]);

export type OrderItem = {
  name: string;
  category?: string;
  amount?: number;
  quantity?: number;
};

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

  items: z.array(OrderItemSchema).optional(),

  idempotencyKey: z.string().min(1),

  evidence: z
    .object({
      sourceProtocol: z.string().optional(),
      mandateRef: z.string().optional(),
      signedBy: z.string().optional(),
    })
    .optional(),

  /**
   * Server-derived provenance. Never accepted from an agent payload.
   * The backend sets this based on the authenticated calling context:
   *   AGENT_RUNTIME → IAM-gated AgentCore route
   *   USER_VOICE    → Cognito-authenticated voice workflow
   *   USER_UI       → Web checkout / frontend
   */
  origin: z
    .object({
      type: z.enum(["AGENT_RUNTIME", "USER_VOICE", "USER_UI"]),
      agentId: z.string().optional(),
      taskId: z.string().optional(),
      commandId: z.string().optional(),
    })
    .optional(),

  status: IntentStatusSchema.default("PENDING"),

  reason: z.string().optional(),

  reasonCode: z.string().optional(),

  blockedItem: z.string().optional(),

  blockedCategory: z.string().optional(),

  matchedPolicy: z.string().optional(),

  providerStatus: z.enum(["NOT_INVOKED", "INVOKED", "SKIPPED"]).optional(),

  createdAt: z.string().datetime(),

  expiresAt: z.string().datetime().optional(),
});

export type Intent = z.infer<typeof IntentSchema>;

export type IntentStatus =
  z.infer<typeof IntentStatusSchema>;

export type DecisionType =
  z.infer<typeof DecisionTypeSchema>;
