# 32 — Asset Generation / Sourcing Prompts

Use these as production briefs for image-generation or sourcing. Do not generate final typography inside raster images.

## Global negative constraints

Every prompt should exclude:

- people
- hands
- faces
- silhouettes
- crowds
- historical computers
- CRT monitors
- tape reels
- punch cards
- switchboards
- cyberpunk
- neon sci-fi
- glossy fintech cards
- holograms
- futuristic cityscapes
- chrome objects
- luxury-product styling
- visible text unless specifically intended as texture noise

## Paper master prompt

> High-resolution flat-lay scan of warm ivory uncoated paper stock, subtle natural fibers, restrained age and handling, real paper grain, no writing, no printed text, no logos, no objects, no hands, neutral even illumination, physically believable, suitable as a seamless material source for a 1970s editorial print system, not distressed scrapbook paper, not burnt edges, no heavy stains.

Create variations by changing:

- cleaner / heavier stock
- thin receipt paper
- perforated ticket stock
- slightly aged stock

## Torn edge mask prompt

> Isolated irregular torn paper edge on pure black/white contrast, realistic fiber breakup, restrained natural tear, no text, no objects, no shadow baked into the edge, intended as an alpha/mask source, high resolution.

Convert to grayscale alpha after generation.

## Stamp distress prompt

Generate stamp wording as vector/live type first. Use image generation only for the **ink mask**.

> Isolated red rubber-stamp ink impression texture on neutral background, uneven ink density, subtle edge breakup, small natural gaps and dry-ink artifacts, no readable words or letters, no paper texture, suitable as a multiply/alpha mask for a 1970s administrative stamp.

## Film texture prompt

> Macro photographic texture of developed 35mm film edge and emulsion, restrained dust, subtle scratches, frame-edge markings without readable branded text, sprocket detail, authentic physical material, neutral lighting, no photographs of people, no dramatic damage.

## Travel photographic plate

> Documentary film still of aircraft/runway/travel infrastructure, no visible people, no futuristic technology, no advertising look, restrained 1970s photographic character through lens and film response only, natural daylight, physically believable, composition suitable for a narrow film-strip frame, no text.

## Grocery / merchant photographic plate

> Documentary film still of grocery/market products and merchant environment, no people or hands, natural arrangement, no modern lifestyle advertising composition, restrained 1970s film response, realistic local commercial detail, no readable brand logos, no text.

## Delivery photographic plate

> Documentary film still suggesting delivery/logistics movement without people: package, delivery vehicle detail, loading area, parcel motion, restrained photographic realism, no futuristic environment, no cyberpunk, no visible humans.

## Material-generation cleanup

After generation:

1. remove all accidental text
2. remove logos/brands
3. remove people/hands if any appear
4. normalize white balance to the KavachPay palette
5. remove baked hard shadows if the asset is intended for 3D material use
6. crop/export masters at 2K–4K
7. create runtime 1K–2K derivatives
8. document source/license/generation provenance

## Never generate a full scene as one flattened asset

The final landing page should compose:

- live type
- reusable paper
- reusable film borders
- independent stamps
- independent photos
- physical planes
- transitions

If an AI generator produces a finished scene with all text baked in, use it only as a visual reference, not production input.
