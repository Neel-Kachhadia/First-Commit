# 14 — Scene 07: Budget / Concurrency

## Product behavior

Two autonomous requests compete for the final available budget. Only one may reserve it.

Canonical visual:

`₹500 REMAINING`

Left slip: `₹500 CAFE`

Right slip: `₹500 BOOKS`

One becomes `RESERVED`.

Remaining becomes `₹0`.

The other fails to continue.

## Composition

Minimal, graphic scene with spatial tension.

- huge central `₹500`
- `REMAINING` below
- two transaction slips approaching from opposite sides/depths
- central state plane/axis

Typography remains the hero.

## 3D treatment

This is the second-best genuine 3D moment after Replay.

Use two paper planes approaching one shared reservation plane from slightly different angles and Z positions.

Example start:

```text
left:  x=-1.0 z=-0.25 ry=+5deg
right: x=+1.0 z=+0.18 ry=-5deg
```

Both approach.

At commit:

- one crosses the reservation threshold
- `RESERVED` appears
- central DOM value hard-cuts from `₹500` to `₹0`
- losing plane stops immediately and slightly recedes

The spatial collision should help explain shared state without becoming a race-game animation.

## Motion

0.00–0.18 — central ₹500 appears.

0.18–0.42 — both slips move toward center at nearly the same pace.

0.42–0.60 — tension through small alternating advances; no cartoon racing.

0.60–0.70 — one request commits.

0.70–0.78 — `RESERVED` stamp.

0.78–0.86 — central ₹500 cuts to ₹0.

0.86–0.94 — losing slip halts/recedes and receives simple unavailable treatment.

0.94–1.00 — winning slip extends into the first physical layer of Replay.

## Product truth

Do not describe this as one agent “being faster.”

The visual race dramatizes near-simultaneous requests; the actual product concept is atomic reservation of shared capacity.

## Avoid

- racetrack metaphor
- speed lines
- coin collision
- glowing central portal
- large 3D environment
