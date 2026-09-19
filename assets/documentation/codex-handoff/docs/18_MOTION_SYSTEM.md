# 18 — Motion System

## Motion philosophy

The site is transition-heavy, but not constantly animated.

Motion should communicate:

- creation
- approval
- pause
- denial
- derivation
- revocation
- pattern recognition
- reservation
- reconstruction

If motion does not communicate one of those or support a transition, remove it.

## Two coordinated motion layers

### Editorial layer

DOM / SVG / CSS:

- masks
- type
- stamps
- rules
- film perforations
- hard cuts
- split-screen layout
- copy registration

### Physical stage layer

Three.js:

- Z depth
- parallax
- shadows
- slight paper bends
- spatial convergence
- camera traversal in Replay

The editorial layer remains dominant.

## GSAP architecture

Use one timeline per scene and one transition contract between scenes.

Recommended abstraction:

```ts
export type SceneController = {
  id: string;
  mount: () => void;
  destroy: () => void;
};
```

Each scene owns only its internal timeline.

Avoid one 3,000-line global timeline.

## WebGL progress architecture

Do not trigger one-way WebGL events from ScrollTrigger callbacks.

Instead, map scene timeline progress to deterministic stage progress.

Example:

```ts
const state = getStageState(progress);
stage.apply(state);
```

Scrolling backward must reconstruct the exact previous physical state.

## ScrollTrigger pattern

Pseudo-structure:

```ts
const ctx = gsap.context(() => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      pin: pinTarget,
      invalidateOnRefresh: true,
    },
  });

  tl.fromTo(...)
    .to(...)
    .addLabel('decision')
    .to(...);
}, root);

return () => ctx.revert();
```

## Scroll smoothing

Lenis is optional.

Use only if:

- desktop pointer scrolling feels harsh
- ScrollTrigger integration is stable
- reduced-motion mode bypasses it

Do not make the site unusable without smooth scrolling.

## Reversibility

Use timeline progress as the source of visual truth.

Avoid one-shot React state like:

```ts
if (progress > .6) setRevoked(true)
```

unless reverse behavior is explicitly handled.

Prefer direct GSAP/stage-progress-controlled visual state.

## Scene timing character

### Mandate
Measured, precise, shallow parallax.

### Decisions
Fast divergence, mostly graphic.

### Delegation
Controlled split with small Z separation.

### Step-Up
Approach, freeze, stamp impact, hold.

### Revocation
Sharp cascading stops and selective removal.

### Split defense
Repetition accelerates, receipts converge, then stop.

### Concurrency
Tension through opposed spatial progression.

### Replay
Reverse/reconstructive, deepest camera movement, most complex timeline.

## Reduced motion

When `prefers-reduced-motion: reduce`:

- disable pin-heavy scrub sequences
- do not initialize WebGL unless needed for a static still
- present scenes as stacked editorial panels
- preserve all information
- remove stamp impact shake
- remove continuous film transport
- keep simple opacity/clip reveals <= 150ms or none

## Avoid

- spring animation everywhere
- elastic easing
- parallax on every layer
- idle floating
- mouse-follow effects
- cursor gimmicks required for content
- scroll-jacking that prevents normal navigation
- constant camera motion
- 3D depth added without product meaning
