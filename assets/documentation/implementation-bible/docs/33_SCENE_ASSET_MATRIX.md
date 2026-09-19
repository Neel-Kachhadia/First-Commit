# 33 — Scene Asset Matrix

This file tells the implementation agent exactly which master assets each scene is allowed to draw from.

## Global shared

- black stock background tile
- ivory paper family
- black ink imperfection
- red stamp ink mask
- sparse grain/dust overlay
- KavachPay wordmark
- shared pictogram set
- edge masks

## 00 — Prologue

Needs:

- wordmark
- black stock texture
- ivory rule
- subtle grain

No WebGL assets.

## 01 — Mandate

Needs:

- `paper_authority_heavy`
- torn/rough edge mask
- red restriction mark
- KavachPay seal
- optional background annotation strip
- optional one product-relevant film/photo plate
- paper roughness/normal

3D:

- 2–4 planes

## 02 — Decisions

Needs:

- film/contact-sheet border
- transaction receipt template
- APPROVED stamp
- HOLD/STEP-UP treatment
- DENIED stamp
- grocery/travel/merchant pictograms or narrow photo plates

3D:

- optional only

## 03 — Delegation

Needs:

- authority pass template
- derived authority pass template
- perforation mask
- basket + scooter pictograms
- paper roughness/normal

3D:

- parent plane
- Grocery plane
- Delivery plane

## 04 — Step-Up

Needs:

- travel authorization template
- airplane pictogram
- HOLD FOR CLEARANCE stamp
- REFER FOR APPROVAL line
- CLEAR ONCE / DECLINE live text
- paper roughness/normal

3D:

- one authorization plane

## 05 — Revocation

Needs:

- film/document strip master
- REVOKED stamp
- red X mark
- Shopping/Grocery/Delivery/Travel labels
- optional travel sky/runway plate

3D:

- four shallow strip planes

## 06 — Split-Payment Defense

Needs:

- transaction receipt template ×3 instances
- merchant/agent/purpose data
- ONE ECONOMIC ACTION stamp
- BLOCKED stamp
- paper roughness/normal

3D:

- three receipt planes
- optional alignment/bound plane

## 07 — Budget / Concurrency

Needs:

- two receipt/slip instances
- RESERVED stamp
- simple unavailable X
- live `₹500` / `₹0` typography

3D:

- two transaction planes
- optional central shadow/state plane

## 08 — Causal Replay

Needs:

- replay strip/evidence template
- Mandate icon
- Delegation icon
- Agent Path icon
- Budget State icon
- Decision icon
- Execution icon
- Provider Result icon
- 7–8 paper/film planes using a coherent family
- highest-quality paper/film roughness maps
- optional product-relevant photographic fragments

3D:

- deepest scene
- 7 causal layer planes minimum
- optional final outcome plane

## 09 — Finale

Needs:

- wordmark
- final tagline
- ivory rule
- CTA
- background/grain

No WebGL assets.

## Asset reuse target

At least 60–70% of texture/mask assets should be reused across multiple scenes.

Do not create a new unique paper texture for every section.
