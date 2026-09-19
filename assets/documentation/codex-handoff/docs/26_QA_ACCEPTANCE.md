# 26 — QA and Acceptance Gates

A scene is not done because it animates.

## Gate 1 — Product test

Ask:

**If all explanatory copy were removed, can the team still explain which KavachPay behavior generated this visual idea?**

If no, redesign.

## Gate 2 — Cinema/editorial test

Ask:

**Did we express the behavior through editing, timing, composition, type, paper, stamps, film grammar, and only purposeful physical depth rather than drawing software architecture?**

If no, redesign.

## Gate 3 — Necessity test

Ask:

**Could another AI-fintech startup replace the KavachPay logo and keep this exact scene?**

If yes, the scene is too generic.

## Gate 4 — Reference test

Compare to `source/KavachPay_Final_Visual_Reference.png`.

Reject drift toward:

- modern rounded cards
- glass panels
- gradient backgrounds
- generic floating 3D objects
- humans
- cities
- historical technology
- generic dark sci-fi

## Gate 5 — Physicality test

For 3D-enhanced scenes ask:

**Does the 3D make paper/film/receipts feel physically present, or does it announce itself as a WebGL trick?**

Reject if:

- camera orbits unnecessarily
- geometry becomes the hero
- paper floats without believable weight
- lighting looks sci-fi
- depth exists only for prestige
- complex modelling appears where planes would suffice

The desired reaction is:

> “This feels physically photographed.”

Not:

> “This is a Three.js demo.”

## Gate 6 — Transition test

Ask:

**Would the transition remain interesting if smooth scrolling were removed?**

If no, it is probably a scroll trick instead of good transition design.

## Gate 7 — Static-frame test

Pause at key timeline labels.

Every hero state should look intentional as a still frame.

## Gate 8 — Reverse-scroll test

Scroll forward and backward repeatedly.

There must be no:

- stuck stamps
- wrong outcomes
- duplicate elements
- unreversed opacity
- state mismatch
- jump in pin height
- 3D stage mismatch with DOM labels
- stale scene textures/objects

## Gate 9 — Responsive test

At 390px width:

- no overflow
- all amounts readable
- no copy hidden behind textures
- scenes remain understandable without desktop depth choreography

## Gate 10 — Reduced-motion test

With `prefers-reduced-motion: reduce`, all product meaning remains accessible.

## Gate 11 — Performance test

Use performance tooling and inspect:

- long tasks
- paint storms
- layout thrashing
- oversized images
- excessive texture layers
- WebGL texture memory
- DPR
- shadow cost
- replay post-processing cost

## No-go checklist

Automatic rejection if final page contains any of the following without explicit approval:

- visible human/hand/face/silhouette
- city skyline or unrelated environment
- CRT/old computer/tape/punch-card motif
- complex Three.js scene added only for visual prestige
- multiple separate heavy WebGL canvases
- generic glowing network graph
- glassmorphism
- floating SaaS cards
- arbitrary decorative particles
- 3D chrome or luxury objects
- hero coins/cards/shields/locks
- constant motion in every layer
- sepia filter used as the main source of “retro”


## Gate 12 — 10 / 10 / 10 checkpoint test

For every major scene, capture deterministic frames at approximately 0%, 25%, 50%, 75%, and 100% progress.

Every frame must survive as a standalone key visual.

Reject any scene with a weak intermediate composition.

See `36_10_10_10_QUALITY_RULE.md` for the full rubric.
