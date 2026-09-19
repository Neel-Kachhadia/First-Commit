# 08 — Scene 01: Mandate / Physical Document Hero

## Product behavior

A principal defines bounded financial capability for an agent.

Canonical example:

- GROCERY
- ₹4,000 / WEEK
- STEP-UP > ₹1,500
- NO ALCOHOL
- EXPIRES SUN 23:59
- DELEGATION > 2

## Reference composition

Large off-white spending mandate on black background.

Features:

- hanging/tag hole at top
- `KavachPay` serif mark
- `SPENDING MANDATE`
- oversized `GROCERY`
- horizontal rules
- red restriction icon/stamp
- KavachPay seal at bottom
- small tagline/detail copy

## 3D treatment

This is the first lightweight physical-stage scene.

Use 2–4 shallow planes, not a modelled environment.

Suggested stack:

- primary mandate plane at front
- narrow annotation strip behind
- optional film/photo fragment behind that
- optional thin rule plane in front

The camera should move only enough to reveal true parallax and physical shadows.

Do not orbit the document.

Do not turn it into a floating card showcase.

## Animation concept

The artifact should **assemble as a contract becomes exact**.

### Scroll beats

0.00–0.12 — physical stage fades/registers in; blank paper plane enters with slight skew and depth separation.

0.12–0.26 — `KavachPay / SPENDING MANDATE` prints in as crisp DOM/SVG aligned over the paper.

0.26–0.38 — `GROCERY` appears large, like a press impression.

0.38–0.66 — constraints reveal one rule at a time with fast horizontal registration wipes.

0.66–0.78 — red blocked-category mark stamps in with slight overshoot and ink texture.

0.78–0.90 — seal appears.

0.90–1.00 — camera makes a small forward/lateral settle; one horizontal rule becomes transition anchor.

## DOM/WebGL split

WebGL:

- paper planes
- depth
- shadow
- tiny bend
- camera parallax

DOM/SVG:

- all important text
- red symbols/stamps
- rule used for transition
- seal if crispness is better in SVG

## Transition out

Macro-expand one horizontal rule until it becomes a black divider crossing the full viewport.

That divider splits into the three horizontal decision lanes of Scene 02.

The transition must remain graphic; do not fly the 3D camera into Scene 02.

## Rejection conditions

Reject if it looks like:

- a settings form
- a legal document template
- a scrapbook prop
- a vintage computer printout
- a floating 3D card demo
