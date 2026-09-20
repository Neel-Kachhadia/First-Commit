import { BoundaryTransport } from "./transition-transport";

/** Desktop wheel presentation, in CSS pixels. Replaces Lenis wheel inertia; never stacked on it. */
export const WHEEL_TRANSPORT_PARAMS = {
  vMax: 480,
  accel: 16000,
  decel: 12000,
  stopDecel: 24000,
  reverseDecel: 32000,
  gapMax: 36,
  gapMin: 20,
  follow: 80,
  directionHysteresis: 4,
  maxDt: 1 / 30,
};

export class WheelTransport {
  readonly params = { ...WHEEL_TRANSPORT_PARAMS };
  private extent = 1;
  private follower = new BoundaryTransport({}, { overlapFrac: 0 }, 0, false);
  private lastInput = -Infinity;
  private direction = 0;
  private opposite = 0;

  reset(y: number, limit = this.extent) {
    this.extent = Math.max(1, limit);
    const p = this.params;
    Object.assign(this.follower.params, {
      vMax: p.vMax / this.extent,
      accel: p.accel / this.extent,
      decel: p.decel / this.extent,
      stopDecel: p.stopDecel / this.extent,
      reverseDecel: p.reverseDecel / this.extent,
      follow: p.follow,
      gapMax: p.gapMax / this.extent,
      gapJump: 2,
      catchUpBoost: 1,
      deadband: 0,
      maxDt: p.maxDt,
      settlePos: 0.05 / this.extent,
      settleVel: 2 / this.extent,
    });
    this.follower.reset(y / this.extent);
    this.lastInput = -Infinity;
    this.direction = this.opposite = 0;
  }

  input(delta: number, y: number, limit: number, nowMs: number) {
    if (limit !== this.extent || Math.abs(y - this.presented) > 2) this.reset(y, limit);
    if (!delta) return;
    const sign = Math.sign(delta);
    const reversing = this.direction !== 0 && sign !== this.direction;
    if (reversing) {
      this.opposite += delta;
      if (Math.abs(this.opposite) < this.params.directionHysteresis) return;
      delta = this.opposite;
    }
    this.opposite = 0;
    this.direction = sign;
    // Frequent flick events need less debt than spaced mouse notches. Discard excess,
    // never queue seconds of catch-up. Tiny deltas retain their original distance.
    const gap = Math.min(this.params.gapMax, Math.max(this.params.gapMin, this.params.vMax * (nowMs - this.lastInput) / 1000));
    this.lastInput = nowMs;
    const base = reversing ? this.presented : this.follower.target * this.extent;
    const target = Math.max(this.presented - gap, Math.min(this.presented + gap, base + delta));
    this.follower.feed(target / this.extent);
  }

  step(dt: number) { return this.follower.step(dt) * this.extent; }
  get presented() { return this.follower.presented * this.extent; }
  get settled() { return this.follower.settled; }
  snapshot() {
    const s = this.follower.snapshot();
    return { target: s.target * this.extent, presented: this.presented, velocity: s.velocity * this.extent,
      acceleration: s.acceleration * this.extent, debt: s.debt * this.extent, settled: s.settled };
  }
}
