# 03 — Product Truth

This file is the factual content boundary for the landing page. The full source brief is in `source/KavachPay_Product_Brief.html`.

## What KavachPay is

KavachPay is an **agentic money control plane** above agent-payment protocols and payment rails.

It is not:

- a payment gateway
- a UPI clone
- a wallet
- a new mandate protocol

Its distinctive layer is durable, stateful financial control across autonomous agents and transactions.

## Core flow

The product flow in the source brief is:

**Connect agent -> Create intent -> Compile contract -> Delegate authority -> Authorize / Step-Up / Deny -> Execute sandbox payment -> Record receipt -> Replay / Revoke**

The landing page does not have to mirror this as a software wizard, but scenes must remain consistent with it.

## Product behaviors that the landing page is allowed to dramatize

### Mandate
A principal defines a bounded contract such as:

- ₹4,000 weekly budget
- grocery category only
- blocked alcohol category
- step-up above ₹1,500
- expiry Sunday 23:59
- delegation enabled with maximum depth 2

### Decision outcomes
An intent can resolve as:

- ALLOW
- STEP_UP
- DENY

Example scenarios from the source brief:

- Grocery Agent ₹1,249 -> approved
- Travel Agent ₹4,900 -> step-up required
- Shopping Agent ₹799 -> denied because merchant/category is blocked

### Delegation accounting
Child authority is derived from parent authority. Delegation must not create additional spending capacity.

### Cumulative budget / concurrency
Budgets are stateful. Two agents racing for the final ₹500 must not both succeed. Budget is reserved atomically before payment execution.

### Revocation closure
Revoking a parent authority makes descendant authority non-executable. Unrelated authority must continue.

### Split-payment defense
Repeated smaller payments may be recognized as one evasive economic pattern, e.g. ₹1,000 + ₹1,000 + ₹1,000 under the same context.

### Blast radius
KavachPay can compute maximum reachable autonomous exposure while avoiding double-counting derived child authority.

### Causal replay / evidence
A completed decision can be reconstructed through:

- original intent / mandate
- delegation path
- payment intent
- stateful checks
- policy result
- provider execution/event
- decision receipt / evidence

## Claims boundary

The landing page must not imply that the hackathon build has:

- production autonomous UPI execution
- production Visa/Mastercard network credentials
- real-money autonomous payment execution
- bank-grade compliance certification

When payment execution is described in implementation/demo material, treat it as sandbox/test-mode unless the repository later contains verified production integration.

## AI boundary

LLMs may parse or explain intent. The source brief explicitly keeps final financial authorization deterministic; the LLM does not own the final money decision.
