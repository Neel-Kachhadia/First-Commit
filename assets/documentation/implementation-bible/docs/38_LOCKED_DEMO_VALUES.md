# 38 — Locked Demo Values and Product Examples

These values exist so the cinematic landing page remains internally consistent. They are demo/story values, not claims about universal product limits.

## Mandate

```text
Intent:
Buy groceries this week.

Weekly limit:
₹4,000

Step-up threshold:
> ₹1,500

Allowed category:
GROCERY

Blocked category:
ALCOHOL

Expiry:
SUN 23:59

Delegation depth:
2
```

Interpretation:

> The agent receives bounded permission, not a separate pool of new money.

## Three money decisions

### ALLOW

```text
Grocery Agent
₹1,249
GROCERY
APPROVED
```

Cinematic grammar: continuity. The action continues without celebration.

### STEP-UP

```text
Travel Agent
₹4,900
Automatic limit ₹3,000
HOLD FOR CLEARANCE
REFER FOR APPROVAL
CLEAR ONCE
DECLINE
```

Cinematic grammar: interruption / hold / clearance.

### DENY

```text
Shopping Agent
₹799
Blocked merchant/category
DENIED
```

Cinematic grammar: incomplete action / dead end.

## Delegation

Canonical product relationship:

```text
Shopping authority
₹4,000 weekly

Derived Grocery authority
up to ₹3,000 cap

Derived Delivery authority
up to ₹500 cap
```

Important invariant:

> Child authority is derived from parent authority. Delegation does not mint additional financial capacity.

If the final visual board uses a slightly different display number for compositional reasons, preserve the invariant and keep the product brief as the ultimate truth source.

## Revocation

```text
REVOKE: Shopping Agent

Shopping -> stops
Grocery descendant -> stops
Delivery descendant -> stops
Dependent pending action -> stops
Travel -> continues
```

The final continuing Travel state is essential; without it the sequence reads as system shutdown rather than lineage-aware revocation.

## Split-payment defense

```text
₹1,000
₹1,000
₹1,000

Same merchant
Same originating authority
Same purpose/context
Close timing

ONE ECONOMIC ACTION
BLOCKED / STEP-UP according to policy
```

## Concurrency

```text
₹500 REMAINING

Transaction A: ₹500
Transaction B: ₹500

A reserves the final ₹500

AVAILABLE: ₹0

B cannot execute
```

The scene communicates atomic budget consumption, not a decorative race.

## Causal Replay layer order

```text
MANDATE
↓
DELEGATION
↓
AGENT PATH
↓
BUDGET STATE
↓
DECISION
↓
EXECUTION
↓
PROVIDER RESULT
```

Replay should allow the visitor to reconstruct **why** the decision happened, not merely watch chronology run backward.
