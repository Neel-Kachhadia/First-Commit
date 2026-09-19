# 46_MASTER_CODEX_BUILD_PROMPT.md — KavachPay Final Build Task

You are responsible for implementing the complete KavachPay cinematic landing page inside the existing repository.

Do not start by writing code immediately.

First establish the source-of-truth hierarchy, inspect the current repository, read the required documentation, inspect the visual reference and approved source materials, then implement the experience scene by scene.

---

# 1. Working repository

The repository root is:

```text
D:\KavachPay
```

Work inside the existing project. Do not initialize a second project or create a parallel app unless the current repository is demonstrably unusable.

Preserve the existing Git history and project configuration unless a documented implementation requirement makes a change necessary.

---

# 2. Mandatory source-of-truth order

Use this precedence when resolving conflicts:

1. `D:\KavachPay\AGENTS.md`
2. `D:\KavachPay\46_MASTER_CODEX_BUILD_PROMPT.md`
3. `D:\KavachPay\assets\documentation\implementation-bible\`
4. `D:\KavachPay\assets\product\KavachPay_Agentic_Money_Control_Plane.html`
5. `D:\KavachPay\assets\documentation\codex-handoff\`

The `implementation-bible` is the primary detailed implementation documentation.

The `codex-handoff` folder is supporting material only.

If duplicated content exists, do not waste time reconciling identical copies unless an actual conflict appears.

---

# 3. Required reading before implementation

Read in this order:

1. `AGENTS.md`
2. this file, `46_MASTER_CODEX_BUILD_PROMPT.md`
3. `assets/documentation/implementation-bible/MANIFEST.md`
4. `assets/documentation/implementation-bible/docs/00_README.md`
5. the locked v3 documents `34` through `48`
6. the remaining bible documents according to its prescribed read order
7. the canonical product brief
8. the scene-specific document immediately before building each scene

Do not begin scene implementation until this reading is complete.

---

# 4. Canonical visual reference

The master visual reference is:

```text
D:\KavachPay\assets\documentation\implementation-bible\source\KavachPay_Final_Visual_Reference.png
```

Treat it as the visual source of truth for:

- palette
- typography character
- document language
- paper usage
- stamp vocabulary
- film-strip treatment
- density
- black / ivory / red balance
- physical-print character
- overall authorship

Do not drift back toward discarded directions such as:

- humans
- cinematic portraits
- city world-building
- generic sci-fi rooms
- giant floating UI
- modern SaaS step-up cards
- cyberpunk
- historical computers
- arbitrary 3D spectacle

---

# 5. Canonical product brief

Use:

```text
D:\KavachPay\assets\product\KavachPay_Agentic_Money_Control_Plane.html
```

as the canonical product source of truth.

The product brief determines **what KavachPay does**.

The implementation bible and approved visual reference determine **how those behaviors become cinema**.

Do not copy the visual styling of the HTML product brief into the landing page.

Do not invent product capabilities that the brief does not support.

---

# 6. Approved source materials

The following five paper textures are approved source materials:

```text
D:\KavachPay\assets\materials\paper\PAPER_01_MASTER_IVORY_4K.jpeg
D:\KavachPay\assets\materials\paper\PAPER_02_HANDLED_AUTHORITY_4K.jpeg
D:\KavachPay\assets\materials\paper\PAPER_03_THIN_RECEIPT_4K.jpeg
D:\KavachPay\assets\materials\paper\PAPER_04_TICKET_STOCK_4K.jpeg
D:\KavachPay\assets\materials\paper\PAPER_05_OFFICIAL_DOCUMENT_4K.jpeg
```

These originals are protected.

Do not:

- overwrite them
- rename them
- recolor them
- resize them in place
- recompress them in place
- regenerate replacements

If optimized runtime copies are required, create derivatives under:

```text
public/assets/kavachpay/
```

Preserve the source originals in `assets/materials/paper/`.

---

# 7. Locked technical stack

Use:

- Next.js
- React
- TypeScript
- App Router
- GSAP
- GSAP ScrollTrigger
- Lenis
- Three.js
- React Three Fiber
- `@react-three/drei`
- Zustand
- CSS Modules
- CSS Custom Properties
- HTML / SVG / CSS for live document components
- Web Audio API where useful
- Playwright
- Vitest where useful
- Vercel-compatible architecture

Do not introduce:

- Framer Motion for the cinematic sequences
- Tailwind as the primary art-direction layer
- generic UI kits
- a second scroll animation system
- unnecessary component libraries
- unnecessary heavyweight 3D frameworks

GSAP is the primary cinematic motion system.

---

# 8. Governing creative equation

Use this sequence for every major visual decision:

> **KavachPay behavior → cinematic idea → visual execution**

Never begin from an arbitrary effect and then search for product copy to justify it.

If a visual moment does not exist because of a specific KavachPay behavior, question whether it belongs.

---

# 9. Hard creative prohibitions

## No humans

No:

- people
- faces
- hands
- bodies
- silhouettes
- crowds
- portraits
- human-shaped figures
- lifestyle photography

## No irrelevant world-building

No generic:

- cities
- futuristic environments
- speculative architecture
- lifestyle scenes
- shopping imagery
- travel imagery

unless the specific KavachPay behavior requires that material and the composition cannot survive unchanged without KavachPay.

## No obsolete-tech retro clichés

No:

- CRTs
- tape reels
- punch cards
- switchboards
- vintage terminals
- old mainframes
- green-screen terminals
- retro control rooms
- cyberpunk
- steampunk
- dieselpunk

The film language is retro. The fictional technology is not obsolete.

## No generic AI / SaaS visual language

Reject:

- glassmorphism
- floating translucent cards
- gradient blobs
- glowing node graphs
- chrome spheres
- holograms
- generic giant 3D objects
- giant coins
- shields
- robots
- wet reflective black floors
- arbitrary god rays
- “premium” beige minimalism unrelated to the board

---

# 10. Visual language

The visual system uses:

- near-black
- warm ivory paper
- deep administrative red
- restrained approval green only where established
- institutional print
- authority passes
- receipts
- official forms
- film strips
- evidence records
- stamps
- seals
- editorial typography
- physical shadows
- restrained print imperfections
- hard cuts
- masks
- match cuts
- authored transitions
- selective physical depth

The result should feel like one directed film/print system rather than a collection of website sections.

---

# 11. 3D / WebGL model

The WebGL layer is a **physical film-compositing stage**, not a 3D world.

Use primitive geometry where possible:

- planes
- strips
- slightly bent paper
- receipts
- tickets
- film frames
- lightly extruded cards only where real thickness is visible

Most visual quality must come from:

- typography
- document art direction
- materials
- layout
- lighting
- camera
- shadows
- transitions
- timing
- sound

Causal Replay receives the strongest spatial/WebGL treatment.

Prefer one persistent shared WebGL canvas/renderer rather than independent heavy canvases per section.

---

# 12. Runtime asset policy

Create technical assets **only when the current scene requires them**.

Do not spend the first phase generating a speculative asset library.

Allowed procedural tools include:

- Python
- Pillow
- NumPy
- OpenCV
- SVG generation
- Canvas
- CSS
- Three.js
- ImageMagick where available

Store generation scripts in:

```text
tools/generate-assets/
```

Store browser/runtime assets in:

```text
public/assets/kavachpay/
```

Suggested folders:

```text
public/assets/kavachpay/
  materials/
  masks/
  stamps/
  film/
  overlays/
  shadows/
  symbols/
  photography/
```

If a technical mask, perforation, stamp, film strip, texture derivative, shadow, symbol, or overlay is missing, create it rather than reducing the visual quality.

If an asset is ultimately unused, delete it during final cleanup.

---

# 13. Live document components

Do not flatten major KavachPay documents into generated raster images.

Build reusable live HTML/SVG/CSS components wherever practical, including:

- `Mandate`
- `AuthorityPass`
- `DerivedAuthorityPass`
- `TransactionReceipt`
- `ClearanceDocument`
- `DecisionStamp`
- `RevocationStrip`
- `EvidenceRecord`
- `ReplayLayer`

The following kinds of values must remain animatable and sharp:

```text
₹4,000 / WEEK
> ₹1,500
₹1,249
₹4,900
₹799
₹500
₹0
```

---

# 14. Locked scene order

Build in this order:

```text
00  OPENING / HERO
01  MANDATE
02  ALLOW / STEP-UP / DENY
03  DELEGATION
04  STEP-UP CLEARANCE
05  REVOCATION
06  SPLIT-PAYMENT DEFENSE
07  BUDGET / CONCURRENCY
08  CAUSAL REPLAY
09  CLOSING
```

Do not add generic:

- Features
- Testimonials
- Pricing
- FAQ
- SaaS CTA sections

unless explicitly requested later.

---

# 15. Product behaviors to preserve

The finished film must clearly communicate:

- bounded mandate / deterministic financial intent
- ALLOW / STEP-UP / DENY
- derived authority without amplification
- one-time clearance
- lineage-aware revocation
- split-payment correlation
- atomic competition for remaining budget
- causal replay

Use:

```text
assets/documentation/implementation-bible/docs/38_LOCKED_DEMO_VALUES.md
assets/documentation/implementation-bible/docs/39_STAMP_AND_COPY_VOCABULARY.md
```

for canonical demo values/copy unless the product brief or approved board explicitly overrides them.

---

# 16. Transition philosophy

Transitions are a primary part of the visual spectacle.

Do not use generic fade/slide/blur/scale/parallax as the main scene language.

Prefer transitions in which the current composition physically creates the next:

- torn paper edge becomes the next frame boundary
- film frame expands into the following scene
- receipt ink fills the viewport into the next black field
- `REVOKED` impact restructures the composition
- receipts align into `ONE ECONOMIC ACTION`
- `₹500` becomes the concurrency aperture/state
- replay reconstructs previously seen material with new causal meaning

Objects should not merely leave the viewport.

Their departure should help build the next composition.

All scroll-driven motion must remain correct in reverse.

---

# 17. 10 / 10 / 10 rule

There are no filler frames.

Every:

- resting frame
- transition frame
- WebGL frame
- mobile frame

must be intentionally composed.

For every major sequence, create deterministic checkpoint screenshots at approximately:

```text
0%
25%
50%
75%
100%
```

Use Playwright and/or a deterministic scene-progress/debug route.

Reject and refine any checkpoint containing:

- weak hierarchy
- awkward empty space
- accidental overlap
- unreadable typography
- generic composition
- weak physical material treatment
- bad perspective
- obvious primitive geometry
- uncontrolled texture noise
- unfinished transition state
- mobile layout that merely stacks desktop content

Do not move to the next scene until the current scene passes.

The visual progression must remain:

> **10 → 10 → 10 → 10 → 10**

---

# 18. Scene build loop

For each scene:

1. read its bible document
2. build the static hero composition
3. make the static composition excellent before adding motion
4. identify only the missing assets required for this scene
5. create/derive those assets
6. integrate them
7. build the authored transition choreography
8. add selective 3D only if real depth improves meaning or physicality
9. capture 0/25/50/75/100 screenshots
10. inspect each screenshot as a standalone frame
11. refine until all pass
12. verify backward scrolling
13. verify mobile composition
14. verify performance
15. only then continue

Do not scaffold all scenes as rough placeholders before completing the first one.

Begin with **Opening / Hero + Mandate**.

---

# 19. Scene-specific product direction

## 00 / Opening / Hero

Introduce KavachPay through the established physical print/film system. The hero must immediately establish the visual authorship without relying on generic 3D spectacle.

## 01 / Mandate

Express bounded financial authority using the mandate artifact and deterministic constraints.

## 02 / Allow / Step-Up / Deny

Use three distinct cinematic grammars:

- ALLOW = continuity
- STEP-UP = interruption
- DENY = inability to complete

## 03 / Delegation

Derived authority must feel physically carved/transferred from parent authority. Do not use a glowing node graph.

## 04 / Step-Up Clearance

Use the approved formal clearance-document language:

```text
TRAVEL AGENT
₹4,900
AUTOMATIC LIMIT ₹3,000

HOLD FOR CLEARANCE
REFER FOR APPROVAL

CLEAR ONCE
DECLINE
```

Do not revert to a modern rounded SaaS card.

## 05 / Revocation

Shopping stops.
Grocery stops.
Delivery stops.
Travel continues.

That final unrelated continuation is essential to communicate lineage-aware revocation rather than global shutdown.

## 06 / Split-Payment Defense

```text
₹1,000
₹1,000
₹1,000
```

Separate actions progressively correlate into:

```text
ONE ECONOMIC ACTION
BLOCKED
```

## 07 / Budget / Concurrency

```text
₹500 REMAINING
```

Two requests compete.
One reserves.
State becomes:

```text
₹0
```

The second can no longer proceed.

## 08 / Causal Replay

This is the spatial climax.

Use physical layers such as:

```text
MANDATE
DELEGATION
AGENT PATH
BUDGET STATE
DECISION
EXECUTION
PROVIDER RESULT
```

The camera should travel through causality and then reconstruct/revisit it.

## 09 / Closing

Conclude with a strong final authored composition rather than a generic CTA card.

---

# 20. Performance requirements

Target smooth motion on a normal modern laptop.

- use one persistent WebGL stage where practical
- share renderer, camera, lights, geometry, and materials
- cap device pixel ratio when necessary
- lazy-load expensive assets
- avoid unnecessary 4K runtime textures on mobile
- dispose unused GPU resources
- provide reduced-motion behavior
- provide non-WebGL fallback
- deliberately recompose mobile layouts

Do not make desktop exceptional and mobile merely acceptable.

---

# 21. Validation before completion

Before declaring the project complete, verify:

- the canonical visual reference was followed
- the five approved source papers remain unchanged
- no humans were introduced
- no obsolete-tech retro clichés were introduced
- no generic city/world-building filler was introduced
- no generic SaaS sections were added
- each scene maps to a KavachPay behavior
- reverse scroll remains correct
- checkpoint screenshots pass the 10/10/10 rule
- mobile is intentionally recomposed
- WebGL has a graceful fallback
- reduced motion works
- product claims remain honest
- unused generated assets are removed
- runtime assets are stored cleanly under `public/assets/kavachpay/`
- technical generation scripts are stored under `tools/generate-assets/`

---

# 22. Final standard

The result must not feel like:

> **“fintech with retro styling”**

or:

> **“a WebGL demo wearing KavachPay branding.”**

It must feel like one authored KavachPay film/print system where product behavior, editing, typography, physical materials, transitions, sound, and selective spatial depth operate as one language.

If a complicated effect is weaker than a simpler composition, remove it.

> **Maximum visual quality per second is more important than maximum technical complexity.**
