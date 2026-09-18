export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.VITE_API_BASE_URL ??
  "http://localhost:4000";
export const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ??
  process.env.VITE_DEMO_USER_ID ??
  "u_frontend_demo";

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

export const apiClient = {
  getExposure: async (userId: string = DEMO_USER_ID) => {
    const res = await fetch(`${API_BASE_URL}/v0/exposure?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch exposure");
    return res.json();
  },

  getGrants: async (userId: string = DEMO_USER_ID) => {
    const res = await fetch(`${API_BASE_URL}/v0/grants?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch grants");
    return res.json();
  },

  getLedger: async (userId: string = DEMO_USER_ID) => {
    const res = await fetch(`${API_BASE_URL}/v0/intents?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch ledger");
    return res.json();
  },

  createGrant: async (payload: CreateGrantPayload) => {
    const res = await fetch(`${API_BASE_URL}/v0/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, userId: DEMO_USER_ID }),
    });
    if (!res.ok) throw new Error("Failed to create grant");
    return res.json();
  },

  revokeGrant: async (grantId: string, userId: string = DEMO_USER_ID) => {
    const res = await fetch(`${API_BASE_URL}/v0/grants/${grantId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Failed to revoke grant");
    return res.json();
  },

  approveIntent: async (intentId: string) => {
    const res = await fetch(`${API_BASE_URL}/v0/intents/${intentId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, userId: DEMO_USER_ID }),
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId, userId: DEMO_USER_ID }),
    });
    if (!res.ok) {
      return res.json();
    }
    return res.json();
  },

  resetDemo: async (userId: string = DEMO_USER_ID) => {
    const res = await fetch(`${API_BASE_URL}/v0/demo/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Failed to reset demo");
    return res.json();
  },
};
