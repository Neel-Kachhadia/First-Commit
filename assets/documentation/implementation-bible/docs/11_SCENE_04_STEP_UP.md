# 11 — Scene 04: Step-Up Clearance

## Final accepted interpretation

This scene is **retro clearance paperwork**, matching the final reference board.

Do not implement the earlier modern-SaaS hard-cut concept.

## Product behavior

A transaction exceeds automatic authority and needs one-time approval without permanently increasing the base limit.

Canonical example:

- Travel Agent
- ₹4,900
- Automatic limit ₹3,000

## Required copy

`TRAVEL AUTHORIZATION REQUEST`

`TRAVEL AGENT`

`₹4,900`

`AUTOMATIC LIMIT ₹3,000`

Red stamp:

`HOLD FOR CLEARANCE`

Secondary:

`REFER FOR APPROVAL`

Actions:

`CLEAR ONCE`

`DECLINE`

Supporting microcopy:

`HIGHER INTENT.`
`HUMAN CLEARANCE.`

No human should be shown even though the underlying product action represents human approval.

## Composition

Large single approval document centered in viewport.

Use a travel pictogram in a small printed box only.

## 3D treatment

One paper/receipt plane only.

The document may travel slowly toward camera, then stop decisively when the threshold is reached.

At the stop:

- tiny physical flex or settle
- shadow tightens slightly
- red `HOLD FOR CLEARANCE` stamp lands as DOM/SVG

Do not model a physical stamp tool.

The stamp itself is graphic; the paper is physical.

## Motion

0.00–0.18 — torn-edge wipe completes from Delegation.

0.18–0.38 — document aligns nearly square to viewport while moving slightly toward camera.

0.38–0.54 — amount prints large.

0.54–0.64 — automatic limit appears.

0.64–0.72 — document freezes; tiny paper settle.

0.72–0.82 — `HOLD FOR CLEARANCE` stamp impacts.

0.82–0.92 — `CLEAR ONCE` and `DECLINE` reveal.

0.92–1.00 — red stamp border becomes Revocation transition anchor.

## Interaction

For the landing page, do not require a click to continue. Scroll drives the story.

Optional enhancement: allow pointer hover/focus on `CLEAR ONCE` and `DECLINE`, but do not make the core narrative depend on interaction.

## Avoid

- floating UI
- phone mockup
- 3D stamp object
- person/hand interacting with the paper
- dramatic camera move
