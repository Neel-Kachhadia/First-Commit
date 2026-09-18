# 41 — Codex Component and Repository Expectations

This is a target architecture, not a demand to rewrite a working repository. Adapt to the existing project while preserving the same separation of concerns.

```text
src/
  components/
    experience/
      Hero/
      Mandate/
      Decisions/
      Delegation/
      StepUp/
      Revocation/
      SplitPayment/
      Concurrency/
      CausalReplay/
      Closing/

    documents/
      MandateDocument.tsx
      AuthorityPass.tsx
      DerivedAuthorityPass.tsx
      TransactionReceipt.tsx
      ClearanceDocument.tsx
      EvidenceRecord.tsx
      ReplayLayer.tsx

    graphics/
      DecisionStamp.tsx
      FilmStrip.tsx
      Seal.tsx
      Pictogram.tsx

    webgl/
      ExperienceCanvas.tsx
      StageCamera.tsx
      PaperPlane.tsx
      PhysicalDocument.tsx
      FilmPlane.tsx
      ReplayStage.tsx

    audio/
      AudioEngine.ts

  lib/
    motion/
    assets/
    scene-state/
    performance/

  styles/

public/
  assets/
    kavachpay/

tools/
  generate-assets/

tests/
  visual/
```

## Responsibility boundaries

### Experience scenes

Own narrative composition and local GSAP timelines.

### Document components

Own live HTML/SVG physical artifacts and their semantic content.

### Graphics

Own reusable stamps, rules, seals, film strips, and pictograms.

### WebGL

Own the single persistent React Three Fiber canvas and primitive physical geometry.

### Audio

Own event-driven cue loading, enable/mute state, and timeline hooks.

## One persistent canvas

Use one shared WebGL canvas across the landing page. Do not mount a new renderer per section.

Share:

- renderer
- camera
- lights
- texture cache
- common materials
- performance tier

Scene groups may mount/unmount inside the shared canvas as needed.

## GSAP / WebGL synchronization

Each cinematic scene should expose normalized progress. The same progress value drives:

- DOM transforms
- SVG masks
- stamps
- camera position
- 3D object transforms
- audio cues

Do not maintain separate unsynchronized time systems.
