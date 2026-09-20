import { expect, test } from "@playwright/test";
import { BoundaryTransport, DEFAULT_TRANSPORT_PARAMS, SEEK_PATIENCE_MS, shouldWriteSeek, type TransportParams } from "../../src/lib/experience/transition-transport";

/**
 * Cinematic transition transport — pure controller tests (no browser, no GPU, no timers).
 * Deterministic scripted input profiles A–K drive the controller at every refresh rate.
 */

// Pure tests are viewport-independent: run them once (1440x900) instead of on every project.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "1440x900", "pure logic: run once");
});

const P = DEFAULT_TRANSPORT_PARAMS;
const MAX_ACCEL = Math.max(P.accel, P.decel, P.stopDecel ?? P.decel, P.reverseDecel ?? P.decel);
const HZ = [30, 60, 90, 120, 144, 165, 240] as const;
const EDGES = { overlapFrac: 64 / 1748 };

/** Deterministic PRNG so the "random" profile is identical on every run. */
const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Profile = { name: string; duration: number; target: (t: number) => number; hitchAt?: number; hitchDt?: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (from: number, rate: number, t0 = 0) => (t: number) => clamp01(from + rate * Math.max(0, t - t0));

const noisy = (() => {
  const rand = mulberry(7);
  const table: number[] = [];
  let x = 0;
  for (let i = 0; i <= 4000; i += 1) {
    x += (0.15 + rand() * 1.4) / 1000; // 0.15..1.55 progress/s, noisy
    table.push(clamp01(x));
  }
  return (t: number) => table[Math.min(table.length - 1, Math.max(0, Math.round(t * 1000)))];
})();

const PROFILES: Profile[] = [
  { name: "A tiny constant", duration: 3, target: ramp(0.1, 0.02) },
  { name: "B medium constant", duration: 1.6, target: ramp(0, 0.6) },
  { name: "C large constant", duration: 1.0, target: ramp(0, 4) },
  { name: "D random noisy", duration: 3.5, target: noisy },
  { name: "E single giant delta", duration: 1.5, target: (t) => (t < 0.1 ? 0 : 0.6) },
  { name: "F forward then reverse", duration: 2.4, target: (t) => (t < 0.8 ? 0.6 * t : 0.48 - 0.6 * (t - 0.8)) },
  { name: "G reverse then forward", duration: 2.4, target: (t) => clamp01(t < 0.8 ? 0.9 - 0.6 * t : 0.42 + 0.6 * (t - 0.8)) },
  { name: "H tiny sign noise", duration: 2, target: (t) => 0.1 + 0.3 * t + (Math.floor(t * 240) % 2 ? 0.0006 : -0.0006) },
  { name: "I stop", duration: 2, target: (t) => (t < 0.7 ? 0.5 * t : 0.35) },
  { name: "J 80ms hitch", duration: 2, target: ramp(0.1, 0.5), hitchAt: 0.6, hitchDt: 0.08 },
  { name: "K rapid oscillation", duration: 2, target: (t) => 0.5 + 0.03 * Math.sin(2 * Math.PI * 3 * t) },
];

type Trace = { t: number[]; target: number[]; p: number[]; v: number[]; a: number[]; dt: number[] };

/** Follower-only params: the deliberate jump-snap and handoff catch-up (which exist for UNgoverned input) are off. */
const FOLLOWER = { catchUpBoost: 1, gapJump: 10 } satisfies Partial<TransportParams>;
/** Keeps a profile strictly inside the boundary so no handoff gate / exit release is involved. */
const inner = (f: (t: number) => number) => (t: number) => 0.06 + 0.88 * clamp01(f(t));

type SimOptions = { params?: Partial<TransportParams>; initial?: number; governed?: boolean };

/**
 * governed = false: raw target -> follower (isolates the controller).
 * governed = true : the production closed loop. The profile is the user's INTENT; the page scroll
 *   accumulates the intent's increments and is clamped to limits() every frame (excess is discarded,
 *   exactly what the Lenis governor does), and only then fed to the transport.
 */
function simulate(profile: Profile, hz: number, opts: SimOptions = {}): Trace {
  const tr = new BoundaryTransport(opts.params ?? {}, EDGES, opts.initial ?? 0);
  const dt = 1 / hz;
  const out: Trace = { t: [], target: [], p: [], v: [], a: [], dt: [] };
  let t = 0;
  let hitched = false;
  let scroll = opts.initial ?? 0;
  let prevIntent = profile.target(0);
  while (t <= profile.duration + 1e-9) {
    let step = dt;
    if (profile.hitchAt !== undefined && !hitched && t >= profile.hitchAt) {
      step = profile.hitchDt ?? dt;
      hitched = true;
    }
    t += step;
    const intent = profile.target(t);
    if (opts.governed) {
      scroll = clamp01(scroll + (intent - prevIntent));
      prevIntent = intent;
      const { lo, hi } = tr.limits();
      scroll = Math.min(hi, Math.max(lo, scroll));
      tr.feed(scroll);
    } else {
      tr.feed(intent);
    }
    tr.step(step);
    out.t.push(t);
    out.target.push(tr.target);
    out.p.push(tr.presented);
    out.v.push(tr.velocity);
    out.a.push(tr.acceleration);
    out.dt.push(Math.min(step, P.maxDt));
  }
  return out;
}

const interiorProfiles = PROFILES.map((p) => ({ ...p, target: inner(p.target) }));
const F_PROFILE = interiorProfiles.find((p) => p.name.startsWith("F"))!;

test.describe("Follower bounds hold for every profile at every refresh rate (interior)", () => {
  for (const profile of interiorProfiles) {
    for (const hz of HZ) {
      test(`${profile.name} @ ${hz} Hz`, () => {
        const tr = simulate(profile, hz, { params: FOLLOWER });
        for (let i = 0; i < tr.p.length; i += 1) {
          expect(tr.p[i]).toBeGreaterThanOrEqual(0);
          expect(tr.p[i]).toBeLessThanOrEqual(1);
          expect(Math.abs(tr.v[i])).toBeLessThanOrEqual(P.vMax + 1e-9);
          expect(Math.abs(tr.a[i])).toBeLessThanOrEqual(MAX_ACCEL * (1 + 1e-6) + 1e-6);
          // per-step displacement can never exceed vMax * dt (no teleport)
          if (i > 0) expect(Math.abs(tr.p[i] - tr.p[i - 1])).toBeLessThanOrEqual(P.vMax * tr.dt[i] + 1e-9);
        }
      });
    }
  }
});

test.describe("Production closed loop (governed scroll, default params, whole boundary incl. handoffs)", () => {
  // Intents that traverse the WHOLE boundary (not the interior-scaled variants).
  for (const profile of PROFILES) {
    for (const hz of [30, 60, 120, 240]) {
      test(`${profile.name} @ ${hz} Hz: bounded velocity/accel/debt, film reaches every handoff at rest`, () => {
        const tr = simulate(profile, hz, { governed: true });
        for (let i = 0; i < tr.p.length; i += 1) {
          expect(tr.p[i]).toBeGreaterThanOrEqual(0);
          expect(tr.p[i]).toBeLessThanOrEqual(1);
          expect(Math.abs(tr.v[i])).toBeLessThanOrEqual(P.vMax + 1e-9); // the catch-up boost is never needed when governed
          expect(Math.abs(tr.target[i] - tr.p[i])).toBeLessThanOrEqual(P.gapMax + P.deadband + 1e-9);
          if (i > 0) {
            // no teleport, no velocity discontinuity (release at exactly 0/1 is excluded: the film is opacity 0 there)
            const inside = tr.target[i] > 0 && tr.target[i] < 1 && tr.target[i - 1] > 0 && tr.target[i - 1] < 1;
            if (inside) expect(Math.abs(tr.p[i] - tr.p[i - 1])).toBeLessThanOrEqual(P.vMax * tr.dt[i] + 1e-9);
            // (a frame that LANDS on its target ends the motion in one step: the deliberate no-overshoot rule)
            const landed = tr.p[i] === tr.target[i];
            if (inside && !landed) expect(Math.abs(tr.v[i] - tr.v[i - 1])).toBeLessThanOrEqual(MAX_ACCEL * tr.dt[i] * (1 + 1e-6) + 1e-9);
          }
        }
      });
    }
  }
});

test.describe("Static target: no overshoot, exact convergence, refresh-rate independence", () => {
  for (const hz of HZ) {
    test(`giant delta never overshoots and lands exactly @ ${hz} Hz`, () => {
      const tr = simulate({ name: "step", duration: 3, target: (t) => (t < 0.1 ? 0.06 : 0.6) }, hz, { params: FOLLOWER, initial: 0.06 });
      for (let i = 0; i < tr.p.length; i += 1) expect(tr.p[i]).toBeLessThanOrEqual(0.6 + 1e-12);
      expect(tr.p[tr.p.length - 1]).toBe(0.6);
      expect(tr.v[tr.v.length - 1]).toBe(0);
    });
  }

  test("final positions agree across refresh rates", () => {
    const finals = HZ.map((hz) => simulate({ name: "step", duration: 0.8, target: (t) => (t < 0.1 ? 0.06 : 0.6) }, hz, { params: FOLLOWER, initial: 0.06 }).p.at(-1)!);
    expect(Math.max(...finals) - Math.min(...finals)).toBeLessThan(0.01);
  });

  test("position at a fixed time is refresh-rate independent (trajectory, not frame count)", () => {
    const at = (hz: number) => {
      const tr = simulate({ name: "ramp", duration: 1.0, target: (t) => 0.06 + 0.6 * t }, hz, { params: FOLLOWER, initial: 0.06 });
      let best = 0;
      for (let i = 0; i < tr.t.length; i += 1) if (Math.abs(tr.t[i] - 0.5) < Math.abs(tr.t[best] - 0.5)) best = i;
      return tr.p[best];
    };
    const values = HZ.map(at);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.02);
  });
});

test.describe("Stop behaviour", () => {
  for (const hz of [60, 120, 240]) {
    test(`stop converges and becomes exactly still within 160 ms @ ${hz} Hz`, () => {
      const tr = simulate({ name: "stop", duration: 2, target: (t) => (t < 0.7 ? 0.06 + 0.5 * t : 0.41) }, hz, { params: FOLLOWER, initial: 0.06 });
      const stopAt = 0.7;
      const settledIdx = tr.t.findIndex((t, i) => t > stopAt && tr.p[i] === 0.41 && tr.v[i] === 0);
      expect(settledIdx).toBeGreaterThan(0);
      expect(tr.t[settledIdx] - stopAt).toBeLessThan(0.16);
      // and STAYS still (no autoplay continuation)
      for (let i = settledIdx; i < tr.p.length; i += 1) expect(tr.p[i]).toBe(0.41);
    });
  }

  test("a settled transport does no work and never moves", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.4);
    tr.feed(0.4);
    for (let i = 0; i < 100; i += 1) tr.step(1 / 60);
    expect(tr.presented).toBe(0.4);
    expect(tr.settled).toBe(true);
  });
});

test.describe("Reversal is physical", () => {
  for (const hz of [60, 144, 240]) {
    test(`forward->reverse decelerates, crosses zero, accelerates back @ ${hz} Hz`, () => {
      const tr = simulate(F_PROFILE, hz, { params: FOLLOWER });
      let crossings = 0;
      let lastSign = 0;
      for (let i = 0; i < tr.v.length; i += 1) {
        const sign = Math.sign(tr.v[i]);
        if (sign === 0) continue;
        if (lastSign !== 0 && sign !== lastSign) {
          crossings += 1;
          // no velocity sign SNAP: at the instant of crossing zero the speed is at most one step of decel
          expect(Math.abs(tr.v[i])).toBeLessThanOrEqual(MAX_ACCEL * tr.dt[i] * (1 + 1e-6) + 1e-9);
        }
        lastSign = sign;
      }
      expect(crossings).toBeGreaterThanOrEqual(1);
      expect(Math.min(...tr.v)).toBeLessThan(-0.2); // it does really travel backwards
    });
  }

  test("velocity step between consecutive frames is bounded by the accel limit", () => {
    const tr = simulate(F_PROFILE, 120, { params: FOLLOWER });
    for (let i = 1; i < tr.v.length; i += 1) expect(Math.abs(tr.v[i] - tr.v[i - 1])).toBeLessThanOrEqual(MAX_ACCEL * tr.dt[i] * (1 + 1e-6) + 1e-9);
  });
});

test.describe("Direction hysteresis (backlash)", () => {
  test("sub-deadband counter-movement (trackpad noise) never reverses direction", () => {
    const tr = simulate(interiorProfiles.find((p) => p.name.startsWith("H"))!, 240, { params: FOLLOWER });
    expect(Math.min(...tr.v)).toBeGreaterThanOrEqual(0);
    const backwards = tr.p.some((p, i) => i > 0 && p < tr.p[i - 1] - 1e-12);
    expect(backwards).toBe(false);
  });

  test("a deliberate reversal (well beyond the dead-zone) reverses promptly", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.5);
    tr.feed(0.5);
    let t = 0;
    // move forward briefly
    for (let i = 0; i < 30; i += 1) { t += 1 / 120; tr.feed(0.5 + 0.6 * t); tr.step(1 / 120); }
    const turn = 0.5 + 0.6 * t;
    let reversedAfter: number | null = null;
    for (let i = 0; i < 60; i += 1) {
      t += 1 / 120;
      tr.feed(turn - 0.6 * (i / 120));
      tr.step(1 / 120);
      if (tr.velocity < 0 && reversedAfter === null) reversedAfter = (i + 1) / 120;
    }
    expect(reversedAfter).not.toBeNull();
    expect(reversedAfter!).toBeLessThan(0.15);
  });

  test("exact endpoints are honoured despite the dead-zone", () => {
    const tr = new BoundaryTransport({}, EDGES, 0);
    tr.feed(1);
    expect(tr.target).toBe(1);
    tr.feed(0);
    expect(tr.target).toBe(0);
  });
});

test.describe("dt handling", () => {
  test("a 100 ms stall does not teleport the playhead", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.2);
    tr.feed(0.7);
    tr.step(1 / 60);
    const before = tr.presented;
    tr.step(0.1); // a stalled browser frame
    expect(tr.presented - before).toBeLessThanOrEqual(P.vMax * P.maxDt + 1e-9);
  });

  test("zero / negative dt is a no-op", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.2);
    tr.feed(0.5);
    tr.step(0);
    tr.step(-1);
    expect(tr.presented).toBe(0.2);
  });

  test("jitter in dt does not change the trajectory materially", () => {
    const rand = mulberry(3);
    const run = (jitter: boolean) => {
      const tr = new BoundaryTransport({}, EDGES, 0);
      let t = 0;
      while (t < 1) {
        const dt = jitter ? 0.004 + rand() * 0.02 : 1 / 120;
        t += dt;
        tr.feed(ramp(0, 0.6)(t));
        tr.step(dt);
      }
      return tr.presented;
    };
    expect(Math.abs(run(true) - run(false))).toBeLessThan(0.03);
  });
});

test.describe("Determinism", () => {
  for (const profile of PROFILES) {
    test(`${profile.name}: identical input -> bit-identical output`, () => {
      const a = simulate(profile, 144, { governed: true });
      const b = simulate(profile, 144, { governed: true });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  }
});

test.describe("Scroll debt and handoff gates (limits)", () => {
  const T = () => new BoundaryTransport({}, EDGES, 0.5);
  test("pending intent is bounded by gapMax on both sides", () => {
    const { lo, hi } = T().limits();
    expect(hi - 0.5).toBeLessThanOrEqual(P.gapMax + 1e-12);
    expect(0.5 - lo).toBeLessThanOrEqual(P.gapMax + 1e-12);
  });

  test("scroll cannot enter the release zone until the film is home; then it can", () => {
    const releaseLine = 1 - EDGES.overlapFrac;
    const early = new BoundaryTransport({}, EDGES, 0.9).limits();
    expect(early.hi).toBeLessThan(releaseLine);
    const home = new BoundaryTransport({}, EDGES, releaseLine - 0.002).limits();
    expect(home.hi).toBeGreaterThan(releaseLine);
  });

  test("symmetric gate at the entry line when reversing", () => {
    const entryLine = EDGES.overlapFrac;
    const early = new BoundaryTransport({}, EDGES, 0.1).limits();
    expect(early.lo).toBeGreaterThan(entryLine);
    const home = new BoundaryTransport({}, EDGES, entryLine + 0.002).limits();
    expect(home.lo).toBeLessThan(entryLine);
  });

  test("closed loop: a scroll that obeys limits() reaches the release zone only with a converged, at-rest film", () => {
    const tr = new BoundaryTransport({}, EDGES, 0);
    const releaseLine = 1 - EDGES.overlapFrac;
    let scroll = 0;
    let t = 0;
    let firstInRelease: { p: number; v: number } | null = null;
    while (t < 6) {
      t += 1 / 144;
      scroll = Math.min(1, scroll + 8 / 144); // a violent flick: 8 progress/s of raw intent
      const { lo, hi } = tr.limits();
      scroll = Math.min(hi, Math.max(lo, scroll));
      tr.feed(scroll);
      tr.step(1 / 144);
      if (scroll > releaseLine && !firstInRelease) firstInRelease = { p: tr.presented, v: tr.velocity };
      expect(scroll - tr.presented).toBeLessThanOrEqual(P.gapMax + 1e-9);
    }
    expect(firstInRelease).not.toBeNull();
    expect(firstInRelease!.p).toBeGreaterThan(releaseLine - 0.006);
    expect(Math.abs(firstInRelease!.v)).toBeLessThan(0.35); // decelerated before the handoff, not at full speed
    expect(scroll).toBe(1);
    expect(tr.presented).toBe(1);
  });

  test("a huge flick is consumed in bounded time, not seconds of backlog", () => {
    const tr = new BoundaryTransport({}, EDGES, 0);
    let scroll = 0;
    let t = 0;
    while (t < 5 && tr.presented < 1) {
      t += 1 / 120;
      scroll = Math.min(1, scroll + 50 / 120); // effectively an instant giant delta
      const { lo, hi } = tr.limits();
      scroll = Math.min(hi, Math.max(lo, scroll));
      tr.feed(scroll);
      tr.step(1 / 120);
    }
    expect(tr.presented).toBe(1);
    expect(t).toBeLessThan(1 / P.vMax * 1.6 + 0.6); // ~ film length at vMax plus ramp/handoff
  });
});

test.describe("Jumps and boundaries", () => {
  test("a gap larger than gapJump snaps (scrollbar drag / hash), at rest", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.05);
    tr.feed(0.7);
    expect(tr.presented).toBe(0.7);
    expect(tr.velocity).toBe(0);
    expect(tr.jumps).toBe(1);
  });

  test("leaving the boundary (target 0 or 1) releases immediately, at rest", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.95);
    tr.feed(1);
    expect(tr.presented).toBe(1);
    expect(tr.settled).toBe(true);
    tr.feed(0.9); // back in
    tr.step(1 / 120);
    expect(tr.presented).toBeLessThan(1);
  });

  test("progress always clamps to [0,1] for out-of-range input", () => {
    const tr = new BoundaryTransport({}, EDGES, 0.5);
    tr.feed(7);
    expect(tr.target).toBe(1);
    tr.feed(-3);
    expect(tr.target).toBe(0);
  });
});

test.describe("Seek coalescing", () => {
  const base = { desired: 3, lastRequested: 2.9, seeking: false, sinceRequestMs: 100, frameDuration: 1 / 120, settled: false };
  test("writes when the change is at least half a frame and nothing is in flight", () => {
    expect(shouldWriteSeek(base)).toBe(true);
  });
  test("skips sub-half-frame changes (no decoder churn without a new picture)", () => {
    expect(shouldWriteSeek({ ...base, desired: 2.9 + 0.002 })).toBe(false);
  });
  test("does not abort an in-flight seek with a newer one", () => {
    expect(shouldWriteSeek({ ...base, seeking: true, sinceRequestMs: 8 })).toBe(false);
  });
  test("supersedes a stuck seek", () => {
    expect(shouldWriteSeek({ ...base, seeking: true, sinceRequestMs: SEEK_PATIENCE_MS + 1 })).toBe(true);
  });
  test("a settled playhead always lands its exact final time", () => {
    expect(shouldWriteSeek({ ...base, desired: 2.9 + 0.002, settled: true })).toBe(true);
    expect(shouldWriteSeek({ ...base, desired: 2.9 + 0.002, settled: true, seeking: true })).toBe(false); // flushed on `seeked`
  });
  test("identical time is never rewritten", () => {
    expect(shouldWriteSeek({ ...base, desired: 2.9, settled: true })).toBe(false);
  });
  test("pacing is tick-aware: 60 Hz writes every frame, 240 Hz every 5th, 120 Hz every 2nd, 30 Hz every tick", () => {
    const cadence = (frameMs: number) => {
      let last = -1000;
      let writes = 0;
      const ticks = Math.round(2000 / frameMs);
      for (let k = 0; k < ticks; k += 1) {
        const now = k * frameMs;
        if (shouldWriteSeek({ ...base, seeking: false, sinceRequestMs: now - last, frameMs })) {
          last = now;
          writes += 1;
        }
      }
      return writes / 2; // writes per second
    };
    expect(cadence(1000 / 30)).toBeCloseTo(30, 0);
    expect(cadence(1000 / 60)).toBeCloseTo(60, 0);
    expect(cadence(1000 / 120)).toBeGreaterThanOrEqual(58);
    expect(cadence(1000 / 120)).toBeLessThanOrEqual(61);
    expect(cadence(1000 / 240)).toBeGreaterThanOrEqual(47);
    expect(cadence(1000 / 240)).toBeLessThanOrEqual(52);
    expect(cadence(1000 / 144)).toBeGreaterThanOrEqual(46);
    expect(cadence(1000 / 144)).toBeLessThanOrEqual(52);
  });
  test("a settled playhead ignores pacing (the final frame always lands promptly)", () => {
    expect(shouldWriteSeek({ ...base, desired: 3, lastRequested: 2.9, sinceRequestMs: 1, settled: true, frameMs: 4 })).toBe(true);
  });
  test("first request always writes", () => {
    expect(shouldWriteSeek({ ...base, lastRequested: null })).toBe(true);
  });
});
