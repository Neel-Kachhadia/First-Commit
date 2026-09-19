# 30 — WebGL Scene Recipes

This document specifies the lightweight 3D treatment for each approved scene.

The 3D stage should never replace the scene's editorial transition logic. It adds physicality where depth materially helps comprehension.

## Shared conventions

- one renderer
- one camera
- one active scene group at a time
- primitive planes only
- GSAP controls camera/group transforms
- document typography remains live DOM/SVG where practical
- WebGL textures carry paper, photography, edge masks and physical shading
- DOM may sit above the canvas for razor-sharp text/stamps

## Scene 01 — Mandate / Hero physical document stage

### Goal

Make the hero feel like a physical editorial set rather than a flat card.

### Geometry

- 1 primary mandate plane
- 1 annotation strip plane
- optional 1 photographic/film frame
- optional 1 narrow rule strip

### Depth

Suggested:

```text
mandate        z = 0.00
annotation     z = -0.10
photo frame    z = -0.24
rule strip     z =  0.04
```

### Camera

- slow 3–6% lateral move
- slight forward push
- no orbit

### Lighting

- broad warm key from upper-left
- weak neutral fill
- soft contact shadows

### Transition out

The primary horizontal rule remains a DOM/SVG transition anchor into Scene 02.

The 3D stage must not block the existing rule-to-film-strip match cut.

## Scene 02 — Allow / Step-Up / Deny

### Default

Keep mainly DOM/SVG.

Optional depth:

- each transaction slip can sit at a slightly different Z layer
- approved lane can move forward a few centimeters
- step-up lane can freeze exactly in place
- denied lane can halt before reaching the exit plane

Do not spend WebGL budget here unless the physicality clearly improves the scene.

## Scene 03 — Delegation

### Goal

Show one authority becoming several derived authorities without suggesting copied money.

### Geometry

- parent pass plane
- grocery pass plane
- delivery pass plane

### Motion

1. parent sits centered at `z = 0`
2. perforation appears via DOM/SVG mask
3. child planes are revealed from the parent composition
4. Grocery travels to `x < 0`, `z = +0.10` or `-0.08`
5. Delivery travels to `x > 0`, `z = -0.12` or `+0.08`
6. parent remaining value updates in live DOM text

The children must look physically derived from the parent, not spawned as glowing clones.

### Camera

Small pull-back as the single pass becomes three.

## Scene 04 — Step-Up

### Goal

Give the clearance request physical presence while keeping the red stamp graphic and immediate.

### Geometry

- one receipt/authorization plane

### Motion

- receipt travels slightly toward camera
- freezes decisively
- very subtle paper flex on stop
- `HOLD FOR CLEARANCE` stamp lands as DOM/SVG above the canvas

Do not model a stamp object.

### Why hybrid

The paper benefits from depth; the stamp benefits from perfectly sharp graphic treatment.

## Scene 05 — Revocation

### Goal

Make dependent authority feel physically removed from the active editorial path.

### Geometry

- 4 film/document strips at different Z positions
- Shopping
- Grocery
- Delivery
- Travel

### Motion

- strips move in controlled parallel transport
- Shopping stops and shifts out of active depth
- Grocery and Delivery peel/slide out downstream
- Travel keeps moving on its original track

Possible action:

```text
Shopping  z: 0.00 -> -0.35, opacity down
Grocery   z: -0.08 -> -0.45, y out
Delivery  z: -0.16 -> -0.52, y out
Travel    stays on active z and continues
```

Do not explode or shatter anything.

## Scene 06 — Split-Payment Defense

### Goal

Three separate receipts become visibly one economic action.

### Geometry

- three receipt planes from different positions/depths
- one underlying alignment plane/bound

### Initial layout

```text
receipt A  x=-0.7 y=0.2 z=-0.1
receipt B  x= 0.0 y=0.0 z= 0.1
receipt C  x= 0.7 y=-0.1 z=-0.2
```

### Motion

- receipts enter independently
- camera/viewpoint reveals repeated merchant/agent/purpose
- receipts converge until corresponding text fields align
- once aligned, a shared DOM/SVG bounding composition appears
- `ONE ECONOMIC ACTION` stamp lands

No node lines.

## Scene 07 — Budget / Concurrency

### Goal

Use spatial collision to explain two near-simultaneous requests competing for one remaining capacity.

### Geometry

- central state plane/value
- left transaction plane
- right transaction plane

### Motion

Left and right transaction planes approach the central reservation plane from slightly different Z/angles.

Example:

```text
left:  x=-1.0 z=-0.25 ry=+5°
right: x=+1.0 z=+0.18 ry=-5°
```

Both approach.

At commit:

- winner advances through reservation threshold
- `RESERVED` stamp appears
- central `₹500` DOM value hard-cuts to `₹0`
- losing plane stops immediately and slightly recedes

Do not imply the winner was simply “faster.” The animation dramatizes concurrency; product truth is atomic reservation.

## Scene 08 — Causal Replay / signature 3D scene

### Goal

This is the primary spatial climax.

Canonical layers:

```text
MANDATE
DELEGATION
AGENT PATH
BUDGET STATE
DECISION
EXECUTION
PROVIDER RESULT
```

### Spatial layout

Treat each layer as a physical strip/plane suspended through depth.

Example side view:

```text
CAMERA →

[ MANDATE ]
      0.12
            [ DELEGATION ]
                   0.15
                         [ AGENT PATH ]
                                0.12
                                      [ BUDGET STATE ]
                                             0.15
                                                   [ DECISION ]
                                                          0.14
                                                                [ EXECUTION ]
                                                                       0.16
                                                                             [ PROVIDER RESULT ]
```

Exact values are not sacred. The visual rhythm is.

### Forward pass

As the visitor progresses:

- camera travels through layers in chronological/causal order
- current layer is in focus
- previous layer falls slightly out of focus or darkens
- small supporting labels can remain DOM overlays

### Reverse reconstruction

Near the scene climax:

- camera stops at Provider Result
- movement reverses
- layers re-enter in reverse causal order
- previously hidden metadata can reveal on the return pass
- user understands not just chronology, but **why the event happened**

### Signature move

At one point, position the camera so all strips align into a coherent flattened stack, then break alignment again as the camera continues.

This gives the scene a memorable spatial idea without a complex model.

### Rendering budget

This is the only scene allowed to use:

- the deepest Z range
- the most camera movement
- optional limited depth-of-field/post processing
- the highest texture count

Keep everything else restrained so this scene feels like a climax.

## Finale

Leave WebGL.

Return to a crisp DOM/graphic composition so the experience resolves rather than escalating indefinitely.
