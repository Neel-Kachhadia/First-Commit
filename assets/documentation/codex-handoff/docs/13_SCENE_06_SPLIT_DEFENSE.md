# 13 — Scene 06: Split-Payment Defense

## Product behavior

KavachPay can correlate multiple smaller transactions into one suspicious economic pattern.

Canonical example:

- ₹1,000 at 10:03
- ₹1,000 at 10:06
- ₹1,000 at 10:09
- same merchant
- same agent
- same purpose

Result: one economic action -> blocked.

## Composition

Three receipt slips using the same merchant/context with different timestamps.

A larger paper fragment ultimately communicates:

`SAME MERCHANT.`
`SAME AGENT.`
`SAME PURPOSE.`

Large red stamp:

`ONE ECONOMIC ACTION`

Secondary red mark:

`BLOCKED`

## 3D treatment

This scene benefits from medium spatial depth.

The three receipts begin from different X/Y/Z positions and slight rotations.

They are not floating randomly. Each starts as an independent event.

As the system correlates them, the receipts converge until repeated fields align over one another.

The alignment itself is the visual insight.

Suggested initial placement:

```text
A: x=-0.7 y= 0.18 z=-0.12
B: x= 0.0 y= 0.00 z= 0.08
C: x= 0.7 y=-0.10 z=-0.20
```

## Motion

0.00–0.18 — first receipt enters.

0.18–0.32 — second.

0.32–0.46 — third.

0.46–0.64 — camera/receipts adjust so merchant/agent/purpose fields start lining up.

0.64–0.76 — repeated fields register exactly; shared DOM/SVG callouts reveal in red.

0.76–0.88 — three events visually resolve into one shared bounding composition.

0.88–0.95 — `ONE ECONOMIC ACTION` stamp.

0.95–1.00 — `BLOCKED` and hard/match cut to Concurrency.

## Key transition idea

The final shared bound should collapse into the single central `₹500 REMAINING` state of the next scene.

## Avoid

- particles
- graph lines
- fancy connection beams
- floating-card cloud
- generic fraud dashboard
