# 06 — Page Architecture and Landing-Page Size

## Target size

Desktop effective scroll depth target: **approximately 11,500–13,500 CSS pixels at a 900px-tall viewport**.

This is not 13,000px of stacked content. Much of it is pinned scene progress.

Target experience time:

- attentive visitor: ~2.5–4 minutes
- fast scroller: ~45–75 seconds

## Sequence

### 00 — Prologue / Brand
Target scroll allocation: `100vh`

Purpose:

- establish KavachPay
- establish black/ivory/red print world
- establish tagline
- immediately signal that this is not a conventional SaaS page

3D: none.

### 01 — Mandate / physical document hero
Target: `150vh`

3D: light. 2–4 shallow paper/film planes for parallax and shadow.

### 02 — Allow / Step-Up / Deny
Target: `170vh`

3D: minimal/optional. Motion grammar and film/contact-sheet transition remain primary.

### 03 — Delegation
Target: `160vh`

3D: light/medium. Parent pass separates into derived passes with true Z offset.

### 04 — Step-Up Clearance
Target: `120vh`

3D: light. One receipt/document plane can approach/freeze; red clearance stamp remains sharp DOM/SVG.

### 05 — Revocation
Target: `160vh`

3D: light/medium. Film/document strips can occupy different Z depths while selective stopping/removal is still driven by editing.

### 06 — Split-Payment Defense
Target: `170vh`

3D: medium. Three receipts arrive from different positions/depths and converge into one economic action.

### 07 — Budget / Concurrency
Target: `150vh`

3D: medium. Two transaction slips approach one central shared state from opposed spatial positions.

### 08 — Causal Replay
Target: `210vh`

3D: **primary spatial climax**. Suspended causal layers, forward traversal, reverse reconstruction.

### 09 — Finale / Product statement / CTA
Target: `100vh`

3D: none. Return to crisp graphic/DOM composition.

At a 900px viewport this remains roughly within the 11.5K–13.5K target after implementation tuning.

## Section behavior

Do not make every scene use the same `position: sticky` template.

Variation:

- Prologue: normal flow + brief pin
- Mandate: pinned physical document stage
- Decisions: pinned triptych/contact sheet
- Delegation: pinned authority pass splits into derived passes
- Step-Up: shorter focused hold
- Revocation: multi-strip selective stop/removal
- Split defense: receipts enter separately then spatially align
- Concurrency: central state + opposed slips
- Replay: longest pinned spatial sequence, fully reversible
- Finale: release the pin and return to normal document flow

## 3D distribution rule

3D should feel **rare and earned**.

Do not make every scene a camera flight.

Preferred perception:

- most scenes = editorial cinema
- some scenes = physical depth
- one scene = true spatial climax

If the visitor starts expecting “the next 3D trick,” reduce 3D.

## Navigation

Do not use a conventional sticky nav over the cinematic area unless required by product constraints.

Preferred:

- minimal top-left KavachPay mark after prologue
- sound/motion control if audio is later added
- progress indicator may use scene numbers `01–08`, very small and unobtrusive

## CTA

Do not interrupt scenes with CTA buttons.

Primary CTA belongs in final scene.

Secondary CTA can be present in a minimal persistent header only if product requirements demand it.
