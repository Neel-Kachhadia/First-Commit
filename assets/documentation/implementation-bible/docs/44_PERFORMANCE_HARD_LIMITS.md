# 44 — Performance Hard Limits

Visual ambition is not permission to ship a janky portfolio demo.

## Goal

Target smooth 60fps motion on a normal modern laptop and a deliberate, reduced-complexity but equally authored mobile experience.

## WebGL

- one persistent renderer/canvas
- cap device pixel ratio by performance tier
- avoid giant uncompressed textures
- reuse geometry/materials
- dispose unused resources
- lazy-load Replay resources
- no separate canvas per section
- no full-screen expensive post stack by default

## Texture strategy

- use responsive image sizes
- use AVIF/WebP for photographic textures
- use KTX2 only where it materially reduces WebGL memory/bandwidth
- do not upload 4K textures to the GPU when a 1K/2K version is visually indistinguishable at the rendered size

Keep the archival/master source separate from runtime derivatives.

## GSAP

- avoid layout-thrashing property animation
- prefer transforms/opacity/masks
- batch reads/writes
- kill timelines and ScrollTriggers on unmount
- avoid multiple scroll engines

## Grain / noise

Never generate full-resolution per-pixel noise at 60fps.

Use:

- small repeating textures
- stepped background-position
- low-rate Canvas updates where required

## Mobile

Do not merely disable everything.

Recompose:

- reduce object count
- reduce texture resolution
- reduce camera depth
- replace some physical-stage moments with DOM/SVG equivalents
- preserve the key visual idea

## Fallbacks

Provide:

- reduced-motion mode
- no-WebGL fallback
- audio-off path
- content that remains understandable before JS enhancement

## Profiling

Before sign-off inspect:

- long tasks
- scroll jank
- layout shifts
- texture memory
- font loading
- canvas DPR
- shadow cost
- mobile GPU behavior
- Replay camera/post effects
