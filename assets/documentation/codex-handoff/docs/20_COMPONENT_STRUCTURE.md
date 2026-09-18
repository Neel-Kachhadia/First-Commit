# 20 — Component and Repository Structure

Suggested structure if starting fresh:

```text
app/
  page.tsx
  globals.css

components/
  kavach/
    KavachLanding.tsx
    SceneFrame.tsx
    SceneNumber.tsx
    PaperArtifact.tsx
    FilmStrip.tsx
    Stamp.tsx
    Rule.tsx
    Pictogram.tsx
    GrainOverlay.tsx
    ProgressRail.tsx
    physical-stage/
      SharedPhysicalStage.tsx
      StageCamera.tsx
      PaperPlane.tsx
      FilmPlane.tsx
      ShadowReceiver.tsx
      stage-store.ts
      scenes/
        MandateStage.tsx
        DelegationStage.tsx
        StepUpStage.tsx
        RevocationStage.tsx
        SplitDefenseStage.tsx
        ConcurrencyStage.tsx
        ReplayStage.tsx
    scenes/
      PrologueScene.tsx
      MandateScene.tsx
      DecisionsScene.tsx
      DelegationScene.tsx
      StepUpScene.tsx
      RevocationScene.tsx
      SplitDefenseScene.tsx
      ConcurrencyScene.tsx
      ReplayScene.tsx
      FinaleScene.tsx

lib/
  kavach/
    demo-state.ts
    format-money.ts
    motion.ts
    reduced-motion.ts
    scroll.ts
    texture-cache.ts
    stage-progress.ts

data/
  kavach-copy.ts

styles/
  kavach-tokens.css
  kavach-textures.css

public/
  kavach/
    paper/
    film/
    stamps/
    photography/
    documents/
    masks/
    noise/
    symbols/
    materials/
    reference/
```

## Component responsibilities

### `KavachLanding`

- page orchestration
- global progress
- reduced-motion selection
- optional Lenis setup
- physical-stage activation lifecycle

### `SharedPhysicalStage`

- owns the single renderer/canvas
- owns camera/lights
- swaps active scene group
- receives normalized scene progress
- handles DPR/performance tier
- becomes inert or unmounted in reduced-motion fallback

### `PaperPlane`

- primitive plane/subdivided plane
- paper material
- edge alpha mask
- optional bend
- optional shadow

It does not own narrative timing.

### `SceneFrame`

- consistent scene outer bounds
- optional scene number/title
- standardized CSS variables for local progress / viewport measurements

### `PaperArtifact`

- DOM/SVG version of paper texture
- edge variants: straight, torn, perforated
- ink layer
- used whenever real 3D depth is unnecessary

### `FilmStrip`

- frame cells
- perforation system
- orientation variants

### `Stamp`

- SVG/raster stamp texture
- semantic variants: approved, denied, revoked, clearance, blocked, reserved

### Scene components

Scene components own their own GSAP timeline.

They coordinate DOM and physical stage through normalized progress rather than directly mutating renderer internals.

## State

Do not use global app state for scroll animation unless needed for cross-scene navigation.

Product-demo content can live in immutable typed data.

Use a tiny Zustand store for:

- active scene id
- normalized progress
- viewport tier
- reduced-motion flag
- debug flag

Do not mix product demo data and renderer state.


## v3 note

See `41_CODEX_COMPONENT_EXPECTATIONS.md` for the current preferred `src/components/experience`, `documents`, `graphics`, `webgl`, and `audio` split. Adapt rather than rewrite a healthy existing repository.
