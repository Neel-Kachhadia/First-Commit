# 23 — Performance Budget

The page should feel cinematic without shipping a game engine.

## Primary performance strategy

Use DOM/CSS/SVG for the majority of the experience and one lightweight shared WebGL stage for selected physical-paper scenes.

3D geometry is primitive. Texture/material craft carries the visual quality.

## Targets

Treat these as engineering targets, not guarantees:

- LCP <= 2.5s on a good mid-range mobile connection/device profile
- CLS <= 0.05
- INP <= 200ms where feasible
- no sustained main-thread animation work above frame budget
- 60fps target on modern desktop during ordinary scroll
- graceful 30fps degradation preferable to jank

## Asset budget

Aim for:

- initial critical imagery/textures <= 900KB compressed where practical
- total landing-page raster assets ideally <= 7–10MB before cache
- Replay may own the largest late-loaded texture budget
- no single decorative image > 1.5MB without strong reason

## WebGL budget

Use one renderer only.

- clamp DPR to ~1.5 desktop / ~1.25 mobile
- reuse geometry/materials
- lazy-load textures 1–2 scenes ahead
- avoid dozens of unique 4K textures
- avoid expensive post-processing by default
- keep dynamic lights minimal
- use selective shadows

Causal Replay can receive the highest WebGL budget because it is the spatial climax.

## JavaScript

Avoid importing entire animation/utility libraries when only a small feature is used.

Keep scene modules lazy where practical.

If React Three Fiber is used, do not pull in broad Drei/postprocessing packages unless a specific feature needs them.

## Animation performance

Animate primarily:

- `transform`
- `opacity`
- camera/group position/rotation
- masks/clip paths carefully

Avoid large-area animated blur filters.

Use `will-change` temporarily, not globally.

## Grain

Do not use a full-screen 4K noise video.

Use a tiny texture tile or low-FPS canvas.

## ScrollTrigger

- call refresh after fonts/images settle
- clean up triggers on unmount
- batch measurements
- avoid layout reads inside every scroll update
- feed normalized progress into the WebGL stage instead of firing irreversible scene events

## Fonts

Load only required weights.

Prefer variable fonts if available and efficient.

Preload only the above-the-fold brand/heading face if justified.

## Mobile degradation strategy

On constrained mobile:

- reduce DPR
- disable real-time shadows first
- reduce simultaneous planes
- simplify Causal Replay depth
- remove optional DOF/post
- fall back to DOM/SVG still composition if WebGL performance is unacceptable

## QA devices

At minimum test:

- high-end desktop
- ordinary Windows laptop integrated/battery mode
- recent iPhone-sized viewport
- mid-range Android profile in Chrome devtools
- reduced motion
- WebGL-disabled fallback
