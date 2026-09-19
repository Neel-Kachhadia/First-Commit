# 46 — Master Codex Build Prompt

Copy the following instruction into the coding-agent task after providing the repository, this bible, the product brief, the approved visual board, and the five canonical paper textures.

---

You are responsible for building the full KavachPay cinematic landing page and creating any technical visual assets required by the implementation.

Read `AGENTS.md` first, then `MANIFEST.md`, then `docs/00_README.md`, and follow the documented precedence/read order before writing code.

## Locked stack

Use:

- Next.js
- React
- TypeScript
- App Router
- GSAP
- ScrollTrigger
- Lenis
- Three.js
- React Three Fiber
- @react-three/drei
- Zustand
- CSS Modules
- CSS Custom Properties
- SVG
- Web Audio API where useful
- Playwright
- Vitest where useful
- Vercel-compatible architecture

Do not introduce Framer Motion for the cinematic sequences, Tailwind as the primary art-direction layer, generic UI kits, or multiple competing animation systems.

## Governing creative rule

KavachPay behavior -> cinematic idea -> visual execution.

Never begin with a random visual effect and then search for product copy to justify it.

## No humans

No faces, hands, silhouettes, people, bodies, crowds, lifestyle photography, or human-shaped figures.

## No irrelevant world-building

No generic cities, speculative architecture, unrelated shopping/travel scenes, or future environments that survive unchanged without KavachPay.

## Retro means film/print, not obsolete computers

No CRTs, tape reels, punch cards, vintage terminals, switchboards, retro computer rooms, cyberpunk, steampunk, or analog-computer fetishism.

## Visual language

Use:

- near-black
- warm ivory paper
- deep administrative red
- institutional print
- stamps
- film strips
- receipts
- authority passes
- evidence records
- editorial typography
- physical shadows
- restrained print imperfections
- hard cuts
- masks
- match cuts
- authored transitions
- selective physical 3D

## 3D model

The WebGL layer is a physical film-compositing stage.

Use primitive geometry:

- planes
- strips
- slightly bent paper
- receipts
- tickets
- lightly extruded cards only where thickness is visible

Most craftsmanship must come from typography, assets/materials, lighting, camera, layout, sound, timing, and transitions.

Causal Replay receives the strongest WebGL treatment.

## User-supplied canonical materials

Do not overwrite:

- PAPER_01_MASTER_IVORY_4K
- PAPER_02_HANDLED_AUTHORITY_4K
- PAPER_03_THIN_RECEIPT_4K
- PAPER_04_TICKET_STOCK_4K
- PAPER_05_OFFICIAL_DOCUMENT_4K

## Asset policy

Create technical assets only when the current scene requires them.

Use Python/Pillow/NumPy/OpenCV/SVG/CSS/Canvas/Three.js/ImageMagick as appropriate.

Store generation scripts under `tools/generate-assets/` and production outputs under `public/assets/kavachpay/`.

Do not flatten major documents into AI-generated raster images. Build Mandate, Authority Pass, Derived Authority, Transaction Receipt, Clearance Document, Evidence Record, Decision Stamp, Revocation Strip, and Replay Layer as live HTML/SVG components wherever possible.

## Scene order

00 Opening / Hero
01 Mandate
02 Allow / Step-Up / Deny
03 Delegation
04 Step-Up Clearance
05 Revocation
06 Split-Payment Defense
07 Budget / Concurrency
08 Causal Replay
09 Closing

Do not add generic Features / Testimonials / Pricing / FAQ sections.

## Transition philosophy

Transitions are a primary source of spectacle.

Avoid default fade-in / slide-up / blur-in / generic parallax as the main choreography.

Prefer authored transformations such as:

- torn paper edge becoming the next scene boundary
- film frame expanding into the next section
- receipt ink filling the viewport and becoming the next black field
- stamp impact reorganizing the composition
- receipts converging into one economic action
- `₹500` becoming the concurrency aperture/state
- replay revisiting previous visual material with new causal meaning

Objects should not merely leave the viewport; their departure should help create the next composition.

## 10 / 10 / 10 quality rule

There are no filler frames.

Every resting frame, transition frame, WebGL frame, and mobile frame must be intentionally composed.

For every major sequence, capture screenshots at approximately 0%, 25%, 50%, 75%, and 100% progress using Playwright or a deterministic debug route.

Reject and refine any checkpoint with:

- weak hierarchy
- awkward empty space
- accidental overlap
- unreadable type
- generic composition
- poor paper treatment
- bad perspective
- obvious primitive geometry
- uncontrolled texture noise
- unfinished transition state

Do not move to the next scene until the current one passes.

## Build loop

For each scene:

1. build the static hero composition
2. make the still frame excellent before animation
3. identify missing assets
4. generate only those assets
5. integrate them
6. build the transition choreography
7. add selective 3D only if it materially improves the scene
8. capture the five checkpoint screenshots
9. inspect and refine
10. only then continue

Do not build the entire page as placeholders first.

## Product behaviors to preserve

- bounded mandate / intent contract
- ALLOW / STEP-UP / DENY
- derived authority without amplification
- one-time clearance
- lineage-aware revocation
- split-payment correlation
- atomic competition for remaining budget
- causal replay

Use the values and copy in `docs/38_LOCKED_DEMO_VALUES.md` and `docs/39_STAMP_AND_COPY_VOCABULARY.md` unless the product brief or approved board explicitly overrides them.

## Performance

Use one persistent WebGL canvas. Share renderer/camera/lights/material resources. Lazy-load expensive resources. Cap DPR. Provide reduced-motion and non-WebGL fallbacks. Recompose mobile deliberately; do not ship a broken desktop layout stacked vertically.

## Final standard

The result must not feel like “fintech with retro styling” or “a WebGL demo with KavachPay branding.”

It must feel like one authored KavachPay film/print system where product behavior, editing, typography, physical materials, motion, sound, and selective spatial depth are inseparable.

If a technically impressive effect is visually weaker than a simpler composition, remove it.

Maximum visual quality per second is more important than maximum technical complexity.

---
