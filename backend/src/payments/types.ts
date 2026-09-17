/**
 * KavachPay — Payments Module Types
 *
 * This file defines types shared across the payment
 * execution layer. It does NOT import from the Authority
 * Engine or reservation logic.
 *
 * Internal financial values are in rupees (INR).
 * Conversion to Razorpay paise happens inside the adapter.
 */

// ---------------------------------------------------------------------------
// Payment status — mirrors intent lifecycle at the PSP layer.
// ---------------------------------------------------------------------------

export type PaymentStatus =
  | "PAYMENT_CREATED"
  | "EXECUTED"
  | "FAILED";

// ---------------------------------------------------------------------------
// Core interface — what the Authority Engine will eventually call.
// ---------------------------------------------------------------------------

export interface IPaymentService {
  /**
   * Execute a payment for a RESERVED intent.
   *
   * Does NOT make any authorization decision.
   * Assumes the intent has already been approved and
   * atomically reserved by the Authority Engine.
   */
  execute(intentId: string): Promise<PaymentResult>;
}

export interface PaymentResult {
  success: boolean;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// DynamoDB record — stored under PK: PAYMENT#<intentId>, SK: META
// ---------------------------------------------------------------------------

export interface PaymentRecord {
  intentId: string;
  userId: string;

  /**
   * Amount in rupees (INR) — KavachPay internal representation.
   * Razorpay adapter converts to paise when calling the API.
   */
  amount: number;

  currency: string;

  razorpayOrderId: string;
  razorpayPaymentId?: string;

  status: PaymentStatus;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Webhook types
// ---------------------------------------------------------------------------

/** Razorpay webhook event types that KavachPay handles. */
export type RazorpayWebhookEvent =
  | "payment.captured"
  | "payment.failed"
  | "order.paid";

/**
 * Shape of the Razorpay webhook payload.
 *
 * Only the fields KavachPay reads are declared here.
 * Razorpay may send additional fields; they are ignored.
 */
export interface RazorpayWebhookPayload {
  event: RazorpayWebhookEvent;
  payload: {
    payment?: {
      entity: {
        id: string;           // razorpayPaymentId
        order_id: string;     // razorpayOrderId
        amount: number;       // paise
        currency: string;
        status: string;
        notes?: Record<string, string>;
        error_code?: string;
        error_description?: string;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        notes?: Record<string, string>;
      };
    };
  };
}

/**
 * DynamoDB record for processed webhook events.
 * Stored under PK: WEBHOOK#<eventId>, SK: META
 * Used for idempotency — if we've seen this eventId, skip processing.
 */
export interface WebhookRecord {
  /** Razorpay's x-razorpay-event-id — primary idempotency key. */
  eventId: string;

  eventType: RazorpayWebhookEvent;

  /** razorpay payment entity ID, stored as secondary identity. */
  razorpayPaymentId?: string;

  /** razorpay order ID, stored as secondary identity. */
  razorpayOrderId?: string;

  intentId?: string;

  status: "PROCESSED" | "DUPLICATE" | "FAILED";

  processedAt: string;
}

export interface WebhookResult {
  /** Whether this event was newly processed (false if duplicate). */
  processed: boolean;
  duplicate: boolean;
  error?: string;
}
