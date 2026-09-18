# 43 — Audio Policy

Audio is a finishing layer, not a dependency for product comprehension.

## Architecture

Use the Web Audio API. Add Howler.js only if it materially improves scheduling or asset management.

Audio starts muted or requires explicit user interaction according to browser autoplay restrictions.

## Candidate cues

- paper movement
- film advance / optical transport
- stamp impact
- print/mechanical hit
- short approval cue
- hard silence during Step-Up interruption
- reservation hit during concurrency
- subtle reverse texture during replay

## Rules

- no continuous obnoxious soundtrack by default
- no generic sci-fi UI bleeps
- no cyberpunk ambience
- no audio that carries essential product information alone
- reduced-motion / accessibility paths must remain meaningful without audio

## Synchronization

Audio events are triggered from the same GSAP timeline labels / normalized scene progress as the visuals.
