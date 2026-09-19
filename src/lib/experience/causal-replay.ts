/**
 * Causal Replay — the ONE schedule shared by the DOM evidence layer and the WebGL film transport.
 *
 * Scene 08 progress p in [0, 1] (scroll) is the only clock. Everything that moves derives from the
 * functions below, so the physical film and the evidence card can never disagree:
 *   - exposure i is "on the gate" for the hold part of authored window i (film stationary, reels still);
 *   - the film advances one frame to the next exposure during the advance part of that window,
 *     and the evidence card hands over at the mid-point of that same advance.
 */

/** Canonical authored inspection windows: exposure i owns window i (RESULT -> ORIGIN rewind). */
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

/** Fraction of each window during which the film is stationary in the gate; the rest is the advance. */
export const REPLAY_HOLD_FRACTION = 0.66;

/** Progress range over which the first exposure seats into the aperture (after the apparatus is up). */
export const FIRST_EXPOSURE_SEAT = [0.165, 0.2] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Continuous film frame index (0 .. STAGE_COUNT-1). Integer values are holds: a physical frame sits in
 * the gate and nothing in the transport moves. Between integers the film is advancing (cubic-out seat).
 */
export function replayFrame(p: number): number {
  const windows = CAUSAL_REPLAY_STAGE_WINDOWS;
  if (p <= windows[0][0]) return 0;
  const last = windows[windows.length - 1];
  if (p >= last[1]) return CAUSAL_REPLAY_STAGE_COUNT - 1;
  for (let i = 0; i < windows.length; i += 1) {
    const [start, end] = windows[i];
    const holdEnd = start + (end - start) * REPLAY_HOLD_FRACTION;
    if (p <= holdEnd) return i;
    if (p <= end) {
      const t = (p - holdEnd) / (end - holdEnd);
      const eased = 1 - Math.pow(1 - t, 2.0);
      return lerp(i, Math.min(i + 1, CAUSAL_REPLAY_STAGE_COUNT - 1), eased);
    }
  }
  return CAUSAL_REPLAY_STAGE_COUNT - 1;
}

/** 0 -> 1 as the replay apparatus (reels, rollers, film, gate) establishes itself after the scene starts. */
export function replayReveal(p: number): number {
  return smoothstep((p - 0.03) / 0.12);
}

/**
 * Visibility weight of evidence exposure i for a given film frame index f. Sequential, never ghosted:
 * exposure i clears during the first half of the advance out of frame i, exposure i+1 seats during the
 * second half, so the card changes exactly when the film is half-way between two frames.
 * Returns the weight and the signed phase (-1 entering .. 0 seated .. +1 leaving) for positioning.
 */
export function exposureState(i: number, f: number): { weight: number; phase: number } {
  const e = f - i;
  if (e <= -1 || e >= 1) return { weight: 0, phase: e <= -1 ? -1 : 1 };
  if (e < 0) return { weight: clamp01(2 * e + 1), phase: e };
  return { weight: clamp01(1 - 2 * e), phase: e };
}

/** Seat weight for the very first exposure (the aperture must be established before any evidence). */
export function firstExposureSeat(p: number): number {
  return smoothstep((p - FIRST_EXPOSURE_SEAT[0]) / (FIRST_EXPOSURE_SEAT[1] - FIRST_EXPOSURE_SEAT[0]));
}

// ---- Film transport (pure, shared by the WebGL layer and its tests) -------------------------

/** Texture phases (per repeat) of the two evidence frames printed on the stock. */
export const FRAME_LOW = 310 / 1024;
export const FRAME_HIGH = 714 / 1024;
/** Consecutive frames alternate between these two pitches (texture repeats). */
export const FRAME_STEP_REPEATS = [FRAME_HIGH - FRAME_LOW, 1 - (FRAME_HIGH - FRAME_LOW)] as const;
/** Texture repeats per world unit of film travel (approved stock registration). */
export const REPLAY_UV_PER_WORLD_UNIT = 5.2 / 7.55;

/**
 * Cumulative film travel, in texture repeats, for a continuous frame index f. Each whole step lands the
 * next physical frame on the gate centre; it is constant across every hold.
 */
export function filmShiftRepeats(f: number): number {
  const whole = Math.min(Math.floor(f), CAUSAL_REPLAY_STAGE_COUNT - 1);
  let shift = 0;
  for (let k = 0; k < whole; k += 1) shift += FRAME_STEP_REPEATS[k % 2];
  const frac = Math.min(1, Math.max(0, f - whole));
  if (whole < CAUSAL_REPLAY_STAGE_COUNT - 1) shift += FRAME_STEP_REPEATS[whole % 2] * frac;
  return shift;
}

/** Film travel in world units at scene progress p (what the reels and rollers turn by). */
export function transportDistanceAt(p: number): number {
  return filmShiftRepeats(replayFrame(p)) / REPLAY_UV_PER_WORLD_UNIT;
}
