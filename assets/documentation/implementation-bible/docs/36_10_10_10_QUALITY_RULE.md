# 36 — 10 / 10 / 10 Quality Rule

There are no filler frames.

The required quality curve is:

**10 -> 10 -> 10 -> 10 -> 10**

Not:

**10 -> 7 -> 8 -> 6 -> 10**

## Scope of the rule

Every:

- resting frame
- transition frame
- WebGL frame
- mobile frame
- product-document frame
- reduced-motion hero state

must be intentionally composed.

No scene is allowed to rely on the next scene to become good.

## Screenshot checkpoint protocol

For every major sequence, capture at approximately:

- 0%
- 25%
- 50%
- 75%
- 100%

Use Playwright or a deterministic debug route that can set scene progress directly.

Review each screenshot as a static key visual.

## Every checkpoint must pass

### Composition

- clear hierarchy
- no accidental dead zones
- no awkward overlaps
- balanced negative space
- no “objects moving between good states” look

### Product meaning

The frame is still connected to a specific KavachPay behavior.

### Originality

It does not collapse into generic fintech / AI / Awwwards vocabulary.

### Typography

- crisp
- intentional scale
- correctly spaced
- integrated into composition
- no orphaned labels

### Material quality

- paper/film/ink feel physical
- textures do not overpower type
- shadows are believable
- no obvious tiling

### Motion-state quality

Paused midway, objects are still deliberately arranged.

### Colour

- disciplined near-black / ivory / red system
- no muddy generic sepia wash
- no uncontrolled colour drift

### Depth

Where 3D is used:

- perspective is intentional
- planes do not expose the cheapness of primitive geometry
- Z-space improves comprehension

### Readability

Important amounts and decisions remain legible.

### Identity

The frame belongs to the same KavachPay world as the approved board.

## Transition rule

Never move an object offscreen merely to clear the stage.

Its departure should create or reveal the next composition.

Examples:

- torn paper edge becomes the next scene boundary
- receipt ink expands into the next black field
- stamp impact reorganizes layout into the next state
- film frame enlarges into the next section
- replay layer becomes the next causal layer

## Minimal frames are allowed

Breathing room may be:

- one giant word
- one isolated document
- one stamp
- one technical evidence line
- one black field with microscopic type

Minimal does not mean lower quality.

## Technical-complexity rule

A difficult effect does not earn a place because it was difficult.

If a simple typographic frame is 10/10 and a shader is 8/10, delete the shader.

**Maximum visual quality per second beats maximum technical complexity.**
