/** Canonical authored inspection windows shared by DOM and WebGL replay layers. */
export const CAUSAL_REPLAY_STAGE_WINDOWS = [
  [0.2, 0.29],
  [0.29, 0.37],
  [0.37, 0.48],
  [0.48, 0.6],
  [0.6, 0.68],
  [0.68, 0.77],
  [0.77, 0.87],
  [0.87, 0.96],
] as const satisfies ReadonlyArray<readonly [number, number]>;

export const CAUSAL_REPLAY_STAGE_COUNT = CAUSAL_REPLAY_STAGE_WINDOWS.length;

/**
 * Fraction of each stage window spent physically transporting film from one frame to the
 * next (the remainder is the mechanical hold with the evidence seated in the gate). Shared
 * by the WebGL transport (reel/roller/UV travel) and the DOM evidence fade so both slide
 * and fade across the exact same progress span -- neither can move while the other holds.
 */
export const CAUSAL_REPLAY_TRANSITION_FRACTION = 0.28;
