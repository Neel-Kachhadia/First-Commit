# KavachPay — Agentic Money Control Plane

> **"Authority is not access. It is a bound contract."**

KavachPay is an enterprise control plane and guardrail infrastructure for autonomous AI agent payments. Instead of granting AI agents raw API keys, credit cards, or static banking credentials, KavachPay enforces **programmable financial authority**: cryptographically signed mandates, atomic concurrency walls, sub-delegations, negative constraint enforcement, and verifiable KMS decision receipts.

---

## Architecture Overview

```
                          ┌────────────────────────────────────────────────────────┐
                          │                   CLIENT INTERFACE                     │
                          │   Next.js 15 (App Router) • React 19 • WebGL Canvas   │
                          │   Voice Workflow • Causal Replay • Attack Labs         │
                          └───────────────────────────┬────────────────────────────┘
                                                      │ HTTPS / WSS
                                                      ▼
                          ┌────────────────────────────────────────────────────────┐
                          │               KAVACHPAY CONTROL PLANE                  │
                          │            Express.js • Node.js (TypeScript)           │
                          ├────────────────────────────────────────────────────────┤
                          │  • Intent State Machine & Policy Rule Engine           │
                          │  • Two-Phase Reservation Engine (Atomic Limit Wall)   │
                          │  • Gemini / Whisper Voice Workflow Graph Compiler      │
                          │  • Hierarchical Delegation & Revocation Tree           │
                          └───────┬───────────────────┬───────────────────┬────────┘
                                  │                   │                   │
                     AWS SDK v3   │        KMS PSS    │     REST / Webhook│
                                  ▼                   ▼                   ▼
                     ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
                     │   DynamoDB       │  │     AWS KMS      │  │    Razorpay     │
                     │  (Single-Table)  │  │ Decision Receipt │  │  Sandbox / VPA  │
                     │  ACID Locks      │  │  Signing (2048b) │  │ Card Simulator  │
                     └──────────────────┘  └──────────────────┘  └─────────────────┘
```

---

## Core Capabilities

### 1. Programmable Mandates & Dynamic Boundaries
- **Time-Windowed Velocity**: Rolling limits configured per `TRANSACTION`, `DAILY`, `WEEKLY`, or `MONTHLY` intervals.
- **Negative Item & Category Blacklisting**: Explicit policy rules blocking high-risk sectors (e.g., `ALCOHOL`, `GAMBLING`, `CRYPTO`) and specific item patterns (e.g., `Gift Card`, `Voucher`), evaluated prior to payment authorization.
- **Dual-Threshold Step-Up**: Distinguishes between automatic approvals (under cap) and step-up approvals requiring interactive human confirmation.

### 2. The Atomic Limit Wall (Concurrency Engine)
- Solves the multi-agent double-spend vulnerability where parallel sub-agents execute concurrent requests against a shared balance.
- Employs a two-phase reservation protocol backed by DynamoDB `TransactWrite` conditional expressions.
- Guarantees zero overdrafts and strict invariant safety under heavy concurrent load.

### 3. Hierarchical Delegation & Immediate Revocation
- Root mandates can spawn scoped sub-agent delegations with restricted sub-budgets.
- Sub-agent capacity is bounded by the parent grant.
- Revoking a root mandate triggers instant cascading revocation across all downstream delegations and pending reservations.

### 4. Cryptographically Signed KMS Decision Receipts
- Every authorization decision (`ALLOW`, `STEP_UP`, `DENY`) generates an immutable receipt.
- Receipts are signed via AWS KMS using asymmetric `RSASSA-PSS-SHA-256` keys.
- Creates a tamper-evident, cryptographically auditable trail for enterprise compliance.

### 5. Multi-Action Voice-to-Workflow Engine
- Natural language intent parser using Google Gemini and Groq Whisper.
- Compiles spoken instructions into dependency-ordered action graphs (`CREATE_MANDATE` → `CREATE_DELEGATION` → `START_AGENT` → `CREATE_ORDER`).
- Features real-time parameter validation, missing-field detection, inline completion, and re-recording controls.

### 6. Interactive Attack Labs
- Built-in live testing laboratory validating system invariants under adverse scenarios:
  1. **Atomic Limit Wall**: Rapid parallel burst attacks attempting balance exhaustion.
  2. **Concurrent Revocation**: Sub-millisecond race between authorization and grant revocation.
  3. **Idempotency Lock Collisions**: Duplicate payload rejection and replay defense.

---

## Repository Structure

```
First-Commit/
├── src/                          # Frontend Application (Next.js 15)
│   ├── app/                      # App Router pages & layout roots
│   │   ├── (dashboard)/          # Authenticated routes (Mandates, Rules, Activity, Attack Labs)
│   │   ├── auth/                 # Cognito sign-in & email verification flow
│   │   └── page.tsx              # Cinematic retro-financial landing experience
│   ├── components/               # React components
│   │   ├── cursor/               # Precision desktop custom cursor system
│   │   ├── experience/           # WebGL scenes & transition transport layers
│   │   ├── kavach/               # Decision dossier, causal replay & authority visualizers
│   │   ├── ui/                   # Shared UI primitives (Radix UI + Tailwind tokens)
│   │   └── voice/                # Global voice trigger, capture sheet & workflow review
│   ├── hooks/                    # Custom React hooks (voice capture, workflow state)
│   ├── lib/                      # Client API client, auth context, theme & utilities
│   └── routes/                   # Route-level view implementations
├── backend/                      # Control Plane API (Express + TypeScript)
│   ├── src/
│   │   ├── adapters/             # Protocol adapters (AP2 / Merchant integration)
│   │   ├── engine/               # Reservation engine, state machine, item restriction rules
│   │   ├── handlers/             # REST endpoints (auth, mandates, intents, assistant, profiles)
│   │   ├── models/               # Domain models (Grant, Intent, Receipt, PaymentProfile)
│   │   ├── payments/             # Razorpay settlement & card simulator bindings
│   │   ├── scripts/              # Demo database seeding & state resets
│   │   ├── services/             # Core business logic (KMS receipts, NLU compiler, DynamoDB)
│   │   └── store/                # DynamoDB repositories with transactional locking
│   └── tests/                    # Unit, invariant, and concurrency test suites (Vitest)
├── infrastructure/               # AWS CDK Stacks (TypeScript)
│   ├── lib/kavachpay-stack.ts    # DynamoDB (Single-Table), Cognito, KMS & Lambda definitions
│   └── bin/                      # CDK deployment entry point
└── tests/visual/                 # Playwright end-to-end and visual regression tests
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **AWS Account** *(Optional for local simulation)*: For Cognito and KMS in staging/production.
- **API Keys**:
  - `GEMINI_API_KEY` (Required for voice workflow extraction)
  - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` (For payment execution in Test Mode)

---

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/Neel-Kachhadia/First-Commit.git
cd First-Commit

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

---

### Step 2: Environment Configuration

#### 1. Backend (`backend/.env`)
Create `backend/.env` from `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Configure the following variables:
```env
PORT=4000
AWS_REGION=ap-south-1
DYNAMODB_TABLE_NAME=kavachpay-dev

# AI Services (Voice & Workflow Extraction)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# AWS KMS Signing Key (or mock for local development)
KMS_KEY_ID=alias/kavachpay-receipt-signer

# Cognito Configuration (from CDK output)
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_REGION=ap-south-1

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

#### 2. Frontend (`.env.local`)
Create `.env.local` in the project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_COGNITO_REGION=ap-south-1
```

---

### Step 3: Seed Demo Data

Initialize the local state with demo mandates, test payment profiles, and simulated transactions:

```bash
npm run demo:reset
```

---

### Step 4: Run the Development Environment

Run both the Next.js frontend (port 3000) and the Express backend (port 4000) concurrently:

```bash
npm run dev:all
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)
- **Health Check**: [http://localhost:4000/health](http://localhost:4000/health)

---

## Testing & Quality Assurance

### Backend Unit & Invariant Tests
KavachPay maintains a test suite covering invariant protection, concurrency locks, item restrictions, and KMS receipt signing.

```bash
# Run all backend tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch
```

### Visual & Transport Regression Tests
Playwright tests for desktop custom pointer systems, WebGL transport interactions, and cinematic scroll scenes:

```bash
# Run visual suite
npm run test:visual
```

### Type Checking & Linting
```bash
# Frontend type check
npx tsc --noEmit

# Backend type check
cd backend && npx tsc --noEmit
```

---

## Deploying Infrastructure (AWS CDK)

KavachPay's cloud infrastructure is defined as code using AWS CDK:
- **DynamoDB**: Single-table design (`kavachpay-dev`) with pay-per-request billing and PITR.
- **Cognito**: User pool with self-service verification and scoped client access.
- **KMS**: Asymmetric signing key for decision receipts.
- **API Gateway & Lambda**: Serverless backend runtime option.

To deploy to your AWS account:

```bash
cd infrastructure
npm install

# Synthesize CloudFormation template
npx cdk synth

# Deploy stack
npx cdk deploy
```

After deployment, copy the `UserPoolId`, `UserPoolClientId`, and `KmsKeyArn` outputs into your respective `.env` and `.env.local` configurations.

---

## Security Model & Guarantees

| Invariant | Implementation Mechanism | Failure Mode |
|---|---|---|
| **No Overdrafts** | Two-Phase Commit with DynamoDB `attribute_exists` & balance condition checks | Request fails atomically (`LIMIT_EXCEEDED`), 0 exposure |
| **Instant Revocation** | Root status checked within transaction pipeline | Subsequent intent evaluations rejected immediately (`GRANT_REVOKED`) |
| **Tamper Evidence** | Asymmetric RSASSA-PSS signature over SHA-256 intent digest | Invalid signature on receipt verification |
| **Deterministic Replay** | Immutable decision payload stored with input intent snapshots | Exact causal path reconstruction in audit telemetry |
| **Zero Blind Execution** | Voice graph compiler flags all ambiguous/unspecified numbers | Execution blocked until explicit user authorization |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
