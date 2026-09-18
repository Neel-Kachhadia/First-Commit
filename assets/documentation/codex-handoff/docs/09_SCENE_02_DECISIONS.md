# 09 — Scene 02: Allow / Step-Up / Deny

## Product behavior

Three requests resolve under the same system with different outcomes.

Canonical examples:

- ₹1,249 / GROCERY -> ALLOW
- ₹4,900 / TRAVEL -> STEP-UP
- ₹799 / BLOCKED MERCHANT -> DENY

## Composition

Use a full-width film/contact-sheet structure with three stacked lanes.

Each lane contains a transaction slip and outcome treatment.

## Motion grammar by outcome

### ALLOW = continuity

The lane moves continuously. The transaction slip enters, receives an `APPROVED` mark, and exits forward without stopping.

No celebratory bounce.

### STEP-UP = pause

The lane moves, then stops sharply.

A `STEP-UP REQUIRED` / `HOLD` treatment can appear within this scene because it is describing the intermediate decision state.

The actual dedicated clearance artifact comes in Scene 04.

### DENY = incomplete action

The lane advances, then fails to reach the exit edge. `DENIED` stamps in and the lane remains visibly incomplete.

## Scroll beats

0.00–0.15 — three lanes build from the Mandate rule transition.

0.15–0.40 — transaction slips enter with staggered timing.

0.40–0.62 — outcomes diverge.

0.62–0.82 — labels on right clarify: `ALLOWS LIFE TO MOVE`, `PAUSES FOR PERMISSION`, `STOPS WHAT SHOULDN'T GO THROUGH`.

0.82–1.00 — lanes compress laterally, preparing Delegation.

## Transition out

Use the vertical film-strip edge as the next scene's split axis.

The approved lane's paper shape expands into the main Shopping authority pass.

No page fade.

## Implementation

- DOM lanes
- CSS film perforation pattern via repeated-linear-gradient or SVG
- paper slips as DOM
- stamps as SVG/raster masks
- GSAP x/y transforms
- no video required

## Important

This scene should be among the fastest sections on the page. The difference between outcomes should be communicated through **timing**, not just text/color.
