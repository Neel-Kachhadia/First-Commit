import { z } from "zod";

export const ContractStatusSchema = z.enum([
  "DRAFT",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "REVOKED",
  "EXPIRED",
]);

export const ContractSchema = z.object({
  contractId: z.string().min(1),

  /**
   * Principal who owns the authority.
   */
  principal: z.string().min(1),

  /**
   * Human/account holder associated with the authority.
   */
  holder: z.string().min(1),

  /**
   * Parent grant for delegated contracts.
   * Root contracts do not have a parent.
   */
  parentGrantId: z.string().optional(),

  label: z.string().min(1),

  budget: z.object({
    currency: z.string().length(3).default("INR"),

    limit: z.number().positive(),

    window: z.enum([
      "TRANSACTION",
      "DAILY",
      "WEEKLY",
      "MONTHLY",
    ]),

    windowStart: z.string().datetime(),

    consumed: z.number().nonnegative().default(0),
  }),

  perTransaction: z.object({
    hardMax: z.number().positive(),

    stepUpAbove: z
      .number()
      .positive()
      .optional(),
  }),

  scope: z.object({
    category: z.string().optional(),

    merchantAllow: z
      .array(z.string())
      .default([]),

    merchantDeny: z
      .array(z.string())
      .default([]),
  }),

  delegation: z.object({
    enabled: z.boolean().default(false),

    maxDepth: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    maxChildren: z
      .number()
      .int()
      .nonnegative()
      .default(0),
  }),

  expiresAt: z.string().datetime().optional(),

  status: ContractStatusSchema.default("DRAFT"),

  evidence: z.object({
    sourceProtocol: z
      .string()
      .optional(),

    mandateRef: z
      .string()
      .optional(),

    signedBy: z
      .string()
      .optional(),
  }),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export type Contract = z.infer<
  typeof ContractSchema
>;

export type ContractStatus =
  z.infer<typeof ContractStatusSchema>;
