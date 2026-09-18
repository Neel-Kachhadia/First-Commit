# 27 — AI Agent Work Protocol

This file tells an autonomous coding agent how to execute the project without losing the art direction.

## Before every implementation phase

1. Read the relevant scene document.
2. Open the final reference board.
3. State which product behavior the scene communicates.
4. State the dominant transition technique.
5. List the assets needed.
6. Confirm that no human/unrelated imagery is required.
7. Decide whether the scene is DOM/SVG-only or needs the shared physical stage.
8. If using 3D, state exactly what semantic purpose the Z-depth/camera movement serves.

WebGL is approved only for the primitive physical-stage language defined in `28_3D_PHYSICAL_STAGE.md`.

Do not add complex geometry or a new renderer for a single scene.

## During implementation

Keep changes narrow.

Do not simultaneously redesign typography, change copy, add libraries, and rebuild animation architecture in one step.

Use screenshots after every major scene.

## Visual review loop

For each scene:

1. capture 0% frame
2. capture 25% frame
3. capture 50% frame
4. capture 75% frame
5. capture 100% frame
6. compare every checkpoint to the reference system
7. check Product/Cinema/Necessity and 10/10/10 gates

Do not judge only by watching the animation live.

## Code review loop

Check:

- timeline cleanup
- strict TypeScript types
- no duplicated constants
- no asset URLs scattered through components
- no magic scroll heights buried in JSX
- semantic HTML preserved
- reduced-motion path works

## Do not create speculative product behavior

If the design requires a product claim not present in `docs/03_PRODUCT_TRUTH.md`, stop and surface it as a question rather than inventing it.

## Do not use placeholder lorem ipsum

Use `docs/24_COPY_DECK.md`.

## Do not use generated text inside images

All important copy should be real HTML/SVG text.

## Completion report

When implementation is complete, report:

- files changed
- libraries added/removed
- page route
- performance observations
- responsive behavior
- reduced-motion behavior
- unresolved visual mismatches
- any product claims intentionally omitted
- screenshots for each scene

## Definition of success

A visitor should be able to understand the major KavachPay behaviors while feeling that the page belongs to the exact visual family of the reference board.

The implementation should feel transition-rich and graphic, with 3D perceived as invisible physical craftsmanship rather than spectacle.


## v3 autonomy

Read `45_CODEX_AUTONOMY_AND_STOP_RULES.md`. Missing technical assets are not a reason to stop; create them on demand.
