# KavachPay Landing Page — Implementation Bible v3

This package is the implementation handoff for an AI coding/design agent.

It converts the approved KavachPay visual direction into an executable landing-page specification: information architecture, scene behavior, transitions, lightweight physical 3D, asset production, responsive behavior, performance constraints, copy, code organization, implementation order, and acceptance gates.

## Scope

This package is for the **public-facing KavachPay landing page / cinematic product story**.

It is not the full backend/control-plane implementation. The product brief is included under `source/` so that every visual claim remains grounded in what KavachPay actually does.

The landing page should communicate the product through eight product-native cinematic sequences:

1. Mandate
2. Allow / Step-Up / Deny
3. Delegation
4. Step-Up Clearance
5. Revocation
6. Split-Payment Defense
7. Budget / Concurrency
8. Causal Replay

A prologue and closing brand/CTA frame surround those eight sequences.

## Core implementation decision

This site should be **transition-first and 3D-light**, but not completely flat.

Use a small shared Three.js physical stage to make selected KavachPay artifacts feel materially present.

The 3D consists mostly of:

- thin paper planes
- film strips
- receipts
- tickets
- document layers
- slight bends
- real parallax
- soft shadows
- restrained camera movement

The visual craftsmanship still comes primarily from:

- typography
- paper/document art direction
- photography
- film language
- print imperfections
- stamps
- masks
- edit timing
- transitions

**Causal Replay is the one major spatial 3D scene.**

Everything else should use 3D only where depth improves product understanding.

## Recommended stack at a glance

- Next.js + TypeScript
- CSS Modules or scoped SCSS for hand-authored layout
- GSAP + ScrollTrigger for master timelines
- Lenis optional for desktop smoothing only
- SVG for masks, rules, arrows, stamps, icons
- Raster AVIF/WebP for paper/film textures
- CSS `clip-path`, masks, transforms, filters, blend modes
- `three` + `@react-three/fiber` + `@react-three/drei` for one shared lightweight physical stage
- Zustand for small global cinematic state
- Web Audio API for optional synchronized cues
- Playwright for 0/25/50/75/100 visual QA checkpoints
- no heavy 3D modelling pipeline by default

## Critical mental model

> **The WebGL layer is a physical film-compositing stage, not a 3D world.**

If an agent starts building cities, architecture, machines, coins, cards, shields, robots or decorative 3D environments, it has left the approved direction.

## Read the package

`01_NORTH_STAR.md` defines the creative objective.

`02_SOURCE_OF_TRUTH_AND_PRECEDENCE.md` resolves conflicts with earlier concepts.

`03_PRODUCT_TRUTH.md` defines what KavachPay actually does.

`04_VISUAL_LANGUAGE.md` and `05_DESIGN_TOKENS.md` define the style.

`06_PAGE_ARCHITECTURE.md` defines the page size and sequence.

`07` through `16` define each scene.

`17_TRANSITION_BIBLE.md` is the primary transition document.

`18_MOTION_SYSTEM.md` defines timing and scroll behavior.

`19` through `24` define implementation, components, assets, responsive rules, performance, and copy.

`28_3D_PHYSICAL_STAGE.md` defines the allowed 3D language.

`29_MASTER_PHYSICAL_ASSET_PACK.md` defines the 30–50 master asset system.

`30_WEBGL_SCENE_RECIPES.md` defines scene-by-scene 3D usage.

`31_3D_TECHNICAL_SPEC.md` defines renderer/camera/material/performance implementation.

`32_ASSET_GENERATION_PROMPTS.md` defines production briefs for generated/sourced asset ingredients.

`33_SCENE_ASSET_MATRIX.md` maps the master asset pack to every scene.

`25_IMPLEMENTATION_PLAN.md` is the build order.

`26_QA_ACCEPTANCE.md` defines done.

`27_AGENT_WORK_PROTOCOL.md` tells the coding agent how to operate without drifting.


## v3 lock documents

The following files are the highest-priority implementation locks added after the v2 physical-stage direction:

- `34_LOCKED_TECH_STACK.md`
- `35_CREATIVE_LOCK.md`
- `36_10_10_10_QUALITY_RULE.md`
- `37_LOCKED_SCENE_ORDER.md`
- `38_LOCKED_DEMO_VALUES.md`
- `39_STAMP_AND_COPY_VOCABULARY.md`
- `40_ASSET_CREATION_POLICY.md`
- `41_CODEX_COMPONENT_EXPECTATIONS.md`
- `42_TYPOGRAPHY_RULES.md`
- `43_AUDIO_POLICY.md`
- `44_PERFORMANCE_HARD_LIMITS.md`
- `45_CODEX_AUTONOMY_AND_STOP_RULES.md`
- `46_MASTER_CODEX_BUILD_PROMPT.md`
- `47_HANDOFF_CHECKLIST.md`
- `48_USER_SUPPLIED_VISUAL_FILES.md`

If any older document uses softer language such as “optional R3F” or suggests generating the entire asset pack before scene work, these v3 lock documents take precedence.
