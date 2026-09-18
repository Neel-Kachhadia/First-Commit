# 19 — Technical Architecture

## Baseline stack

See `34_LOCKED_TECH_STACK.md`. This section is consistent with that lock and does not override it.

Use the repository's existing framework if one already exists. If starting fresh:

- Next.js
- React
- TypeScript
- GSAP + ScrollTrigger
- CSS Modules or SCSS Modules
- Lenis
- SVG assets
- optimized AVIF/WebP raster textures
- `three` for the lightweight physical stage
- `@react-three/fiber` for React integration
- `@react-three/drei` for focused helpers
- Zustand for small global cinematic state

## 3D rule

Three.js is allowed, but only as a **small physical compositing stage**.

Do not use it to build:

- cities
- environments
- architecture
- elaborate machines
- hero coins/shields/cards
- decorative 3D objects

The main 3D primitives are paper planes, film strips, receipt/ticket planes and shadow receivers.

Read:

- `28_3D_PHYSICAL_STAGE.md`
- `30_WEBGL_SCENE_RECIPES.md`
- `31_3D_TECHNICAL_SPEC.md`

before implementing the stage.

## Do not add by default

- heavy shader libraries
- large post-processing stacks
- physics engines
- full 3D asset libraries
- multiple competing motion engines
- multiple WebGL canvases/contexts

If Motion/Framer Motion already exists, keep it for small UI interactions only. Do not animate the same element with both Motion and GSAP.

## Suggested route

Landing page at `/`.

Keep cinematic code isolated from actual product-app routes if they share a repository.

## Layer architecture

Recommended visual stack:

```text
DOM scene structure / accessibility content
↓
Shared WebGL physical stage (only where needed)
↓
Live DOM/SVG typography + stamps
↓
Print/grain overlays
↓
Global controls/navigation
```

The page must remain understandable if the WebGL layer is disabled.

## Data strategy

Landing-page product examples are deterministic content, not live transaction state.

Put scene data in typed files rather than hard-coding values inside animation functions.

Example:

```ts
export const demoState = {
  mandate: {
    category: 'GROCERY',
    weeklyLimit: 4000,
    stepUpAbove: 1500,
    blocked: ['ALCOHOL'],
    expires: 'SUN 23:59',
    delegationDepth: 2,
  },
  decisions: [
    { amount: 1249, label: 'GROCERY', outcome: 'ALLOW' },
    { amount: 4900, label: 'TRAVEL', outcome: 'STEP_UP' },
    { amount: 799, label: 'BLOCKED MERCHANT', outcome: 'DENY' },
  ],
};
```

## Asset loading

Above-the-fold:

- load global textures
- hero/mandate paper set
- wordmark/fonts

Lazy-load 3D/texture assets 1–2 scenes ahead.

Causal Replay's larger asset set must not be part of the initial critical bundle unless profiling proves it harmless.

## Texture implementation

Prefer small repeating textures over giant full-screen background images.

Examples:

- `black-stock.webp` 512–1024px tile
- `paper-fiber.webp` 512–1024px
- `stamp-mask-01.webp` small alpha mask

Use the master asset system defined in `29_MASTER_PHYSICAL_ASSET_PACK.md`.

## Film perforations

Prefer SVG/CSS repeating patterns for DOM scenes. In 3D scenes, use a reusable alpha/texture strip rather than unique high-resolution geometry.

## Grain

Option A: CSS background tile animated by stepped background-position.

Option B: tiny canvas overlay updated at low frame rate (12–20fps), pointer-events none.

Do not run full-resolution per-pixel noise at 60fps.

## Browser support

Use progressive enhancement for:

- `mask-image`
- `clip-path`
- blend modes
- WebGL

Provide a clean DOM/SVG fallback when WebGL is unavailable.

## SSR / hydration

The static layout must render correctly before GSAP/WebGL initializes.

Animations and 3D enhance the DOM; they must not be required for product copy or semantic content to exist.
