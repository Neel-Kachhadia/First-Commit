# 34 — Locked Technical Stack

This file overrides any earlier wording that describes React Three Fiber, Drei, Lenis, or Zustand as optional. For the KavachPay cinematic landing page, the stack is now locked unless the existing repository makes a component impossible to adopt without damaging working infrastructure.

## Framework

- Next.js
- React
- TypeScript
- App Router

If the existing repository already uses Next.js/React/TypeScript, preserve its package manager and project conventions. Do not migrate a working app merely to satisfy folder aesthetics.

## Motion and scroll

- GSAP — primary animation engine
- GSAP ScrollTrigger — pinned/scrubbed timelines and scene progress
- Lenis — desktop smooth-scroll integration, with an opt-out path for accessibility and reduced motion

GSAP owns cinematic motion. Do not use Framer Motion/Motion to animate the same cinematic elements. Small UI micro-interactions may use CSS transitions.

GSAP owns:

- scroll timelines
- scene pinning
- mask reveals
- paper movement
- film-strip movement
- stamp impacts
- scene-to-scene transitions
- split-screen recomposition
- DOM/WebGL synchronization
- causal replay

## 3D / WebGL

- Three.js
- React Three Fiber
- @react-three/drei

The WebGL layer is a **physical film-compositing stage**, not a 3D world.

Allowed 3D vocabulary:

- thin paper planes
- authority passes
- receipts
- film strips
- lightly extruded cards only when thickness is visible
- slight paper deformation
- real Z-depth
- soft shadows
- camera parallax
- restrained depth of field only where justified

Do not build cities, architecture, machines, giant cards, coins, shields, robots, or decorative 3D worlds.

Causal Replay receives the strongest spatial treatment.

## State

- Zustand

Use a small store for cinematic/global experience state only. Suggested fields:

```ts
interface ExperienceState {
  currentScene: string;
  sceneProgress: number;
  soundEnabled: boolean;
  reducedMotion: boolean;
  webglReady: boolean;
  performanceTier: 'low' | 'mid' | 'high';
  replayDirection: 'forward' | 'reverse';
  debug: boolean;
}
```

Do not put immutable demo copy or every GSAP tween into global state.

## Styling

- CSS Modules
- CSS Custom Properties / design tokens
- modern CSS masks
- `clip-path`
- transforms
- blend modes
- filters where proven performant
- container queries where useful

Do not use Tailwind as the primary art-direction layer. Do not introduce a generic component library for the cinematic surface.

## Audio

- Web Audio API
- Howler.js only if asset scheduling/management becomes materially simpler

Audio is synchronized to the same master timelines as visual events.

## Graphics and assets

- SVG — stamps, seals, pictograms, rules, masks, film geometry
- HTML/CSS — live document layouts and typography
- Canvas 2D — only for specific procedural texture/compositing effects
- AVIF / WebP — photographic and paper textures
- PNG — alpha-heavy masks when needed
- KTX2 — WebGL textures only when compression materially helps
- WOFF2 — fonts

## Testing

- Playwright — visual checkpoints, responsive behavior, interaction
- Vitest — utilities/state where meaningful
- Lighthouse
- Chrome DevTools Performance
- manual GPU/mobile testing

## Deployment

- Vercel-compatible build and deployment

## Production tools outside the runtime

- Figma — composition and layout studies
- Photoshop — texture cleanup, masks, photographic treatment
- Illustrator — vector stamps/seals/pictograms
- After Effects — motion studies/reference only
- Blender — only if procedural Three.js geometry genuinely cannot produce a needed physical artifact

## Target workload balance

Approximate target, not a rigid budget:

- 50–55% DOM / CSS / SVG composition
- 25–30% GSAP choreography and transitions
- 10–15% Three.js / WebGL physical depth
- 5–10% audio, texture, finishing effects

The site is **transition-led with selective 3D**, not a Three.js portfolio with copy placed around it.
