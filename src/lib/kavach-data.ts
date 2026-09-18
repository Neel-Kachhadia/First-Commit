export type AgentStatus = "active" | "exhausted" | "frozen" | "revoked";
export type LedgerStatus = "STEP_UP_REQUIRED" | "APPROVED" | "RESERVED" | "EXECUTED" | "DENIED" | "REVOKED" | "FAILED" | "PENDING";

export interface SpendingRule {
  monthlyLimit: number;
  perTransactionCap: number;
  category: string;
  merchants: string[];
  window: string;
  expiresOn?: string;
  allowDelegation?: boolean;
  delegationDepth?: number;
}

export interface Agent {
  id: string;
  name: string;
  mandateId: string;
  authorityId?: string;
  purpose: string;
  status: AgentStatus;
  consumed: number;
  rule: SpendingRule;
  issuedOn: string;
}

export interface LedgerEntry {
  id: string;
  agentId: string;
  merchant: string;
  description: string;
  amount: number;
  status: LedgerStatus;
  reason: string;
  at: string;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  ledgerId: string;
  merchant: string;
  description: string;
  amount: number;
  reason: string;
  requestedAt: string;
}

export interface AuthorityEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
  maxSpend: number;
}

export const CATEGORIES = [
  "Groceries",
  "Pharmacy / Healthcare",
  "Travel",
  "Retail & apparel",
  "Food delivery",
  "Utilities",
] as const;

export const seedAgents: Agent[] = [
  {
    id: "grocery",
    name: "Grocery Agent",
    mandateId: "MND-4471-GRC",
    authorityId: "AUTH-0302",
    purpose: "Weekly household restocking across approved grocery merchants.",
    status: "active",
    consumed: 1249,
    issuedOn: "2026-09-01",
    rule: {
      monthlyLimit: 4000,
      perTransactionCap: 1500,
      category: "Groceries",
      merchants: ["Blinkit", "BigBasket", "Zepto"],
      window: "Calendar month",
      expiresOn: "2026-09-30",
      allowDelegation: false,
      delegationDepth: 0,
    },
  },
  {
    id: "travel",
    name: "Travel Agent",
    mandateId: "MND-4472-TRV",
    authorityId: "AUTH-0303",
    purpose:
      "Books domestic flights and hotels within the approved travel authority.",
    status: "active",
    consumed: 0,
    issuedOn: "2026-09-02",
    rule: {
      monthlyLimit: 6000,
      perTransactionCap: 2500,
      category: "Travel",
      merchants: ["MakeMyTrip", "IRCTC", "Indigo"],
      window: "Calendar month",
      expiresOn: "2026-09-30",
      allowDelegation: false,
      delegationDepth: 0,
    },
  },
  {
    id: "shopping",
    name: "Shopping Agent",
    mandateId: "MND-4473-SHP",
    authorityId: "AUTH-0304",
    purpose: "Replenishes apparel and household retail orders.",
    status: "exhausted",
    consumed: 2000,
    issuedOn: "2026-08-28",
    rule: {
      monthlyLimit: 2000,
      perTransactionCap: 1500,
      category: "Retail & apparel",
      merchants: ["Amazon", "Myntra", "Ajio"],
      window: "Calendar month",
      expiresOn: "2026-09-30",
      allowDelegation: false,
      delegationDepth: 0,
    },
  },
  {
    id: "delivery",
    name: "Delivery Agent",
    mandateId: "MND-4474-DLV",
    authorityId: "AUTH-0305",
    purpose: "Places food delivery orders on standing instructions.",
    status: "revoked",
    consumed: 0,
    issuedOn: "2026-08-20",
    rule: {
      monthlyLimit: 1500,
      perTransactionCap: 600,
      category: "Food delivery",
      merchants: ["Swiggy", "Zomato"],
      window: "Calendar month",
      expiresOn: "2026-09-30",
      allowDelegation: false,
      delegationDepth: 0,
    },
  },
];

export const seedLedger: LedgerEntry[] = [
  {
    id: "txn-1090",
    agentId: "travel",
    merchant: "MakeMyTrip",
    description: "Delhi to Bengaluru flight, 24 Sep",
    amount: 4900,
    status: "PENDING",
    reason: "Above the ₹2,500 per-transaction cap — step-up approval required.",
    at: "2026-09-16T09:12:00+05:30",
  },
  {
    id: "txn-1089",
    agentId: "grocery",
    merchant: "BigBasket",
    description: "Monthly staples basket",
    amount: 1900,
    status: "PENDING",
    reason: "Above the ₹1,500 per-transaction cap — step-up approval required.",
    at: "2026-09-16T08:41:00+05:30",
  },
  {
    id: "txn-1088",
    agentId: "shopping",
    merchant: "Myntra",
    description: "Footwear order",
    amount: 799,
    status: "DENIED",
    reason: "Monthly authority of ₹2,000 already consumed.",
    at: "2026-09-15T19:24:00+05:30",
  },
  {
    id: "txn-1087",
    agentId: "grocery",
    merchant: "Blinkit",
    description: "Grocery purchase, 11 items",
    amount: 1249,
    status: "APPROVED",
    reason: "Within the ₹4,000 monthly grocery rule.",
    at: "2026-09-14T18:02:00+05:30",
  },
  {
    id: "txn-1086",
    agentId: "delivery",
    merchant: "Swiggy",
    description: "Dinner order attempt",
    amount: 320,
    status: "DENIED",
    reason: "Agent authority revoked on 12 Sep.",
    at: "2026-09-13T21:15:00+05:30",
  },
  {
    id: "txn-1085",
    agentId: "shopping",
    merchant: "Amazon",
    description: "Kitchen storage set",
    amount: 1450,
    status: "APPROVED",
    reason: "Within the ₹2,000 monthly retail rule.",
    at: "2026-09-09T12:30:00+05:30",
  },
  {
    id: "txn-1084",
    agentId: "shopping",
    merchant: "Ajio",
    description: "Cotton shirts, 2 units",
    amount: 550,
    status: "APPROVED",
    reason: "Within the ₹2,000 monthly retail rule.",
    at: "2026-09-04T16:45:00+05:30",
  },
];

export const seedApprovals: ApprovalRequest[] = [
  {
    id: "apr-221",
    agentId: "travel",
    ledgerId: "txn-1090",
    merchant: "MakeMyTrip",
    description: "Delhi to Bengaluru flight, 24 Sep",
    amount: 4900,
    reason: "Above the ₹2,500 per-transaction cap",
    requestedAt: "2026-09-16T09:12:00+05:30",
  },
  {
    id: "apr-220",
    agentId: "grocery",
    ledgerId: "txn-1089",
    merchant: "BigBasket",
    description: "Monthly staples basket",
    amount: 1900,
    reason: "Above the ₹1,500 per-transaction cap",
    requestedAt: "2026-09-16T08:41:00+05:30",
  },
];

export const seedHistory: AuthorityEvent[] = [
  {
    id: "ev-1",
    at: "2026-09-01T10:00:00+05:30",
    label: "Mandates issued",
    detail: "Four agents granted authority under the KavachPay mandate.",
    maxSpend: 13500,
  },
  {
    id: "ev-2",
    at: "2026-09-04T16:45:00+05:30",
    label: "Shopping Agent spent ₹550",
    detail: "Ajio order allowed within the retail rule.",
    maxSpend: 12950,
  },
  {
    id: "ev-3",
    at: "2026-09-09T12:30:00+05:30",
    label: "Shopping Agent spent ₹1,450",
    detail: "Amazon order allowed. Retail authority now exhausted.",
    maxSpend: 11500,
  },
  {
    id: "ev-4",
    at: "2026-09-12T11:05:00+05:30",
    label: "Delivery Agent revoked",
    detail: "₹1,500 of standing authority withdrawn by the account holder.",
    maxSpend: 10000,
  },
  {
    id: "ev-5",
    at: "2026-09-14T18:02:00+05:30",
    label: "Grocery Agent spent ₹1,249",
    detail: "Blinkit grocery purchase allowed within the ₹4,000 rule.",
    maxSpend: 8751,
  },
];

export const formatINR = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
