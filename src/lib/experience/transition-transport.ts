/**
 * Cinematic transition TRANSPORT — pure, DOM-free, deterministic.
 *
 * Separates three values that used to be one:
 *   A. raw scroll intent            (Lenis' canonical output; noisy, wheel-force dependent)
 *   B. targetProgress               (A mapped onto the boundary, updated IMMEDIATELY)
 *   C. presentedProgress            (what the film / seam actually shows)
 *
 *   wheel -> Lenis -> scrollY -> ScrollTrigger progress -> feed() -> [transport] -> presented -> media time
 *
 * `presented` follows `target` through a velocity- and acceleration-limited follower
 * (constant-deceleration braking profile that hands over to a critically-damped linear tail):
 *   v*  = sign(e) * min(vMax, |e| > e0 ? sqrt(2*D*(|e| - e0/2)) : k*|e|)     e = target - presented, e0 = D/k^2
 *   v'  = v + clamp(v* - v, -limit*dt, +limit*dt)          limit = accel (speeding up) | decel (slowing / reversing)
 *   p'  = p + (v + v')/2 * dt
 * so it can neither race (|v| <= vMax), nor jerk (|a| <= max(accel, decel)), nor overshoot
 * a static target (braking distance is honoured), and a reversal decelerates, crosses zero
 * and accelerates the other way instead of flipping sign in one frame.
 *
 * Nothing here calls the video element or reads the DOM; the driver (CinematicTransitionLayer)
 * owns those. All time is an explicit `dt` argument (clamped) so behaviour is identical at
 * 30 / 60 / 120 / 144 / 240 Hz and a stalled frame cannot teleport the playhead.
 */

export type TransportParams = {
  /** Maximum visual playhead speed, boundary-progress per second. 1 = the whole film in 1 s. */
  vMax: number;
  /** Maximum acceleration while speeding up in the current direction (progress/s^2). */
  accel: number;
  /** Maximum deceleration while slowing down during ordinary following (progress/s^2). */
  decel: number;
  /** Terminal deceleration once scroll input has stopped (progress/s^2). */
  stopDecel: number;
  /** Reversal deceleration when commanded intent opposes current velocity (progress/s^2). */
  reverseDecel: number;
  /** Linear follow gain of the tail (1/s): time constant = 1/follow. */
  follow: number;
  /** Maximum lead of the scroll target over the presented playhead ("scroll debt"), progress. */
  gapMax: number;
  /** vMax / accel / decel multiplier while a handoff MUST be caught up (non-governed input only). */
  catchUpBoost: number;
  /** A gap larger than this is a jump (scrollbar drag, hash, programmatic nav): presented snaps to target. */
  gapJump: number;
  /** Largest dt (s) a single step may integrate: one stalled frame can never teleport the playhead. */
  maxDt: number;
  /** Direction dead-zone (progress): a counter-movement smaller than this never reverses the direction. */
  deadband: number;
  /** |target - presented| below this (progress) with |v| < settleVel = at rest. */
  settlePos: number;
  settleVel: number;
};

/** Tuned in visible Chrome; see FINAL_SCROLL_LOCK_REPORT.md. */
export const DEFAULT_TRANSPORT_PARAMS: TransportParams = {
  vMax: 1.0,
  accel: 6,
  decel: 12,
  stopDecel: 15,
  reverseDecel: 18,
  follow: 32,
  gapMax: 0.04,
  catchUpBoost: 3,
  gapJump: 0.4,
  maxDt: 1 / 20,
  deadband: 0.0012,
  settlePos: 0.0003,
  settleVel: 0.01,
};

/** Geometry of the seam handoffs, as fractions of the boundary's scroll range. */
export type TransportEdges = {
  /** Overlap of the film layer with the adjacent scenes' own tracks, fraction of range. */
  overlapFrac: number;
};

/** Scroll may stop this close (progress) to the release/entry line while the film is not yet home. */
const GATE_INSET = 0.0015;
/** The gate opens once the playhead is within this of the line. */
const OPEN_EPS = 0.004;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export type TransportSnapshot = {
  target: number;
  presented: number;
  velocity: number;
  acceleration: number;
  direction: -1 | 0 | 1;
  /** target - presented: pending intent ("scroll debt"). */
  debt: number;
  settled: boolean;
};

export class BoundaryTransport {
  readonly params: TransportParams;
  private edges: TransportEdges;

  /** Backlash-filtered target (what the follower chases). */
  private eff = 0;
  private p = 0;
  private v = 0;
  private a = 0;
  private dir: -1 | 0 | 1 = 0;
  private rest = true;
  /** Direction the raw target last really moved (hysteresis latch); 0 = not yet moved. */
  private latched: -1 | 0 | 1 = 0;
  /** Target as of the previous step: tells a static target (land at rest) from a moving one. */
  private lastEff = 0;
  /** Number of jump-snaps (discontinuities) so far; diagnostics. */
  jumps = 0;

  constructor(params: Partial<TransportParams> = {}, edges: TransportEdges = { overlapFrac: 0.03 }, initial = 0) {
    this.params = { ...DEFAULT_TRANSPORT_PARAMS, ...params };
    this.edges = { ...edges };
    this.eff = this.p = this.lastEff = clamp01(initial);
  }

  configure(edges: Partial<TransportEdges>, deadband?: number) {
    this.edges = { ...this.edges, ...edges };
    if (deadband !== undefined) (this.params as TransportParams).deadband = deadband;
  }

  /** Hard set (entry/exit of a boundary, quality change, transport switched on): at rest, no velocity. */
  reset(progress: number) {
    this.eff = this.p = this.lastEff = clamp01(progress);
    this.v = 0;
    this.a = 0;
    this.dir = 0;
    this.rest = true;
    this.latched = 0;
  }

  // ---- geometry of the handoff gates -------------------------------------------------
  private get gateEnd() { return 1 - this.edges.overlapFrac - GATE_INSET; }
  private get endHold() { return 1 - this.edges.overlapFrac - OPEN_EPS; }
  private get gateStart() { return this.edges.overlapFrac + GATE_INSET; }
  private get startHold() { return this.edges.overlapFrac + OPEN_EPS; }

  /**
   * The range of raw progress the scroll is ALLOWED to reach right now.
   *  - never further than `gapMax` from the presented playhead (bounded pending intent);
   *  - never into the release zone (end) until the film is home, nor into the entry zone
   *    (start, when reversing) — the live DOM flips exactly there, and the film must already
   *    be converged and static when it does.
   * Used by the scroll governor; the follower itself never depends on it.
   */
  limits(): { lo: number; hi: number } {
    const { gapMax } = this.params;
    let hi = Math.min(1, this.p + gapMax);
    let lo = Math.max(0, this.p - gapMax);
    if (this.p < this.endHold) hi = Math.min(hi, Math.max(this.gateEnd, this.p));
    if (this.p > this.startHold) lo = Math.max(lo, Math.min(this.gateStart, this.p));
    return { lo, hi };
  }

  /** True while the raw target is inside a handoff zone the playhead has not reached yet (only possible without the governor). */
  get handoffPending(): boolean {
    return (this.eff > this.gateEnd + 1e-9 && this.p < this.endHold) || (this.eff < this.gateStart - 1e-9 && this.p > this.startHold);
  }

  /**
   * New raw target (boundary progress from the canonical scroll). Applied IMMEDIATELY and
   * followed EXACTLY (no lag, no permanent offset); the only filter is direction hysteresis:
   * a counter-movement smaller than `deadband` behind the latched direction is held (trackpad
   * sign noise), a real reversal (beyond the dead-zone) is followed at once.
   */
  feed(raw: number) {
    const r = clamp01(raw);
    const h = this.params.deadband;
    if (r <= 0 || r >= 1) {
      this.eff = r; // exact endpoints, always
    } else if (this.latched >= 0) {
      if (r >= this.eff) {
        if (r > this.eff) this.latched = 1;
        this.eff = r;
      } else if (this.eff - r > h) {
        this.latched = -1;
        this.eff = r;
      }
    } else if (r <= this.eff) {
      this.eff = r;
    } else if (r - this.eff > h) {
      this.latched = 1;
      this.eff = r;
    }
    if (Math.abs(this.eff - this.p) > this.params.gapJump) {
      this.p = this.eff; // discontinuity: film is not visible or the user jumped; never animate across it
      this.v = 0;
      this.a = 0;
      this.dir = 0;
      this.jumps += 1;
    }
    // Fully outside the boundary the film is released (opacity 0): nothing to animate.
    if ((this.eff <= 0 || this.eff >= 1) && this.p !== this.eff) {
      this.p = this.eff;
      this.v = 0;
      this.a = 0;
      this.rest = true;
    }
    if (this.eff !== this.p) this.rest = false;
  }

  /** Advances the playhead by dt seconds (clamped). Returns the presented progress. */
  step(dtSeconds: number): number {
    const P = this.params;
    const dt = Math.min(P.maxDt, Math.max(0, dtSeconds));
    if (dt === 0) return this.p;
    if (this.rest) {
      this.a = 0;
      return this.p;
    }
    const boost = this.handoffPending ? P.catchUpBoost : 1;
    const vMax = P.vMax * boost;
    const accel = P.accel * boost;
    const isTargetStatic = this.eff === this.lastEff;
    const isReversing = this.v !== 0 && Math.sign(this.eff - this.p) !== Math.sign(this.v);
    const effectiveDecel = (isReversing ? (P.reverseDecel ?? P.decel) : (isTargetStatic ? (P.stopDecel ?? P.decel) : P.decel)) * boost;

    const e = this.eff - this.p;
    // Braking profile evaluated at the MIDPOINT of this step's motion (semi-implicit integration lags half a step,
    // which is what overshoots a plain sqrt profile at low refresh rates).
    const approach = Math.sign(e) === Math.sign(this.v) ? 0.5 * Math.abs(this.v) * dt : 0;
    const ae = Math.max(0, Math.abs(e) - approach);
    // "sqrt controller": constant-deceleration braking (85 % of the limit, as margin) that hands over to a linear
    // tail at e0 = D/k^2, where value AND slope match, so the tail never asks for more than D of deceleration.
    const D = effectiveDecel * 0.85;
    const e0 = D / (P.follow * P.follow);
    const vBrake = ae > e0 ? Math.sqrt(2 * D * (ae - e0 / 2)) : P.follow * ae;
    const vStar = Math.sign(e) * Math.min(vMax, vBrake);

    const speedingUp = this.v === 0 || (Math.sign(vStar) === Math.sign(this.v) && Math.abs(vStar) > Math.abs(this.v));
    const limit = (speedingUp ? accel : effectiveDecel) * dt;
    const dv = Math.max(-limit, Math.min(limit, vStar - this.v));
    const vNew = this.v + dv;
    let pNew = this.p + 0.5 * (this.v + vNew) * dt;
    let vOut = vNew;

    // Never cross the target while moving toward it (coarse-dt insurance): land ON it. Against a STATIC target
    // it lands at rest; against a moving target (a scroll that is still going) the velocity is kept, so no discontinuity.
    if (e !== 0 && Math.sign(this.eff - pNew) !== Math.sign(e) && Math.sign(this.v) === Math.sign(e)) {
      pNew = this.eff;
      if (this.eff === this.lastEff) vOut = 0;
    }
    this.lastEff = this.eff;
    pNew = clamp01(pNew);

    this.a = (vOut - this.v) / dt;
    this.v = vOut;
    this.p = pNew;
    if (this.v !== 0) this.dir = this.v > 0 ? 1 : -1;

    if (Math.abs(this.eff - this.p) < P.settlePos && Math.abs(this.v) < P.settleVel) {
      this.p = this.eff;
      this.v = 0;
      this.a = 0;
      this.rest = true;
    }
    return this.p;
  }

  get target() { return this.eff; }
  get presented() { return this.p; }
  get velocity() { return this.v; }
  get acceleration() { return this.a; }
  get direction() { return this.dir; }
  get debt() { return this.eff - this.p; }
  get settled() { return this.rest; }

  snapshot(): TransportSnapshot {
    return { target: this.eff, presented: this.p, velocity: this.v, acceleration: this.a, direction: this.dir, debt: this.eff - this.p, settled: this.rest };
  }
}

// -------------------------------------------------------------------------------------
// Seek coalescing (pure): decides whether writing video.currentTime NOW is useful.
// -------------------------------------------------------------------------------------

export type SeekDecisionInput = {
  /** Time we want the video at (presented progress x ACTUAL duration). */
  desired: number;
  /** Time we last asked the element for (never read back from a possibly mid-seek element). */
  lastRequested: number | null;
  /** True while the element reports an in-flight seek. */
  seeking: boolean;
  /** ms since that last request was issued. */
  sinceRequestMs: number;
  /** Duration of one encoded frame (s), from the tier spec; only used to skip sub-frame writes. */
  frameDuration: number;
  /** Progress is settled (final write must land even mid-seek). */
  settled: boolean;
  /** Running average of the display's frame interval (ms): pacing lands on the tick nearest the target spacing. */
  frameMs?: number;
};

/** A seek older than this that has still not completed is considered stuck: supersede it. */
export const SEEK_PATIENCE_MS = 45;

/**
 * Seek pacing: target spacing (ms) between two currentTime writes on one element. Back-to-back
 * seeks make Chrome's decoder flush/preroll every time (measured in visible Chrome: p95 seek
 * service 15-27 ms, up to half the writes never presented); ~20 ms spacing gives a flat ~3.6 ms
 * write->present and ~50 distinct frames/s. Tick-aware (see `frameMs`): 60 Hz still writes every
 * frame, 240 Hz every 5th. Exposed as a mutable object for the dev hook only.
 */
export const SEEK_TUNING = { minIntervalMs: 20 };

/**
 * - sub-half-frame changes never produce a new picture: no write (no decoder churn);
 * - an in-flight seek is never aborted by a newer one unless it is stuck (a flood of
 *   seek A, B, C, D... each cancelling the last starves the decoder: only the LATEST desired time matters);
 * - the FINAL time of a settled playhead always lands.
 */
export function shouldWriteSeek(i: SeekDecisionInput): boolean {
  if (i.lastRequested !== null) {
    const change = Math.abs(i.desired - i.lastRequested);
    if (change === 0) return false;
    // A settled playhead still lands its exact final time (never leaves the last sub-frame unwritten).
    if (change < i.frameDuration * 0.5) return i.settled && !i.seeking;
  }
  if (i.seeking && i.sinceRequestMs < SEEK_PATIENCE_MS) return false;
  if (!i.settled && i.sinceRequestMs + (i.frameMs ?? 0) * 0.5 < SEEK_TUNING.minIntervalMs) return false;
  return true;
}
