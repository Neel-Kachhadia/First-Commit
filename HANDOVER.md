# KavachPay Backend — Technical Handover Document

This document serves as the comprehensive handover for the KavachPay backend, detailing the completed architecture, security features, background workers, and how to operate the system locally and in AWS.

As of **September 18, 2026**, the core backend is **feature-complete, fully hardened, and frozen**.

---

## 1. System Architecture

KavachPay has migrated to a secure, AWS-native **AgentCore Architecture**. The primary flow for AI agents attempting to execute financial transactions is:

```mermaid
flowchart TD
    A[AI Agent] -->|MCP tools/call| B(AgentCore Gateway)
    B -->|Evaluation| C{Cedar Policy Engine}
    C -->|ALLOW (SigV4)| D[API Gateway]
    C -.->|DENY / LOG_ONLY| Z[Audit Log]
    D --> E[AWS Lambda]
    E --> F[KavachPay Target]
    F --> G{Authority Engine}
    G -->|Capacity Check| H[(DynamoDB Reservation)]
    H --> I[Razorpay]
```

### Key Security Boundaries
*   **AgentCore Gateway & Cedar**: The gateway intercepts all tool calls. Cedar policies evaluate if the specific agent is authorized to invoke a financial capability.
*   **IAM / SigV4 Authentication**: The target API Gateway requires SigV4 authorization. Direct internet invocation of agent tools (e.g., `/v0/agent-tools/create-payment`) will fail with a `401/403` unless appropriately signed by the AgentCore Gateway.
*   **Immutable KMS Receipts**: Every critical authorization decision generates an immutable `DecisionReceipt` cryptographically signed via AWS KMS (RSASSA-PSS-SHA-256).

---

## 2. Completed Capabilities (100%)

The backend provides a highly concurrent, defensively engineered financial state machine. The following core features are fully implemented and verified via 91 automated tests:

*   ✅ **Authority Graph & Effective Capacity**: Traverses the organizational hierarchy to determine real-time spending limits.
*   ✅ **Delegation Controls & Limits**: Parent authorities can delegate constrained limits to child grants.
*   ✅ **Atomic Reservation**: Uses DynamoDB `ConditionalCheckFailedException` for strict optimistic locking. Prevents limit overflows during concurrent payment attempts.
*   ✅ **Step-Up & Deny**: Emits structured requirements for multi-factor/manager approval (`AUTH_STEP_UP`).
*   ✅ **Revocation & Expiry**: Instant propagation of revoked access. Expiry sweeps automatically prune old grants.
*   ✅ **Replay Protection**: Prevents duplicate intents using idempotency locks.
*   ✅ **Razorpay Integration**: End-to-end payment creation and capture.
*   ✅ **Webhook Verification**: Validates Razorpay webhook signatures (`x-razorpay-signature`) and handles duplicate event idempotency.
*   ✅ **Audit**: Emits structured JSON events for all authorization actions.
*   ✅ **Payment Reconciliation Engine**: A robust state-reconciliation system with a dedicated DynamoDB GSI.

---

## 3. Background Workers (The "Nerve Center")

In AWS, these run via EventBridge Scheduler targeting Lambdas. Locally, they are orchestrated by `local-scheduler.ts` (mock EventBridge). 

> **Local Scheduler behavior:** When running `npm run dev`, the workers output to the terminal.
> *   **Expiry Sweep**: Runs immediately, then every 20s.
> *   **Invariant Monitor**: Runs immediately, then every 60s (health check for orphaned locks, limit overflows).
> *   **Reconciliation Sweep**: Runs every 5 minutes. Only processes stuck payments older than 60s. Emits quiet `RECONCILIATION_RETRY` metrics locally to avoid console spam.

---

## 4. DynamoDB Schema & Persistence

**Table Name**: `KavachPay_Test` (set via `DYNAMODB_TABLE_NAME` in `.env`)
**Design**: Single-table design (`PK`, `SK`).

### Key Entities:
1.  **Grant (`GRANT#<id>`)**: Defines a user's spending authority.
2.  **Intent (`INTENT#<id>`)**: The overarching transaction lifecycle record.
3.  **Payment (`PAYMENT#<id>`)**: The specific Razorpay external order.
4.  **Reservation (`RESERVATION#<id>`)**: The atomic lock holding funds during a pending payment.
5.  **Receipt (`RECEIPT#<id>`)**: The KMS-signed cryptographic proof of a decision.

### GSI (Global Secondary Index)
*   **Index Name**: `entityType-status-index`
*   **Usage**: Heavily utilized by the Reconciliation Worker to efficiently sweep for `PAYMENT_CREATED` payments without scanning the entire table.

---

## 5. Local Development & Testing

### Environment Variables (`backend/.env`)
Ensure you have the following configured:
```bash
AWS_REGION=ap-south-1
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
PORT=4000
KMS_KEY_ID=alias/kavachpay-receipt-signer
DYNAMODB_TABLE_NAME=KavachPay_Test
```

### Running the System
```bash
# Start backend (includes hot-reloading and background workers)
npm run dev

# Or start the entire monorepo (frontend + backend)
npm run dev:all
```

### Resetting the Demo Environment
If the database gets filled with old abandoned test payments, you can instantly wipe the state and re-seed the Master Demo Authority.
```bash
POST http://localhost:4000/v0/demo/reset
Content-Type: application/json

{ "userId": "u_frontend_demo" }
```

### Test Suite (91/91 Passing)
The test suite includes aggressive concurrency attack simulations (e.g. "The Atomic Limit Wall", "Concurrent Revocation Closure").
```bash
npm test
```

---

## 6. Next Steps / Remaining Work

The backend is considered frozen. The immediate next step for the team is purely **frontend integration**.

1.  **Verify Frontend UI**: Validate the React frontend against the deployed REST API.
2.  **Failure Case Testing via UI**: Ensure the frontend gracefully handles:
    *   Pending payments (Waiting on webhooks).
    *   Failed payments (e.g., test card declined).
    *   Expired grants (`AUTH_STEP_UP`).
    *   Manager Revocation mid-flight.

**Tip:** If UI testing encounters strange payment states, rely on the backend logs. The `InvariantMonitor` will explicitly highlight if any limits are breached, and the `metrics.ts` structured logs will output exact JSON payloads for `AUTH_ALLOW`, `AUTH_DENY`, and `RECONCILIATION_RETRY`.
