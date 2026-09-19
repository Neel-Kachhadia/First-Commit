# 29 — KavachPay Master Physical Asset Pack

## Goal

Create the visual ingredients once, then reuse them across every scene.

This prevents drift where one section looks like government paperwork, another like a newspaper, another like Blade Runner, and another like a modern fintech ad.

Target **30–50 master assets**. Most scenes should be compositions of reusable assets plus live typography.

Recommended directory:

```text
public/kavach/
  paper/
  film/
  stamps/
  photography/
  documents/
  type/
  masks/
  noise/
  symbols/
  materials/
```

## 1. Paper surfaces — 6 to 8 masters

Create at 2K–4K source resolution, then export optimized runtime versions.

Suggested masters:

1. `paper_ivory_clean`
2. `paper_ivory_warm`
3. `paper_ivory_aged`
4. `paper_receipt_thin`
5. `paper_authority_heavy`
6. `paper_ticket_perforated`
7. `paper_dirty_edge`
8. `paper_translucent_thin` optional

Deliverables per useful master:

- base color / albedo
- grayscale roughness if needed
- alpha edge variant if needed
- optional subtle normal/bump map

Do not bake important text into paper textures.

## 2. Edge masks — 8 to 12 reusable masks

Grayscale or alpha masks:

- torn top A/B
- torn bottom A/B
- torn left/right
- rough cut A/B
- perforated horizontal
- perforated vertical
- folded corner
- ripped corner

These masks should be composable so one paper texture can create many unique artifacts.

## 3. Film assets — 6 to 10 masters

Create reusable pieces for:

- 35mm edge
- 16mm edge
- sprocket-hole strip
- frame numbers
- exposure / lab marks
- contact-sheet border
- leader frame
- splice mark
- negative border
- film scratch/dust overlay

Keep them modular. Avoid one giant baked film-strip PNG.

## 4. Print / imperfection overlays — 8 to 12 masters

Small tileable overlays:

- black ink bleed
- red ink bleed
- green approval ink
- misregistration X
- misregistration Y
- halftone coarse
- halftone fine
- photocopy noise
- faded type
- uneven toner
- light dust
- sparse scratches

Use these as overlays/masks. Do not bake a unique “retro effect” into every scene.

## 5. Stamps — 8 primary assets

Required:

- `APPROVED`
- `DENIED`
- `HOLD FOR CLEARANCE`
- `REVOKED`
- `RESERVED`
- `BLOCKED`
- `ONE ECONOMIC ACTION`
- KavachPay circular seal

Optional:

- `REFER FOR APPROVAL`
- `VOID`
- `CLEARED`

Preferred production format:

- clean SVG/vector source
- distressed SVG or alpha mask variant
- red/green ink texture separate from geometry when possible

## 6. Document templates — 8 masters

Build primarily as layered HTML/SVG/live text, not flattened images.

Templates:

1. Spending Mandate
2. Authority Pass — parent
3. Derived Authority Pass
4. Transaction Receipt
5. Travel Authorization Request
6. Merchant Receipt / Economic Action slip
7. Reservation slip
8. Causal Replay evidence strip

Each template should expose values as data props.

Example:

```ts
<DocumentReceipt
  amount={1000}
  merchant="MARKET MART"
  city="MUMBAI"
  time="10:03"
  agent="ZEPTO"
  purpose="GROCERY"
/>
```

## 7. Photographic plates — 8 to 15 images maximum

Photography is supporting material, not the visual system.

If used, it should feel like stills from the same fictional film and should be tightly related to product behavior.

Possible categories:

- travel / runway / aircraft detail
- grocery / market detail
- delivery movement
- merchant environment
- clouds / sky for film strip continuity
- payment context close-up without humans
- package / logistics detail
- infrastructure detail

Rules:

- no visible humans
- no lifestyle scenes
- no generic future city
- no sci-fi imagery
- no historical computers
- no stock-photo sheen

## 8. Symbols / pictograms — 10 to 16 masters

Simple print-style SVGs:

- grocery basket
- delivery scooter
- airplane
- check
- X / stop
- scales / decision
- coins / budget
- path
- delegation hierarchy
- mandate/document
- merchant/shop
- clock/expiry
- recurring
- approval / hold
- provider result
- execution

Icons should feel printed, not app-icon glossy.

## 9. 3D material maps — very small set

Only create what the primitive stage needs:

- paper roughness
- film roughness
- subtle paper normal
- subtle film normal
- optional fingerprint / surface grime
- optional paper translucency map

Do not build a broad PBR library.

## 10. Geometry — procedural, not authored assets

Generate in code:

- flat paper planes
- subdivided paper planes
- film strips
- ticket strips
- receipt curls
- shallow shadow receivers

Do not model these in Blender unless a runtime procedural version clearly fails.

## Runtime export targets

### Large paper / photo textures

- source: 2048–4096 px
- runtime: typically 1024–2048 px
- format: AVIF/WebP where alpha not needed

### Alpha textures / torn edges

- 1024–2048 px
- WebP/PNG depending alpha quality

### Small tile overlays

- 256–1024 px
- keep tiny and repeatable

### SVG

- optimize with SVGO
- remove editor metadata
- preserve viewBox

## Naming convention

```text
paper_ivory_clean_v01.webp
paper_receipt_thin_v02.webp
mask_torn_top_a.svg
mask_perforation_vertical.svg
film_35mm_edge_a.svg
stamp_hold_for_clearance.svg
stamp_hold_for_clearance_distress.webp
photo_travel_runway_01.avif
mat_paper_roughness_01.webp
```

## Asset quality gate

Reject an asset if:

- it contains generated nonsense text
- it introduces visible people
- it looks cyberpunk
- it looks like a historical computer prop
- it has baked-in lighting that conflicts with the 3D stage
- it uses a different paper/ink family than the rest of the system
- it is so distressed that legibility suffers

## Master rule

> **The asset pack is the production designer.**

If the asset pack is coherent, primitive geometry will look authored. If the asset pack is inconsistent, no amount of WebGL can save the site.
