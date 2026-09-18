/**
 * Pure, DOM-free math for the cinematic transition controller. Kept separate
 * from the component so scroll -> video-time / opacity mapping is unit
 * testable without a browser.
 */

/** Linear scroll-progress (0..1) -> video.currentTime. Duration is read from
 * the video element at runtime — never assume a frame count or fps. */
export function progressToVideoTime(progress: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped * duration;
}

/**
 * Opacity envelope for the video layer across a boundary: ramps 0 -> 1 over
 * the first `edgeFraction`, holds at 1, ramps 1 -> 0 over the last
 * `edgeFraction`. Only the entrance/exit blend uses easing (smoothstep);
 * the interior is flat so video-time mapping stays purely linear.
 */
export function computeTransitionOpacity(progress: number, edgeFraction: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const edge = Math.min(0.49, Math.max(0, edgeFraction));
  if (edge === 0) return clamped > 0 && clamped < 1 ? 1 : clamped === 1 ? 1 : 0;

  if (clamped <= edge) {
    return smoothstep(clamped / edge);
  }
  if (clamped >= 1 - edge) {
    return smoothstep((1 - clamped) / edge);
  }
  return 1;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
