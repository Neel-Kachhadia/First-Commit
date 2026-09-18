# 25 — Implementation Plan

Do not build all scenes at once.

## Phase 0 — Audit existing repo

Before editing:

- inspect framework/version
- locate global styles and font setup
- identify existing motion libraries
- identify existing Three.js/WebGL usage if any
- identify current landing route
- identify existing design system
- run current build/test baseline
- take screenshots of current page

Do not replace a working app architecture unnecessarily.

## Phase 1 — Visual foundation

Build:

- design tokens
- font roles
- background texture
- DOM paper component
- rule component
- stamp component
- film strip component
- scene frame
- reduced-motion utility

Acceptance: a static style playground matches the reference board's material language.

## Phase 2 — Canonical materials + on-demand asset system

Do not pre-generate a large speculative asset pack. The user supplies the five canonical paper textures and approved visual board.

Before scene work, prepare only:

- asset directories
- deterministic generation-tool scaffolding under `tools/generate-assets/`
- shared live document primitives
- texture-loading/cache utilities

Then create masks, stamps, film assets, overlays, material maps, shadows, and symbols only when the current scene requires them.

See `40_ASSET_CREATION_POLICY.md`.

## Phase 3 — Shared physical stage prototype

Implement the smallest viable WebGL stage:

- one renderer/canvas
- one camera
- one soft key + fill
- one paper plane
- one shadow receiver
- texture cache
- progress-driven transform
- DOM overlay alignment
- WebGL failure fallback

Acceptance:

A single paper artifact with good texture, shadow, slight bend and camera parallax must look physically convincing.

If primitive paper does not look good, do not proceed to more 3D. Fix materials/lighting/assets first.

## Phase 4 — Static full-page composition

Build all scenes as strong still compositions before final choreography.

The page should already look excellent without motion.

If the static page is weak, do not use animation or 3D to hide it.

## Phase 5 — Prologue + Mandate

Implement first transition pair.

Mandate may use the physical stage with 2–4 shallow planes.

Validate:

- pin architecture
- typography scaling
- paper texture
- DOM/WebGL registration
- scroll progress
- mobile fallback

## Phase 6 — Decisions + Delegation

Decisions remain mainly DOM/SVG.

Delegation introduces lightweight 3D Z-separation for parent/child passes.

Validate that ALLOW, STEP-UP, and DENY feel different through timing.

## Phase 7 — Step-Up + Revocation

Step-Up uses one physical receipt/document plane plus sharp DOM/SVG stamp treatment.

Revocation may use shallow multi-strip Z depth, but editing/stops remain the primary storytelling language.

## Phase 8 — Split Defense + Concurrency

Use spatial convergence only where it improves comprehension.

Split Defense: three receipt planes align.

Concurrency: two slips approach one shared state.

## Phase 9 — Replay

Implement last because it is the longest, most reversible and most spatial scene.

This is the one scene where deeper camera travel and optional limited DOF are justified.

Do not begin Replay until the asset pack, stage, texture cache and progress system are stable.

## Phase 10 — Finale

Exit WebGL and return to crisp DOM/graphic composition.

Keep restrained.

## Phase 11 — Responsive

Do not postpone mobile until the end of QA. Convert each scene immediately after its desktop version is stable.

Mobile should simplify the stage, not reproduce desktop depth exactly.

## Phase 12 — Performance pass

- image optimization
- texture sizing
- lazy-load scenes
- clamp DPR
- remove unused dependencies
- reduce shadows/post
- inspect paint/layout costs
- test scroll jank
- test font loading
- test WebGL-disabled fallback

## Phase 13 — Accessibility / reduced motion

Required before sign-off.

## Phase 14 — Final visual audit

Compare against `source/KavachPay_Final_Visual_Reference.png` side by side.

Ask:

- Does this still feel like the same graphic system?
- Did implementation drift into generic web UI?
- Is 3D invisible craftsmanship rather than spectacle?
- Did humans or unrelated imagery creep in?
- Are transitions still stronger than the 3D itself?
- Does Replay feel like the spatial climax rather than just another section?

## Suggested implementation order for AI agent commits

1. `feat/kavach-visual-foundation`
2. `feat/kavach-master-asset-pack`
3. `feat/kavach-physical-stage`
4. `feat/kavach-static-scenes`
5. `feat/kavach-prologue-mandate-motion`
6. `feat/kavach-decisions-delegation-motion`
7. `feat/kavach-stepup-revocation-motion`
8. `feat/kavach-defense-concurrency-motion`
9. `feat/kavach-replay-spatial-climax`
10. `feat/kavach-responsive-a11y`
11. `perf/kavach-landing`
12. `fix/kavach-visual-polish`
