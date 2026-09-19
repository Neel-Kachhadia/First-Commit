# 40 — On-Demand Asset Creation Policy

The coding agent is responsible for building the landing page **and** creating technical assets when the current scene requires them.

Do not finish a giant speculative asset pack before implementation.

The preferred loop is:

**scene requirement -> composition -> identify missing asset -> create asset -> integrate -> screenshot -> refine**

## User-supplied canonical assets

The user supplies the approved visual board and the canonical paper textures separately. The agent must not overwrite them.

Expected paper family:

```text
PAPER_01_MASTER_IVORY_4K
PAPER_02_HANDLED_AUTHORITY_4K
PAPER_03_THIN_RECEIPT_4K
PAPER_04_TICKET_STOCK_4K
PAPER_05_OFFICIAL_DOCUMENT_4K
```

## Create technical assets locally

Use, where appropriate:

- Python
- Pillow
- NumPy
- OpenCV
- SVG generation
- CSS
- Canvas 2D
- Three.js procedural geometry
- ImageMagick if available

Do not call generative-image APIs as part of the production build unless explicitly authorized.

## Generated asset categories

```text
public/assets/kavachpay/
  masks/
  stamps/
  film/
  overlays/
  materials/
  shadows/
  symbols/
```

Generation scripts belong under:

```text
tools/generate-assets/
```

## Typical on-demand technical assets

### Masks

- torn edges
- rough cuts
- horizontal perforations
- vertical perforations
- ripped corners

### Stamps / seals

- APPROVED
- DENIED
- HOLD FOR CLEARANCE
- REVOKED
- RESERVED
- BLOCKED
- ONE ECONOMIC ACTION
- KavachPay circular seal

### Film

- 35mm/16mm strip geometry
- sprocket holes
- frame borders
- leader marks
- frame counters
- splice/registration marks

### Overlays

- ink bleed
- print misregistration
- halftone
- photocopy texture
- sparse dust
- restrained film grain

### Material maps

Derive from canonical paper/film sources where possible:

- paper roughness
- paper normal/bump
- film roughness

### Shadows

Prefer runtime soft shadows when possible. For DOM-only fallback, generate reusable shadow sprites only when needed.

### Symbols

Simple printed SVG pictograms only. Keep iconography subordinate to typography.

## Major documents are live components

Do not flatten major KavachPay documents into JPEGs.

Build reusable HTML/SVG components such as:

```text
<MandateDocument />
<AuthorityPass />
<DerivedAuthorityPass />
<TransactionReceipt />
<ClearanceDocument />
<DecisionStamp />
<RevocationStrip />
<EvidenceRecord />
<ReplayLayer />
```

Benefits:

- sharp type at all resolutions
- live/animatable values
- accessible text
- responsive layouts
- fewer raster assets
- consistent art direction

## Asset hygiene

If an asset is not used by the final experience, remove it.

Do not keep exploratory files in the production bundle.
