# 22 — Responsive and Accessibility

## Desktop

Primary art-directed experience.

Target >= 1280px width.

Use pinned scenes and multi-column/editorial compositions.

## Tablet

Reduce simultaneous elements.

- decisions can remain 3 lanes if readable, otherwise 1+2 staged
- delegation tickets can stack with shorter travel distance
- replay strip can be less diagonal
- reduce scene scroll budgets by ~15–20%

## Mobile

Do not attempt to shrink the desktop film board into a phone.

Mobile should become a **stacked retro editorial sequence**.

Rules:

- one primary artifact per viewport
- avoid long pinned sections
- use short sticky moments only where reliable
- film strips can scroll horizontally inside controlled masks
- reduce oversized money numerals to fit without wrapping
- preserve outcome colors and stamps
- keep text selectable and semantic

## Suggested mobile scene behavior

### Mandate
Stack artifact full-width with short reveal.

### Decisions
Three cards/film frames in vertical sequence; ALLOW / STEP-UP / DENY timing preserved through enter/hold/stop effects.

### Delegation
Parent ticket, then two child tickets.

### Step-Up
Full-width clearance document.

### Revocation
Horizontal strips can become vertical stacked film cells.

### Split defense
Three receipts stack/overlap, then align.

### Concurrency
Central number with left/right slips adapted to top/bottom if width is insufficient.

### Replay
Vertical film strip.

## Accessibility

- semantic headings in logical order
- all product copy exists as real text
- decorative textures `aria-hidden`
- SVG icons either decorative or labeled appropriately
- keyboard focus remains visible
- CTA is a real link/button
- no information conveyed only by color
- stamps also include readable words
- avoid rapid flashing
- motion control / reduced-motion support required

## Reduced motion

Honor `prefers-reduced-motion` automatically.

Optionally expose a visible `Reduce motion` control if the page becomes especially motion-heavy.

## Contrast

Ivory-on-black and black-on-paper should meet readable contrast at body sizes. Small muted meta text must not become too faint for aesthetics.
