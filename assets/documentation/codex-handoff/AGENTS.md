# AGENTS.md — KavachPay Landing Page

This repository is implementing a **cinematic, retro-print KavachPay landing page**, not a conventional SaaS landing page and not a generic fintech dashboard.


## V3 mandatory locks — read before all implementation details

After `docs/00_README.md`, immediately read:

1. `docs/34_LOCKED_TECH_STACK.md`
2. `docs/35_CREATIVE_LOCK.md`
3. `docs/36_10_10_10_QUALITY_RULE.md`
4. `docs/37_LOCKED_SCENE_ORDER.md`
5. `docs/38_LOCKED_DEMO_VALUES.md`
6. `docs/39_STAMP_AND_COPY_VOCABULARY.md`
7. `docs/40_ASSET_CREATION_POLICY.md`
8. `docs/41_CODEX_COMPONENT_EXPECTATIONS.md`
9. `docs/42_TYPOGRAPHY_RULES.md`
10. `docs/43_AUDIO_POLICY.md`
11. `docs/44_PERFORMANCE_HARD_LIMITS.md`
12. `docs/45_CODEX_AUTONOMY_AND_STOP_RULES.md`
13. `docs/46_MASTER_CODEX_BUILD_PROMPT.md`
14. `docs/47_HANDOFF_CHECKLIST.md`
15. `docs/48_USER_SUPPLIED_VISUAL_FILES.md`

These v3 locks override softer/older wording elsewhere.

## Read order

Before touching code, read these files in order:

1. `docs/00_README.md`
2. `docs/01_NORTH_STAR.md`
3. `docs/02_SOURCE_OF_TRUTH_AND_PRECEDENCE.md`
4. `docs/03_PRODUCT_TRUTH.md`
5. `docs/04_VISUAL_LANGUAGE.md`
6. `docs/05_DESIGN_TOKENS.md`
7. `docs/06_PAGE_ARCHITECTURE.md`
8. `docs/17_TRANSITION_BIBLE.md`
9. `docs/18_MOTION_SYSTEM.md`
10. `docs/19_TECH_ARCHITECTURE.md`
11. `docs/21_ASSET_PIPELINE.md`
12. `docs/28_3D_PHYSICAL_STAGE.md`
13. `docs/29_MASTER_PHYSICAL_ASSET_PACK.md`
14. `docs/30_WEBGL_SCENE_RECIPES.md`
15. `docs/31_3D_TECHNICAL_SPEC.md`
16. `docs/32_ASSET_GENERATION_PROMPTS.md`
17. `docs/33_SCENE_ASSET_MATRIX.md`
18. `docs/25_IMPLEMENTATION_PLAN.md`
19. `docs/26_QA_ACCEPTANCE.md`

Then read the individual scene documents before implementing each scene.

## Highest-priority rules

### 1. Product behavior first

The governing equation is:

**KavachPay behavior -> cinematic idea -> visual execution**

Never start from a cool visual and search for a product feature to justify it.

### 2. No humans

No people, faces, hands, silhouettes, crowds, actors, lifestyle photography, human portraits, or human-shaped figures anywhere in the landing-page visuals.

### 3. No unrelated world-building

No cities, futuristic society shots, breakfast/lifestyle scenes, generic commerce scenes, speculative architecture, or environments that would still work if KavachPay were removed.

### 4. Retro is graphic/cinematic, not obsolete technology

Do not use CRTs, old computers, tape reels, punch cards, switchboards, vintage terminals, green monochrome screens, NASA control rooms, analog-computer fetishism, steampunk, dieselpunk, or historical machinery.

### 5. Transitions dominate; 3D is a physical compositing stage

The site should feel expensive primarily because of:

- hard cuts
- masks
- paper-edge wipes
- film-strip transport
- stamp impacts
- print registration
- split-screen recomposition
- match cuts
- reversal / replay

Use lightweight 3D only to give **paper, film, receipts, tickets and evidence strips** real depth, parallax, shadows and camera movement.

Do not build a 3D world.

Do not model elaborate hero objects.

The approved 3D mental model is:

> **a physical film-compositing stage made mostly from thin textured planes.**

Target implementation balance:

- ~55–65% layout, typography, masks, editorial composition and transition choreography
- ~20–25% asset/material craft: paper, print, film, photography, stamps
- ~10–20% lightweight WebGL / CSS depth
- Causal Replay is the one scene allowed to become a true spatial climax

### 6. One shared WebGL stage

If WebGL is used, prefer one shared renderer/canvas across all 3D-enhanced scenes. Reuse primitive geometry and materials. Do not create separate heavy canvases per section.

### 7. The final reference board is canonical

Use `source/KavachPay_Final_Visual_Reference.png` as the visual source of truth.

Do not drift back to earlier ideas such as:

- cinematic people
- city world-building
- modern SaaS step-up card
- giant floating UI
- generic dark sci-fi
- single giant “authority machine”

### 8. Build a film-like scroll experience, not 10 cards

Each scene is a moving editorial composition. Sections should pin, cut, reveal, tear, stamp, slide, split, converge, rewind, and recompose.

### 9. Motion must be reversible

Scroll-driven animation must remain correct when the user scrolls backward. Avoid one-way state mutation that desynchronizes visuals from scroll progress.

### 10. Do not fake product claims

The landing page can present the product concept, but it must not claim live autonomous UPI/card-network production integrations. Sandbox/test-mode language must remain honest when execution is mentioned.

### 11. No AI slop

Reject anything that resembles:

- generic glassmorphism
- gradient blobs
- neon cyberpunk
- floating cards in dark space
- glowing node graphs
- chrome spheres
- random 3D objects
- huge lonely environments
- “premium” beige minimalism unrelated to the board
- excessive grain used as a shortcut for retro
- complex 3D added only to show technical skill

## Stop conditions

Do not proceed to the next scene if the current one fails the Product, Cinema, Necessity, Reference, and Physicality tests in `docs/26_QA_ACCEPTANCE.md`.


## 10 / 10 / 10 stop condition

A scene is not complete until its 0%, 25%, 50%, 75%, and 100% Playwright checkpoints all look intentional as still frames. See `docs/36_10_10_10_QUALITY_RULE.md`.

## Asset autonomy

Do not stop because a technical asset is missing. Create the minimal required mask/SVG/overlay/material derivative/procedural geometry and continue. See `docs/40_ASSET_CREATION_POLICY.md` and `docs/45_CODEX_AUTONOMY_AND_STOP_RULES.md`.
