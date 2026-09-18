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
