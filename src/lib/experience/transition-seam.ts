/**
 * Central seam-calibration model for the cinematic transitions.
 *
 * The LIVE scenes are authoritative. Each film is presented through a small,
 * scroll-driven similarity transform (uniform scale + translate about the
 * viewport centre, optionally a clip inset) so that:
 *   - at progress 0 the film's first frame coincides with the outgoing live
 *     scene's terminal composition, then relaxes to the film's native geometry;
 *   - the film converges onto the incoming live scene's initial composition and
 *     HOLDS there (static, zero velocity) before the layer is released.
 * Only the endpoints are touched; the cinematic body runs at native geometry.
 *
 * Ownership timing: the layer overlaps the live scenes by TRANSITION_OVERLAP_PX at
 * each end. Inside that overlap the OTHER scene's DOM is still visible (outgoing at
 * the start) or already visible (incoming at the end). The film therefore
 *   - reaches full opacity, still at the start pose, before the outgoing DOM leaves;
 *   - completes its convergence before the incoming DOM appears, holds static, and is
 *     released only inside the overlap, once DOM and film already coincide.
 * `overlapFrac` = overlap px / total scroll range of the boundary.
 *
 * Everything here is pure (no DOM) so it can be unit-tested.
 *
 * Measured law: the live composition behaves like a fixed-CSS-size layout while
 * the film scales with the viewport, so the required scale is ~ K / viewportWidth.
 * Samples are therefore interpolated in 1/width, and extrapolated with that
 * hyperbola beyond the outermost measured width.
 */

export type SeamPose = {
  /** Uniform scale about the viewport centre. */
  scale: number;
  /** Translation in CSS px at the sample's own viewport. */
  x: number;
  y: number;
};

/** Percent of the video box hidden at each edge (film chrome that must yield). */
export type SeamInset = { top: number; right: number; bottom: number; left: number };

export type SeamSample = {
  width: number;
  height: number;
  start: SeamPose;
  end: SeamPose;
};

export type BoundarySeam = {
  /** Measured at ascending viewport widths. */
  samples: readonly SeamSample[];
  /** Progress window [from, to] over which the film relaxes from the start pose to native. */
  relax: readonly [number, number];
  /** Progress window [from, to] over which the film converges onto the end pose; it then holds. */
  converge: readonly [number, number];
  /** Film chrome (baked header/footer) that is clipped away as the film converges. */
  endInset?: SeamInset;
  /**
   * The live scenes' background colour. Film blacks (~3/255) sit well below the live stage
   * (~12/255); a backdrop of this colour under the film with `mix-blend-mode: lighten`
   * lifts film blacks to the live black so a shrunken film leaves no visible rectangle.
   */
  backdrop?: string;
};

export type Viewport = { width: number; height: number };
export type ResolvedPose = { scale: number; x: number; y: number; inset: SeamInset | null; /** 0 mid-transition, 1 at either seam end: how much the black-level backdrop is engaged. */ blend: number };

export const IDENTITY_POSE: SeamPose = { scale: 1, x: 0, y: 0 };

export function smootherstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pose at an arbitrary viewport, interpolated in 1/width between measured samples. */
export function poseAtViewport(samples: readonly SeamSample[], key: "start" | "end", viewport: Viewport): SeamPose {
  const sorted = samples;
  const w = viewport.width;
  const frac = (s: SeamSample) => ({ scale: s[key].scale, fx: s[key].x / s.width, fy: s[key].y / s.height });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const edge = (s: SeamSample) => {
    const f = frac(s);
    // Beyond the measured range keep the layout law: scale * width stays constant.
    return { scale: clampScale(f.scale * (s.width / w)), x: f.fx * viewport.width, y: f.fy * viewport.height };
  };
  if (w <= first.width) return edge(first);
  if (w >= last.width) return edge(last);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (w >= a.width && w <= b.width) {
      const ua = 1 / a.width;
      const ub = 1 / b.width;
      const t = (1 / w - ua) / (ub - ua);
      const fa = frac(a);
      const fb = frac(b);
      return {
        scale: lerp(fa.scale, fb.scale, t),
        x: lerp(fa.fx, fb.fx, t) * viewport.width,
        y: lerp(fa.fy, fb.fy, t) * viewport.height,
      };
    }
  }
  return edge(last);
}

const clampScale = (s: number) => Math.min(1.6, Math.max(0.5, s));

/**
 * The film's presentation pose at a given boundary progress.
 *   start pose weight = 1 - smootherstep over `relax`
 *   end   pose weight =     smootherstep over `converge`
 * Scale blends in log space, translation linearly; both weights have zero
 * slope at their ends, so scale and position velocity are 0 where the film
 * hands over to (or takes over from) the live DOM.
 */
export function seamPoseAt(seam: BoundarySeam, progress: number, viewport: Viewport, overlapFrac: number): ResolvedPose {
  const start = poseAtViewport(seam.samples, "start", viewport);
  const end = poseAtViewport(seam.samples, "end", viewport);
  // The start pose is held until the film is fully opaque; convergence ends before the release.
  const relaxFrom = Math.max(seam.relax[0], overlapFrac);
  const convergeTo = Math.min(seam.converge[1], 1 - overlapFrac);
  const ws = 1 - smootherstep((progress - relaxFrom) / Math.max(1e-6, seam.relax[1] - relaxFrom));
  const we = smootherstep((progress - seam.converge[0]) / Math.max(1e-6, convergeTo - seam.converge[0]));
  const logScale = Math.log(start.scale) * ws + Math.log(end.scale) * we;
  const inset = seam.endInset && we > 0
    ? { top: seam.endInset.top * we, right: seam.endInset.right * we, bottom: seam.endInset.bottom * we, left: seam.endInset.left * we }
    : null;
  return { scale: Math.exp(logScale), x: start.x * ws + end.x * we, y: start.y * ws + end.y * we, inset, blend: Math.max(ws, we) };
}

/**
 * Opacity envelope for a calibrated boundary.
 *  - fade in over the first `overlapFrac` of progress: the outgoing live scene is
 *    still underneath and the film's start pose already coincides with it, so the
 *    film is opaque by the time that DOM leaves;
 *  - stay FULLY opaque through convergence and the terminal hold;
 *  - release over the last `overlapFrac`: the incoming live scene is already
 *    visible underneath, so the layer swap happens after the geometry coincides.
 */
export function seamOpacity(progress: number, overlapFrac: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const f = Math.min(0.2, Math.max(1e-6, overlapFrac));
  const fadeIn = smootherstep(p / f);
  const fadeOut = 1 - smootherstep((p - (1 - f)) / f);
  return Math.min(fadeIn, fadeOut);
}

/** CSS clip-path for an inset, or "none". */
export function insetToClipPath(inset: SeamInset | null): string {
  if (!inset) return "none";
  const f = (n: number) => `${n.toFixed(3)}%`;
  return `inset(${f(inset.top)} ${f(inset.right)} ${f(inset.bottom)} ${f(inset.left)})`;
}

const IDENTITY_SAMPLES: readonly SeamSample[] = [
  { width: 1366, height: 768, start: IDENTITY_POSE, end: IDENTITY_POSE },
  { width: 1440, height: 900, start: IDENTITY_POSE, end: IDENTITY_POSE },
  { width: 1920, height: 1080, start: IDENTITY_POSE, end: IDENTITY_POSE },
];

/** Default windows: the film relaxes over the first 20% and converges over 80-95%. */
const seamDefaults = (): Pick<BoundarySeam, "relax" | "converge" | "backdrop"> => ({
  relax: [0, 0.2],
  converge: [0.8, 0.95],
  backdrop: "rgb(12, 12, 14)",
});

/**
 * Calibrated boundaries. Absent id = native film geometry (nothing added).
 * Measurements: STANDARD tier, closed-loop against the live scenes (see
 * output/seam). Poses are video -> live: live = centre + scale*(video-centre) + translate.
 */
export const TRANSITION_SEAMS: Record<string, BoundarySeam> = {
  "00-01": { samples: IDENTITY_SAMPLES, ...seamDefaults() },
  "01-02": { samples: IDENTITY_SAMPLES, ...seamDefaults() },
  "02-03": { samples: IDENTITY_SAMPLES, ...seamDefaults() },
  "03-04": { samples: IDENTITY_SAMPLES, ...seamDefaults() },
  "04-05": { samples: IDENTITY_SAMPLES, ...seamDefaults() },
  "05-06": { samples: IDENTITY_SAMPLES, ...seamDefaults() },
  "06-07": {
    samples: [
      { width: 1366, height: 768, start: { scale: 1.076, x: 0, y: 0 }, end: { scale: 1.14, x: 8, y: 48 } },
      { width: 1440, height: 900, start: { scale: 0.9929, x: 6.4, y: 0 }, end: { scale: 0.976, x: 8, y: -8 } },
      { width: 1920, height: 1080, start: { scale: 0.7807, x: 4.2, y: 4 }, end: { scale: 0.759, x: 0, y: 0 } },
    ],
    ...seamDefaults(),
    endInset: { top: 11, right: 0, bottom: 7, left: 0 },
  },
};
