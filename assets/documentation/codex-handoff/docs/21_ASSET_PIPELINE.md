# 21 — Asset Pipeline

## Included visual reference

`source/KavachPay_Final_Visual_Reference.png`

Use it as an art-direction reference, not as a full-page background.

## Production approach

The website should derive from one coherent **KavachPay physical material system**, but the coding agent should create technical assets **on demand as each scene requires them** rather than pre-generating the entire inventory.

Read `40_ASSET_CREATION_POLICY.md` first. `29_MASTER_PHYSICAL_ASSET_PACK.md` is an inventory/reference library, not a requirement to create every item before scene work.

## Required asset families

### Paper surfaces

Prepare 6–8 reusable paper scans:

- clean ivory
- warm ivory
- aged ivory
- thin receipt stock
- heavier authority-card stock
- ticket/perforated stock
- dirty-edge variant
- optional translucent thin stock

### Edge masks

- torn edges
- rough cuts
- perforations
- folds
- ripped corners

Prefer grayscale/alpha masks so the same surface can create many documents.

### Film assets

- 35mm / 16mm edges
- sprocket holes
- negative borders
- frame numbers
- contact-sheet markings
- exposure/lab marks
- splice marks
- leader frames

### Print textures

- misregistration
- ink bleed
- faded type
- halftone
- dust
- sparse scratches
- photocopy/toner noise

These should be reusable overlays, not baked independently into every asset.

### SVG pictograms

- grocery basket
- delivery scooter
- airplane
- check / approval
- X / stop
- decision / scales
- budget / coins
- agent path
- delegation hierarchy
- mandate/document
- merchant/shop
- clock/expiry
- recurring
- provider result
- execution

Keep icon style flat, printed, simple.

### Stamp assets

- APPROVED
- DENIED
- HOLD FOR CLEARANCE
- REVOKED
- ONE ECONOMIC ACTION
- BLOCKED
- RESERVED
- KavachPay seal

Clean vector source + distressed mask variant preferred.

### Document templates

Build as layered HTML/SVG/live text wherever possible:

- Mandate
- Authority Pass
- Derived Authority
- Transaction Receipt
- Travel Authorization
- Merchant/Economic Action Receipt
- Reservation Slip
- Causal Replay Strip

## Photography

Use sparingly and only when product-relevant.

Possible plates:

- runway/travel detail
- grocery/merchant detail
- delivery movement
- clouds/sky continuity
- logistics/package detail
- payment context without people

No humans.
No generic cities.
No stock-photo lifestyle scenes.

## 3D material maps

Only a small set is needed:

- paper roughness
- film roughness
- subtle paper normal
- subtle film normal
- optional fingerprint/grime
- optional thin-paper translucency

Do not download a giant PBR library.

## Geometry

Generate in code:

- rectangles
- subdivided paper planes
- strips
- tickets
- receipt curls

Do not spend time modelling in Blender unless a specific approved scene later proves procedural geometry insufficient.

## Prefer live text

Most artifact text should remain DOM/SVG text, not baked into images.

Benefits:

- crisp at all resolutions
- responsive
- accessible
- easier to correct values/copy
- smaller assets

Textures and irregular ink should be overlays/masks.

## Image formats

- AVIF for photographic/large textures when visually acceptable
- WebP fallback
- SVG for line art, icons, masks
- PNG only when alpha fidelity demands it

## Generated assets

If using image generation for paper, film or photographic textures:

- remove any generated text/logos
- normalize color treatment to the master system
- crop out any human figures
- reject sci-fi/historical-computer leakage

Generated text is not acceptable for final UI.

## No humans

Asset search/generation prompts must explicitly exclude:

- person
- people
- human
- hand
- face
- silhouette
- figure
- crowd

## No historical-tech assets

Do not source:

- CRTs
- old terminals
- mainframes
- tape drives
- punch cards
- switchboards
- vintage computer controls
