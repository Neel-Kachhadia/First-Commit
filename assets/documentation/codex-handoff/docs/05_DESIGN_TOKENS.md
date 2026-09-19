# 05 — Design Tokens

These are implementation starting points. Sample/refine against the final reference image before locking production values.

## Color variables

```css
:root {
  --kp-black: #090a08;
  --kp-black-2: #11110e;
  --kp-ivory: #e9dfc7;
  --kp-paper: #d8ccb1;
  --kp-paper-light: #f0e7d3;
  --kp-ink: #14130f;
  --kp-red: #b52520;
  --kp-red-dark: #861b18;
  --kp-green: #4e7c69;
  --kp-yellow: #d0b54e;
  --kp-muted: #a89e89;
  --kp-rule: rgba(235, 224, 199, 0.58);
}
```

Do not blindly keep these hex values. Compare them visually with `source/KavachPay_Final_Visual_Reference.png`.

## Typography proposal

Use legal/openly available fonts or fonts already licensed in the project. Do not bundle unlicensed font files.

Suggested roles:

```css
--font-brand: "Instrument Serif", "Times New Roman", serif;
--font-condensed: "Barlow Condensed", "Arial Narrow", sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
--font-body: "IBM Plex Sans", system-ui, sans-serif;
```

If the project already has better licensed typography, preserve the roles and swap the families.

## Type scale — desktop starting point

```css
--fs-brand: clamp(4rem, 9vw, 9rem);
--fs-scene: clamp(2rem, 4.3vw, 4.75rem);
--fs-money-hero: clamp(5.5rem, 12vw, 12rem);
--fs-money-card: clamp(2.6rem, 5vw, 5.5rem);
--fs-label: clamp(.9rem, 1.3vw, 1.25rem);
--fs-meta: clamp(.67rem, .8vw, .9rem);
```

## Letter spacing

- Brand serif: tight to neutral
- Condensed scene headings: `0.02em` to `0.06em`
- Small caps/meta: `0.12em` to `0.22em`
- Stamp text: tight, forceful, imperfect via texture rather than random letter rotation

## Borders

The visual system likes thin warm rules:

```css
--rule-1: 1px solid rgba(235,224,199,.56);
--rule-dark: 1px solid rgba(20,19,15,.55);
```

Avoid modern card borders with blur/shadow.

## Shadows

Paper may have shallow physical separation:

```css
box-shadow: 0 8px 24px rgba(0,0,0,.28);
```

Keep shadow subtle. Paper should not float like a glass card.

## Radii

Default radius = 0.

Allow only tiny physical rounding where the reference explicitly suggests printed cards. No pill-shaped container language except if a period artifact specifically requires it.

## Motion tokens

```ts
export const duration = {
  micro: 0.18,
  short: 0.35,
  medium: 0.7,
  long: 1.2,
  dramatic: 1.8,
};

export const ease = {
  cut: "none",
  print: "power3.out",
  settle: "power2.inOut",
  snap: "expo.out",
};
```

The page should also use hard cuts. Not every transition needs easing.
