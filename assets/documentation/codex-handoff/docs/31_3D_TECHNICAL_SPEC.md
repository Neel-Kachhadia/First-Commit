# 31 — 3D Technical Specification

## Recommended implementation

For a fresh Next.js/React build:

- `three`
- optionally `@react-three/fiber` for lifecycle integration
- GSAP / ScrollTrigger for timeline control
- no heavy 3D component suite by default
- avoid large post-processing stacks

If the existing repository already uses raw Three.js, keep raw Three.js.

If it does not use WebGL yet, the preferred architecture is one small shared stage rather than multiple isolated canvases.

## One-canvas rule

Use one renderer for the entire landing page.

Why:

- avoids multiple WebGL contexts
- reduces memory duplication
- textures stay cached
- stage transitions can reuse geometry/materials
- easier to pause on mobile or reduced motion

## Scene lifecycle

Pseudo-interface:

```ts
export type PhysicalStageScene = {
  id: string;
  mount(stage: StageContext): void;
  setProgress(progress: number): void;
  resize(viewport: Viewport): void;
  unmount(): void;
};
```

ScrollTrigger progress should drive a normalized `0..1` progress value.

The WebGL scene should derive its state from progress rather than fire irreversible events.

## Renderer

Suggested:

```ts
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
```

On mobile or constrained devices:

- lower DPR
- disable expensive post effects
- reduce shadow map resolution
- optionally fall back to DOM-only scene composition

## DPR

Clamp device pixel ratio.

Suggested desktop:

```ts
Math.min(window.devicePixelRatio, 1.5)
```

Suggested mobile:

```ts
Math.min(window.devicePixelRatio, 1.25)
```

Do not render 3x DPR unnecessarily.

## Camera

Perspective camera.

Suggested baseline:

```ts
new THREE.PerspectiveCamera(34, aspect, 0.01, 50)
```

Tune per scene only when needed.

## Geometry reuse

Create reusable geometries:

- `paperPlane32x32` — subdivided for bend
- `paperPlane1x1` — simple plane
- `stripPlane`
- `shadowPlane`

Reuse instances/materials instead of allocating during scroll.

## Paper bend shader-free implementation

For light bends, mutate the subdivided plane once per progress update or use a simple vertex shader.

Avoid CPU-heavy vertex updates for dozens of objects.

Example concept:

```ts
z = sin((x + 0.5) * Math.PI) * bendAmount
```

Keep bend amplitude very small.

## Materials

Preferred paper material:

- `MeshStandardMaterial`
- roughness high
- metalness 0
- alphaTest where torn edges need clean cutout
- transparent only if genuinely necessary

Avoid large numbers of unique materials. Parameterize a small family.

## Lighting

Baseline:

- one directional/area-like key
- one ambient or hemisphere fill
- optional secondary point/directional light

Do not add many dynamic lights.

## Shadows

Use selectively.

- only artifact planes that need contact depth should cast/receive
- low/medium shadow-map resolution
- disable shadows on mobile if frame cost is high

A cheap blurred shadow plane may be preferable to real-time shadows for some scenes.

## Focus / DOF

Default: no runtime post-processing.

Preferred order:

1. use camera framing and actual depth
2. use preblurred texture variants / CSS overlay
3. only then use lightweight DOF in Replay if performance allows

## Texture loading

Use a central texture cache.

Preload:

- hero paper set
- global grain/noise

Lazy-load scene assets 1–2 scenes ahead.

Do not load the full 50-asset pack on first paint.

## Texture memory

Keep most textures at 1K–2K runtime resolution.

Only Replay hero assets may justify larger textures if shown close-up.

## DOM/WebGL layering

Recommended stacking:

```text
z-index 0   black/board background
z-index 1   WebGL physical stage
z-index 2   live DOM typography / labels / stamps
z-index 3   grain / print overlay
z-index 4   global navigation / accessibility controls
```

This keeps type crisp and allows physical paper behind it.

## Pointer behavior

Canvas should normally be:

```css
pointer-events: none;
```

The landing page is scroll-driven. Do not introduce 3D hover toys.

## Reduced motion

When reduced motion is active:

- do not initialize WebGL unless needed for a static still
- use DOM/SVG still compositions
- preserve all product information

## Mobile

For mobile, simplify rather than squeeze desktop 3D choreography.

Recommended:

- static or lightly parallaxed paper planes
- no deep camera fly-through except a simplified Replay
- fewer simultaneous planes
- lower DPR
- no heavy post effects

## Debug mode

Provide a dev-only debug flag:

```ts
?stageDebug=1
```

Optional debug overlays:

- scene id
- normalized progress
- camera coordinates
- active texture count
- DPR
- FPS estimate

Remove/debug-gate in production.

## Failure fallback

If WebGL initialization fails:

- page still renders fully using DOM/SVG
- no blank sections
- scene information and transitions degrade gracefully

3D is enhancement, not content ownership.
