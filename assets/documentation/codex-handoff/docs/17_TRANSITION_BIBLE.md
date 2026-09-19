# 17 — Transition Bible

This is a key implementation document.

The page should feel expensive because of **transitions and editorial choreography first**, with lightweight 3D used only to give physical depth to selected artifacts.

## Transition hierarchy

Use transitions in this priority order:

1. hard editorial cut
2. mask / clip reveal
3. paper-edge wipe
4. film-strip transport
5. stamp impact
6. registration / print alignment
7. split-screen recomposition
8. match cut based on line/shape/value
9. shallow spatial Z transition using the shared physical stage
10. deeper camera movement only in Causal Replay

## Global rules

### Do not morph everything

The site needs cuts. Constant morphing makes the page feel like a motion-template demo.

### Transition must have semantic connection

A transition should carry meaning from the outgoing product behavior into the incoming one.

### Preserve one visual anchor when possible

A line, paper edge, amount, stamp, film perforation, ticket shape, or physical receipt can become the next scene's structural element.

### 3D never replaces editorial logic

If a transition is understandable with a cut/mask/match cut, use that. Add Z-depth only if it makes the physical relationship clearer.

### Avoid white-flash abuse

Optical exposure flashes may be used once or twice, not between every section.

## Scene-to-scene choreography

### Prologue -> Mandate

**Anchor:** thin ivory rule.

- Brand composition resolves.
- Horizontal rule grows across screen.
- Rule becomes the top ruled line of the mandate.
- Physical-stage paper plane fades/registers beneath it.
- A tiny camera parallax establishes depth.

Technique: SVG/CSS mask + shared stage activation.

### Mandate -> Decisions

**Anchor:** mandate rule.

- Camera makes only a tiny settle; do not fly forward.
- Horizontal contract rule macro-expands in DOM.
- Rule becomes a full-width black divider.
- Divider duplicates into three horizontal boundaries.
- Film perforations register on left edge.
- Three decision lanes exist.

The WebGL paper stage recedes or unloads while the graphic transition takes control.

### Decisions -> Delegation

**Anchor:** approved transaction slip / paper shape.

- Three lanes compress toward center.
- Approved lane remains while others slide away.
- Approved paper expands/re-registers.
- Shared physical stage activates the new Shopping authority pass.
- Pass gains slight physical depth.

Do not use a generic crossfade.

### Delegation -> Step-Up

**Anchor:** torn/perforated paper edge.

- Child passes separate in Z.
- One torn/perforated edge advances toward camera.
- DOM/SVG irregular mask grows from the same edge.
- Mask wipes into the Step-Up approval document.

Depth supports the wipe; the wipe remains the visible transition.

### Step-Up -> Revocation

**Anchor:** red ink.

- `HOLD FOR CLEARANCE` stamp hits.
- Its rectangular red border expands beyond paper.
- Red border becomes a crop frame.
- Crop reveals the top Shopping strip in Revocation.
- Shared stage swaps from single paper plane to shallow multi-strip group.

This is still a graphic match cut, not a camera flight.

### Revocation -> Split-Payment

**Anchor:** film strip / perforation spacing.

- Related strips stop and peel away.
- Travel strip continues.
- Its film edge occupies the viewport.
- Perforation rhythm match-cuts into the vertical gaps between the three split-payment receipts.
- Three new receipt planes resolve at different shallow depths.

### Split-Payment -> Concurrency

**Anchor:** aligned receipts / central bound.

- Three receipt planes converge.
- Their shared bounding composition narrows.
- Z-depth compresses toward one central state.
- `₹1,000` values disappear on cuts, not morphs.
- `₹500 REMAINING` replaces the center.
- Two new transaction slips appear from opposed positions/depths.

### Concurrency -> Replay

**Anchor:** winning reserved slip.

- Winner receives `RESERVED`.
- Winning paper plane extends/moves forward.
- Its edge gains film/evidence-strip language.
- Camera pulls back just enough to reveal this is the first layer of a deeper causal stack.
- Replay stage loads remaining causal layers ahead in Z.

This is the first transition where the spatial stage is allowed to feel significantly deeper.

### Replay -> Finale

**Anchor:** causal strips -> line.

- Reverse reconstruction completes.
- Physical planes align into one flattened composition.
- Layers compress into a thin ivory rule.
- WebGL stage fades/releases.
- Hard cut black.
- Same rule redraws beneath final KavachPay wordmark.

## Stamp choreography

Every stamp should have three phases:

1. anticipation: 60–100ms tiny scale/offset preparation
2. impact: 80–140ms sharp arrival
3. settle: 180–260ms small rebound / ink reveal

Add a brief blur/ink spread mask if assets allow.

Do not bounce like a button.

## Paper movement

Paper should feel light but not floaty.

Use:

- short translations
- restrained Z travel
- slight rotation (`0.5–2deg`)
- small bend/settle
- friction-like easing

Avoid continuous bobbing.

## Film movement

Film strips should move mechanically/linearly when actively transporting and stop decisively.

Use `ease: none` during travel and a fast `power3.out` at stops.

## Spatial movement rule

The deeper the camera move, the more important the product reason must be.

- Mandate: tiny parallax
- Delegation: visible Z separation
- Step-Up: approach/freeze
- Revocation: selective depth removal
- Split: convergence
- Concurrency: opposed approach
- Replay: full spatial traversal/reconstruction

That escalation is intentional.
