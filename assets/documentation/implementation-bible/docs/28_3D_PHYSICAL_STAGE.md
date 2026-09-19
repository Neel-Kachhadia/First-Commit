# 28 — 3D Physical Stage System

## Purpose

Use 3D as **invisible physical craftsmanship**, not as the website's visual identity.

The landing page remains transition-led. Most of the experience is typography, paper, film, stamps, masks, editorial composition and scroll choreography. The 3D layer exists only to make selected KavachPay artifacts feel physically present through:

- real parallax
- controlled Z-depth
- camera movement
- cast shadows
- shallow depth of field
- paper curl/bend
- spatial convergence
- spatial replay

The mental model is not “build a 3D world.” It is:

> **Build a small physical film-compositing stage and place two-dimensional KavachPay artifacts inside it.**

## Core rule

The visual effort hierarchy is:

```text
HIGH EFFORT
    ↓
Typography
Document art direction
Paper / film / receipt design
Photography
Print imperfections
Transition timing
Camera rhythm
Lighting

LOW EFFORT
    ↓
3D geometry
```

If a scene requires elaborate modelling to look good, redesign the scene.

## Geometry vocabulary

Approved geometry is intentionally primitive:

- `PlaneGeometry`
- slightly subdivided plane for paper bend
- narrow strips
- ticket/receipt rectangles
- optional rounded plane corner mask
- optional shallow extruded edge only when visible in macro close-up

Avoid:

- hero coins
- 3D rupee symbols
- shields
- locks
- credit cards
- robots
- AI heads
- payment terminals
- complex architecture
- decorative machinery

## Shared stage architecture

Use **one WebGL renderer/canvas** for all 3D-enhanced scenes. Do not create a new renderer per section.

Suggested structure:

```text
KavachLanding
├─ DOM cinematic layer
├─ SharedPhysicalStage (single fixed/sticky canvas)
│  ├─ StageCamera
│  ├─ KeyLight
│  ├─ FillLight
│  ├─ ShadowReceiver
│  └─ ActiveSceneGroup
└─ Grain / print overlays
```

The active scene swaps groups/textures while the renderer remains alive.

## Camera

Prefer a perspective camera around:

- FOV: `28–42`
- near: `0.01`
- far: `50–100`
- camera Z: tuned per scene, usually `2.5–6`

The camera should move slowly and deliberately. Avoid frictionless fly-throughs.

Good camera behavior:

- 2–8% lateral parallax over a scene
- 2–12% forward/back travel
- small yaw/pitch only when composition demands it
- deliberate rack-focus / focus-distance change

Bad camera behavior:

- orbiting around paper
- constant floating
- exaggerated dolly zoom
- first-person navigation
- game-camera inertia

## Coordinate scale

Treat `1 world unit ≈ 1 meter` only as a rough authoring convention. Most paper artifacts can be around `0.7–1.4` world units wide.

Example paper stack:

```text
CAMERA →

[ Mandate plane ]       z = 0.00
      0.10–0.18m
[ annotation strip ]    z = -0.12
      0.12–0.25m
[ photo / receipt ]     z = -0.30
```

The goal is enough separation for parallax and shadows, not dramatic depth.

## Paper material

A convincing paper plane can be:

```text
PlaneGeometry
+
base-color / alpha texture
+
roughness map
+
very subtle normal/bump
+
optional tiny vertex bend
+
soft directional light
+
shadow receiver
+
camera parallax
```

Recommended material characteristics:

- high roughness: `0.75–0.95`
- near-zero metalness
- subtle alpha edge mask
- optional mild transmission/translucency only for thin receipt stock
- very weak normal amplitude

Do not make paper glossy.

## Paper bend

For a receipt or ticket requiring curl, subdivide the plane and deform vertices mathematically.

Example conceptual deformation:

```text
flat plane

↓ vertex deformation

      ______
    /
   /
  /
```

Use small bend amplitudes. Paper should not look rubbery.

## Lighting

Lighting exists to make paper and film believable.

Preferred:

- one soft key light
- one weak fill
- optional narrow rim only where needed
- contact shadows
- ambient darkness from the black board/background

Do not create dramatic sci-fi light rigs.

## Depth of field

Use sparingly.

Good uses:

- Hero paper stack
- Delegation children at different depths
- Replay layers

Avoid shallow DOF when it makes product information unreadable.

If runtime post-processing is too expensive, fake focus with CSS/texture blur states or preblurred variants rather than adding a heavy post stack.

## Z-depth is semantic

Depth should communicate product behavior when possible:

- parent authority sits behind/above derived passes
- multiple split-payment receipts converge toward one depth plane
- competing transactions approach a single reservation state
- replay evidence occupies chronological depth

Do not add Z movement merely to “make it 3D.”

## 3D usage by scene

### Prologue
No 3D.

### Mandate / Hero
Light 3D. 2–4 planes with slow camera parallax.

### Allow / Step-Up / Deny
Primarily DOM/film-strip transition language. Optional subtle depth only.

### Delegation
Light/medium 3D. Parent authority pass separates into derived child passes with real Z-offset.

### Step-Up
Light 3D. Receipt can approach camera, freeze, then receive a 2D/DOM stamp impact.

### Revocation
Medium 3D. Film/document strips at multiple Z positions; dependent strips physically leave the active path.

### Split-Payment Defense
Medium 3D. Three receipt planes arrive from different spatial positions and align over one underlying event.

### Budget / Concurrency
Medium 3D. Two slips approach a central shared state from opposed depth/angles; one reserves, the other halts.

### Causal Replay
**Primary 3D climax.** Spend most of the WebGL budget here.

### Finale
Return to DOM/graphic composition.

## Hard cap

3D should occupy roughly **10–20% of the total implementation complexity** and should never overpower transition choreography.

The user should remember:

- the paper
- the film language
- the transitions
- the product behaviors
- the replay reconstruction

They should not remember “the Three.js site.”
