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
  blockedCategories?: string[];
  blockedItems?: string[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  merchants: string[];
  source: "system" | "user";
  createdAt: string;
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

/**
 * Payload for POST /v0/intents.
 *
 * NOTE: `userId` is intentionally absent — the backend derives it from
 * `req.user.sub` (the verified Cognito ID token). Do not pass userId from
 * the frontend.
 *
 * `amount` is in rupees (not paise). The backend stores it as-is.
 */
export interface CreateIntentPayload {
  grantId: string;
  amount: number;
  merchant: {
    name: string;
    category: string;
  };
  description: string;
  idempotencyKey: string;
  items?: Array<{ name: string; category?: string; amount?: number; quantity?: number } | string>;
}

export interface CreateIntentResult {
  success: boolean;
  replayed?: boolean;
  intent: {
    intentId: string;
    status: string;
    amount: number;
    merchant: { name: string; category: string };
    grantId: string;
    createdAt: string;
  };
  decision: {
    decision: "ALLOW" | "DENY" | "STEP_UP";
    reason?: string;
    reasonCode?: string;
    blockedItem?: string;
    blockedCategory?: string;
    matchedPolicy?: string;
    providerStatus?: string;
  };
}


/** Diff returned by the NLU extraction step. Mirrors MandateExtractionSchema on the backend. */
export interface MandateExtraction {
  agentName: string | null;
  category: string | null;
  purpose: string | null;
  monthlyLimit: number | null;
  perTransactionCap: number | null;
  approvedMerchants: string[] | null;
  blockedCategories?: string[] | null;
  blockedItems?: string[] | null;
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
  blockedCategories?: string[];
  blockedItems?: string[];
}

export const apiClient = {
  getCategories: async (): Promise<Category[]> => {
    const res = await fetch(`${API_BASE_URL}/v0/categories`, {
      headers: await authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch categories: ${res.status}`);
    }
    const json = await res.json();
    // The backend uses 'slug' as the primary identifier, but frontend expects 'id'
    return json.categories.map((c: any) => ({ ...c, id: c.slug }));
  },

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
      headers: await authHeaders({ "Content-Type": "application/json" }),
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



  /**
   * Create a payment intent via POST /v0/intents.
   *
   * The backend derives `userId` from the verified Cognito ID token
   * (req.user.sub) — do NOT pass userId here.
   *
   * Returns the full intent + decision from the authority engine.
   * HTTP 200 → ALLOW, 202 → STEP_UP_REQUIRED, 403 → DENY.
   */
  createIntent: async (payload: CreateIntentPayload): Promise<CreateIntentResult> => {
    const res = await fetch(`${API_BASE_URL}/v0/intents`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        grantId: payload.grantId,
        amount: payload.amount,
        merchant: {
          merchantId: payload.merchant.name.trim(),
          name: payload.merchant.name.trim(),
          category: payload.merchant.category,
        },
        description: payload.description,
        idempotencyKey: payload.idempotencyKey,
      }),
    });
    // 200 ALLOW / 202 STEP_UP / 403 DENY are all valid business responses
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 403 && res.status !== 202) {
      throw new Error(json?.error ?? `Request failed with status ${res.status}`);
    }
    if (res.status === 403 && !json?.decision) {
      throw new Error(json?.error ?? "Forbidden: authorization error");
    }
    return json;
  },

  runAttackScenario: async (scenario: string): Promise<import("@/lib/attack-lab").ScenarioResponse> => {
    const res = await fetch(`${API_BASE_URL}/v0/demo/scenarios/${encodeURIComponent(scenario)}`, {
      method: "POST",
      headers: await authHeaders(),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Scenario failed (${res.status})`);
    return body;
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

  // ── Global Voice Command ───────────────────────────────────────────────────

  /**
   * Interpretation-only: parse a spoken transcript into a structured
   * VoiceWorkflow bundle. No mutations; does not require auth.
   */
  parseVoiceWorkflow: async (
    transcript: string
  ): Promise<{ success: boolean; workflow: import("./voice-workflow-types").VoiceWorkflow }> => {
    const res = await fetch(`${API_BASE_URL}/api/assistant/voice/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Voice parsing failed" }));
      throw new Error(err.error ?? "Voice parsing failed");
    }
    return res.json();
  },

  /**
   * Authenticated execution: send a confirmed VoiceWorkflow to the backend
   * for deterministic execution under the Cognito user's identity.
   * Returns per-action results and an overall status.
   */
  executeVoiceWorkflow: async (
    workflow: import("./voice-workflow-types").VoiceWorkflow,
    confirmedActions: string[]
  ): Promise<import("./voice-workflow-types").WorkflowExecutionResult> => {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_BASE_URL}/api/assistant/voice/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workflow, confirmedActions }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && !json?.results) {
      throw new Error(json?.error ?? "Workflow execution failed");
    }
    return json;
  },
};

