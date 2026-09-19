import { fetchAuthSession } from "aws-amplify/auth";

export const API_BASE_URL = (
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  (typeof process !== "undefined" && (process.env as Record<string, string | undefined>)?.VITE_API_BASE_URL) ||
  "http://localhost:4000"
).replace(/\/+$/, "");

export const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ??
  process.env.VITE_DEMO_USER_ID ??
  "u_frontend_demo";

/**
 * Returns the current Cognito ID token for use as a Bearer token.
 * Returns null when the user is not authenticated.
 */
async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Builds auth headers for a fetch call. Injects Bearer token when available. */
async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export interface CreateGrantPayload {
  label: string;
  limit: number;
  currency: string;
  hardMax: number;
  stepUpAbove?: number;
  merchantAllow: string[];
  category: string;
  window: string;
  windowStart: string;
  delegationEnabled: boolean;
  parentGrantId?: string;
}

export interface SimulatePaymentPayload {
  amount: number;
  currency: string;
  grantId: string;
  merchant: {
    merchantId: string;
    name: string;
    category: string;
  };
  idempotencyKey: string;
}

// ── Voice-to-Form-Fill types ─────────────────────────────────────────────────

/** Diff returned by the NLU extraction step. Mirrors MandateExtractionSchema on the backend. */
export interface MandateExtraction {
  agentName: string | null;
  category: string | null;
  purpose: string | null;
  monthlyLimit: number | null;
  perTransactionCap: number | null;
  approvedMerchants: string[] | null;
  unresolvedFields: string[];
  ambiguities: string | null;
}

export interface MandateFormState {
  agentName?: string;
  category?: string;
  purpose?: string;
  monthlyLimit?: number;
  perTransactionCap?: number;
  approvedMerchants?: string[];
}

export const apiClient = {
  getExposure: async () => {
    const res = await fetch(`${API_BASE_URL}/v0/exposure`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch exposure");
    return res.json();
  },

  getGrants: async () => {
    const res = await fetch(`${API_BASE_URL}/v0/grants`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch grants");
    return res.json();
  },

  getLedger: async () => {
    const res = await fetch(`${API_BASE_URL}/v0/intents`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch ledger");
    return res.json();
  },

  createGrant: async (payload: CreateGrantPayload) => {
    const res = await fetch(`${API_BASE_URL}/v0/grants`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create grant");
    return res.json();
  },

  revokeGrant: async (grantId: string) => {
    const res = await fetch(`${API_BASE_URL}/v0/grants/${grantId}/revoke`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Failed to revoke grant");
    return res.json();
  },

  approveIntent: async (intentId: string) => {
    const res = await fetch(`${API_BASE_URL}/v0/intents/${intentId}/approve`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
    });
    if (!res.ok) throw new Error("Failed to approve intent");
    return res.json();
  },

  denyIntent: async (intentId: string) => {
    const res = await fetch(`${API_BASE_URL}/v0/intents/${intentId}/deny`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to deny intent");
    return res.json();
  },

  simulatePayment: async (payload: SimulatePaymentPayload) => {
    const res = await fetch(`${API_BASE_URL}/api/create-order`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    // Create order returns { success, intent, payment, razorpayOrderId } or an error.
    if (!res.ok) {
      // Return the error JSON instead of throwing so we can display reason
      return res.json();
    }
    return res.json();
  },

  executeOrder: async (intentId: string) => {
    const res = await fetch(`${API_BASE_URL}/api/execute-order`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ intentId }),
    });
    if (!res.ok) {
      return res.json();
    }
    return res.json();
  },

  resetDemo: async () => {
    const res = await fetch(`${API_BASE_URL}/v0/demo/reset`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Failed to reset demo");
    return res.json();
  },

  // ── Voice-to-Form-Fill ─────────────────────────────────────────────────────

  /**
   * Send a raw audio blob to the backend for Groq Whisper transcription.
   * Returns the transcript text.
   */
  transcribeAudio: async (audioBlob: Blob): Promise<{ success: boolean; text: string }> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.webm");
    const res = await fetch(`${API_BASE_URL}/api/assistant/transcribe`, {
      method: "POST",
      body: formData,
      // No Content-Type header — browser sets it with multipart boundary
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Transcription failed" }));
      throw new Error(err.error ?? "Transcription failed");
    }
    return res.json();
  },

  /**
   * Send a transcript + current form state to extract a mandate field diff.
   * Returns a MandateExtraction (only confident fields + unresolvedFields).
   */
  extractMandateFields: async (
    transcript: string,
    currentFormState: MandateFormState
  ): Promise<{ success: boolean; extraction: MandateExtraction }> => {
    const res = await fetch(`${API_BASE_URL}/api/assistant/extract-mandate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, currentFormState }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Extraction failed" }));
      throw new Error(err.error ?? "Extraction failed");
    }
    return res.json();
  },
};

