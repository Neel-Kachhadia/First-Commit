# 10 — Scene 03: Delegation

## Product behavior

Child authority is derived from parent authority and cannot create additional capacity.

Reference values:

- Shopping: ₹4,000/week, remaining ₹1,500 in the reference composition
- Grocery derived authority: ₹1,500/week
- Delivery derived authority: ₹1,000/week

Values may be adjusted if the final product demo uses a different coherent state, but parent/child arithmetic must remain valid.

## Composition

One large `AUTHORITY PASS — SHOPPING` at the top/front.

Two smaller perforated `DERIVED AUTHORITY` tickets:

- GROCERY
- DELIVERY

The final front-facing composition should still match the approved board.

## 3D treatment

Use thin paper planes.

Start with the parent pass almost flat to camera.

As delegation occurs:

- Grocery separates to one side and a slightly different Z depth
- Delivery separates to the opposite side and a different Z depth
- parent remains physically present
- parent `REMAINING` visibly updates

The depth is subtle: enough for shadow/parallax, not enough to become a 3D card carousel.

## Motion idea

The parent ticket should **physically divide its available visual capacity** into child tickets.

Do not create a glowing clone.

### Scroll beats

0.00–0.20 — Shopping pass enters/locks into place.

0.20–0.36 — perforation/derivation marks appear.

0.36–0.58 — child planes emerge from the parent composition and separate in X/Y/Z.

0.58–0.74 — camera pulls back slightly to reveal all three.

0.74–0.86 — values settle; parent `REMAINING` updates.

0.86–1.00 — one torn/perforated edge grows toward camera and becomes the Step-Up transition wipe.

## Key visual logic

The parent must look reduced/changed after delegation. Otherwise the animation implies authority was copied rather than derived.

## DOM/WebGL split

WebGL:

- pass planes
- Z separation
- soft shadows
- slight paper bends

DOM/SVG:

- text values
- arrows/rules
- perforation graphics if sharper in SVG

## Transition out

Use the torn/perforated edge of one ticket as a full-screen wipe.

The torn edge travels across the viewport, replacing the scene with the Step-Up clearance paper.

## Avoid

- node graph
- glowing transfer
- energy beam
- 3D card carousel
- cloned paper with unchanged parent capacity
