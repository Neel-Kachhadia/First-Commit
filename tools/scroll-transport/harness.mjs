// Real-Chrome (headed) scroll-transport measurement harness.
//
// Drives REAL wheel input (CDP Input.dispatchMouseEvent mouseWheel via page.mouse.wheel)
// through the whole pipeline and samples, every rAF, everything an external observer
// can see: scrollY, the boundary ScrollTrigger progress, video.currentTime, the frame
// the compositor actually presented (requestVideoFrameCallback mediaTime), the seek
// state and the number of currentTime writes. It works on any build of the page, so
// BEFORE and AFTER are measured by exactly the same code.
//
//   node tools/scroll-transport/harness.mjs <label> [profiles,comma] [boundaries,comma] [viewport WxH]
//
// Output: output/scroll-transport/<label>/<viewport>/<profile>@<boundary>.json + summary.json
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const QUERY = process.env.QUERY ?? "?intro=0";
const [label = "run", profileArg = "all", boundaryArg = "1", vpArg = "1440x900"] = process.argv.slice(2);
const [VW, VH] = vpArg.split("x").map(Number);
const OUT = path.join("output", "scroll-transport", label, vpArg);
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ input profiles
/** Deterministic PRNG (mulberry32) so "random" profiles are reproducible. */
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const repeat = (n, dy, gap) => Array.from({ length: n }, () => ({ dy, gap }));

/** Each profile: where in the boundary (0..1 of its scroll range) to start, and a list of {dy, gap ms before next event}. */
export const PROFILES = {
  // A. tiny constant deltas (trackpad-like micro deltas)
  A_tiny: { start: 0.12, events: repeat(170, 3, 16) },
  // B. medium constant deltas (typical notched mouse wheel, ~1000 px/s)
  B_medium: { start: 0.0, events: repeat(17, 100, 100) },
  // C. large constant deltas (aggressive flick)
  C_large: { start: 0.0, events: repeat(14, 300, 40) },
  // D. random noisy deltas
  D_noisy: (() => { const r = rng(7); return { start: 0.0, events: Array.from({ length: 30 }, () => ({ dy: 20 + r() * 160, gap: 20 + r() * 100 })) }; })(),
  // E. single giant delta
  E_giant: { start: 0.0, events: [{ dy: 6000, gap: 0 }] },
  // F. forward -> reverse
  F_fwd_rev: { start: 0.2, events: [...repeat(7, 100, 90), ...repeat(9, -100, 90)] },
  // G. reverse -> forward
  G_rev_fwd: { start: 0.8, events: [...repeat(7, -100, 90), ...repeat(9, 100, 90)] },
  // H. tiny sign noise on a slow forward scroll
  H_signnoise: { start: 0.2, events: Array.from({ length: 120 }, (_, i) => ({ dy: i % 3 === 2 ? -3 : 24, gap: 16 })) },
  // I. stop mid-transition (forward 500 px then nothing); measured stop->still latency
  I_stop25: { start: 0.0, events: repeat(5, 100, 60), stopAtProgress: 0.25 },
  I_stop50: { start: 0.0, events: repeat(9, 100, 60), stopAtProgress: 0.5 },
  I_stop75: { start: 0.0, events: repeat(13, 100, 60), stopAtProgress: 0.75 },
  // J. 80 ms main-thread hitch during a medium scroll
  J_hitch: { start: 0.0, events: repeat(17, 100, 100), hitchAfterEvent: 6, hitchMs: 80 },
  // K. rapid oscillation around the start / midpoint / end of the transition
  K_osc_start: { start: 0.02, events: Array.from({ length: 24 }, (_, i) => ({ dy: i % 2 ? -60 : 60, gap: 80 })) },
  K_osc_mid: { start: 0.5, events: Array.from({ length: 24 }, (_, i) => ({ dy: i % 2 ? -60 : 60, gap: 80 })) },
  K_osc_end: { start: 0.98, events: Array.from({ length: 24 }, (_, i) => ({ dy: i % 2 ? -60 : 60, gap: 80 })) },
  // full transition: fast + reverse (start a little before the boundary)
  L_full_fast: { start: -0.15, events: repeat(20, 200, 50) },
  M_full_reverse: { start: 1.1, events: repeat(20, -200, 50) },
  // slow -> fast -> slow
  N_slow_fast_slow: { start: 0.0, events: [...repeat(30, 10, 16), ...repeat(6, 250, 40), ...repeat(30, 10, 16)] },
};

// ------------------------------------------------------------------ in-page recorder
const RECORDER = `
(() => {
  if (window.__rec) return;
  const rec = (window.__rec = { on: false, frames: [], writes: [], seeked: [], presentedLog: [], presented: {}, t0: 0, long: [] });
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (rec.on) rec.long.push({ t: e.startTime, d: e.duration }); })).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  document.addEventListener('seeked', (e) => { if (rec.on) rec.seeked.push({ t: performance.now(), id: e.target.dataset && e.target.dataset.transitionVideo }); }, true);
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { if (rec.on) rec.writes.push({ t: performance.now(), id: this.dataset && this.dataset.transitionVideo, v }); desc.set.call(this, v); },
  });
  const arm = (el) => {
    if (el.__armed || typeof el.requestVideoFrameCallback !== "function") return;
    el.__armed = true;
    const id = el.dataset.transitionVideo;
    const cb = (now, md) => {
      rec.presented[id] = { mediaTime: md.mediaTime, at: now, presentedFrames: md.presentedFrames, expected: md.expectedDisplayTime };
      if (rec.on) { rec.pframes = (rec.pframes || 0) + 1; rec.presentedLog.push({ t: now, id, mt: md.mediaTime }); }
      el.requestVideoFrameCallback(cb);
    };
    el.requestVideoFrameCallback(cb);
  };
  const loop = (ts) => {
    document.querySelectorAll("[data-transition-video]").forEach(arm);
    if (rec.on) {
      const st = window.ScrollTrigger ? window.ScrollTrigger.getAll().filter((t) => t.trigger && t.trigger.dataset && t.trigger.dataset.transitionTrack) : [];
      const act = st.find((t) => t.progress > 0 && t.progress < 1) || null;
      let f = { t: ts, y: window.scrollY };
      if (act) {
        const id = act.trigger.dataset.transitionTrack;
        const v = document.querySelector("[data-transition-video='" + id + "']");
        const p = rec.presented[id];
        f = { ...f, id, tp: act.progress, ct: v.currentTime, dur: v.duration, seeking: v.seeking, pm: p ? p.mediaTime : null, pat: p ? p.at : null, op: parseFloat(v.style.opacity || "0") };
      }
      rec.frames.push(f);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
`;

// ------------------------------------------------------------------ helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sleepUntil(t) {
  for (;;) {
    const d = t - performance.now();
    if (d <= 2) break;
    await sleep(Math.max(1, d - 3));
  }
  while (performance.now() < t) { /* spin the last ms */ }
}

async function boundaryRange(page, index) {
  return page.evaluate((i) => {
    const el = document.querySelectorAll("[data-transition-track]")[i];
    const st = window.ScrollTrigger.getAll().find((t) => t.trigger === el);
    return { id: el.dataset.transitionTrack, start: st.start, end: st.end };
  }, index);
}

async function jumpScroll(page, y) {
  await page.evaluate((y) => { window.scrollTo(0, y); }, y);
  await sleep(700); // let Lenis (native path), ScrollTrigger, staging and seeks settle
}

/** Block until the boundary's video is fully buffered so measurements never include network/first-load stalls. */
async function waitBuffered(page, id) {
  await page.waitForFunction((id) => {
    const v = document.querySelector("[data-transition-video='" + id + "']");
    if (!v || !v.duration) return false;
    const b = v.buffered;
    return b.length > 0 && b.end(b.length - 1) >= v.duration - 0.15;
  }, id, { timeout: 60_000 }).catch(() => console.log("  (buffer wait timed out for", id, ")"));
}

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, colorScheme: "dark", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(RECORDER);
  await page.goto(`${BASE}/${QUERY}`, { waitUntil: "load", timeout: 120_000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForFunction(() => window.ScrollTrigger && document.querySelectorAll("[data-transition-track]").length === 7, null, { timeout: 60_000 });
  await sleep(1500);
  if (process.env.PARAMS) await page.evaluate((p) => window.__kpMotion.setParams(JSON.parse(p)), process.env.PARAMS);
  if (process.env.SEEK_INTERVAL) await page.evaluate((v) => window.__kpMotion.setSeekInterval(Number(v)), process.env.SEEK_INTERVAL);
  await page.mouse.move(VW / 2, VH / 2);
  return { ctx, page };
}

async function runProfile(page, name, profile, boundaryIndex) {
  const rng0 = await boundaryRange(page, boundaryIndex);
  const range = rng0.end - rng0.start;
  const y0 = rng0.start + range * profile.start;
  await jumpScroll(page, y0);
  await waitBuffered(page, rng0.id);
  // Make sure this boundary's video is staged + metadata is known before measuring.
  await page.evaluate(() => { window.__rec.frames = []; window.__rec.writes = []; window.__rec.pframes = 0; });
  await sleep(300);
  await page.evaluate(() => { const r = window.__rec; r.on = true; r.t0 = performance.now(); if (window.__kpMotion) window.__kpMotion.record(true); });
  const t0 = performance.now();
  let at = t0 + 120; // leading quiet frames
  await sleepUntil(at);
  const wheelLog = [];
  let cumulative = 0;
  for (let i = 0; i < profile.events.length; i += 1) {
    const e = profile.events[i];
    await page.mouse.wheel(0, e.dy);
    cumulative += e.dy;
    wheelLog.push({ t: performance.now() - t0, dy: e.dy });
    if (profile.hitchAfterEvent === i) await page.evaluate((ms) => { const s = performance.now(); while (performance.now() - s < ms); }, profile.hitchMs);
    at += e.gap;
    await sleepUntil(at);
  }
  const lastWheelAt = performance.now() - t0;
  await sleep(900); // settle window
  const rec = await page.evaluate(() => { const r = window.__rec; r.on = false; let internal = null; if (window.__kpMotion) { internal = window.__kpMotion.frames().slice(); window.__kpMotion.record(false); } return { frames: r.frames, writes: r.writes, long: r.long, seeked: r.seeked, presentedLog: r.presentedLog, pframes: r.pframes, t0: r.t0, internal }; });
  return { name, boundary: rng0.id, range, y0, cumulative, lastWheelAt, wheelLog, rec, wall0: t0 };
}

// ------------------------------------------------------------------ analysis
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const variance = (a) => { if (a.length < 2) return null; const m = mean(a); return mean(a.map((x) => (x - m) ** 2)); };
const round = (x, n = 4) => (x === null || x === undefined ? null : Math.round(x * 10 ** n) / 10 ** n);

export function analyze(run) {
  const { frames, writes, pframes, t0 } = run.rec;
  run.rec.seeked = run.rec.seeked || [];
  run.rec.presentedLog = run.rec.presentedLog || [];
  const fr = frames.filter((f) => f.id === run.boundary && f.dur > 0);
  // "Visual progress" = the frame the compositor actually presented (fallback: currentTime).
  const vp = fr.map((f) => (f.pm !== null && f.pm !== undefined ? f.pm : f.ct) / f.dur);
  const ctp = fr.map((f) => f.ct / f.dur);
  const dts = [];
  for (let i = 1; i < frames.length; i += 1) dts.push(frames[i].t - frames[i - 1].t);
  // per-frame deltas in visual progress (use rAF frame pairs only)
  const dvp = []; const vel = []; const tfr = [];
  for (let i = 1; i < fr.length; i += 1) {
    const dt = (fr[i].t - fr[i - 1].t) / 1000;
    if (dt <= 0 || dt > 0.2) continue;
    const d = vp[i] - vp[i - 1];
    dvp.push(d); vel.push(d / dt); tfr.push(fr[i].t);
  }
  const absd = dvp.map(Math.abs);
  const moving = absd.filter((d) => d > 1e-6);
  // target-side (scroll) progress velocity for comparison
  const tvel = [];
  for (let i = 1; i < fr.length; i += 1) {
    const dt = (fr[i].t - fr[i - 1].t) / 1000; if (dt <= 0 || dt > 0.2) continue;
    tvel.push((fr[i].tp - fr[i - 1].tp) / dt);
  }
  // Requested-time ("what we ask the decoder for") velocity: isolates the controller from decoder/compositor delivery noise.
  const cvel = [];
  for (let i = 1; i < fr.length; i += 1) {
    const dt = (fr[i].t - fr[i - 1].t) / 1000; if (dt <= 0 || dt > 0.2) continue;
    cvel.push((ctp[i] - ctp[i - 1]) / dt);
  }
  const cacc = []; for (let i = 1; i < cvel.length; i += 1) cacc.push(Math.abs(cvel[i] - cvel[i - 1]));
  const cdp = []; for (let i = 1; i < fr.length; i += 1) cdp.push(Math.abs(ctp[i] - ctp[i - 1]));
  const cmoving = cdp.filter((d) => d > 1e-6);
  // Uniform 60 Hz resample (the eye's frame): requested = linear interpolation, shown = sample-and-hold of the presented frame.
  const grid = (series, mode) => {
    const out = []; if (fr.length < 2) return out;
    const t0g = fr[0].t, t1g = fr[fr.length - 1].t; let k = 0;
    for (let tt = t0g; tt <= t1g; tt += 1000 / 60) {
      while (k < fr.length - 2 && fr[k + 1].t < tt) k += 1;
      const a = fr[k], b = fr[k + 1]; const u = mode === "lin" ? Math.min(1, Math.max(0, (tt - a.t) / Math.max(1e-6, b.t - a.t))) : 0;
      out.push(series[k] + (series[k + 1] - series[k]) * u);
    }
    return out;
  };
  const gstat = (g) => {
    const d = []; for (let i = 1; i < g.length; i += 1) d.push(g[i] - g[i - 1]);
    const ad = d.map(Math.abs); const v = d.map((x) => x * 60); const dv = []; for (let i = 1; i < v.length; i += 1) dv.push(Math.abs(v[i] - v[i - 1]));
    const mv = ad.filter((x) => x > 1e-6);
    let flips = 0; for (let i = 1; i < v.length; i += 1) if (Math.abs(v[i]) > 0.05 && Math.abs(v[i - 1]) > 0.05 && Math.sign(v[i]) !== Math.sign(v[i - 1])) flips += 1;
    return { deltaMedian: round(pct(mv, 50), 6), deltaP95: round(pct(ad, 95), 6), deltaMax: round(Math.max(0, ...ad), 6), velocityPeak: round(Math.max(0, ...v.map(Math.abs)), 3), velocityVariance: round(variance(v), 4), velocityStepP95: round(pct(dv, 95), 3), velocityStepMax: round(Math.max(0, ...dv), 3), signFlips: flips };
  };
  const req60 = gstat(grid(ctp, "lin"));
  const shown60 = gstat(grid(vp, "hold"));
  // Internal transport frames (only present on the AFTER build, dev hook)
  const inf = (run.rec.internal || []).filter((f) => f.id === run.boundary);
  let internal = null;
  if (inf.length > 2) {
    const iv = inf.map((f) => f.velocity), ia = inf.map((f) => Math.abs(f.acceleration)), gap = inf.map((f) => Math.abs(f.gap));
    internal = { frames: inf.length, peakVelocity: round(Math.max(...iv.map(Math.abs)), 3), peakAccel: round(Math.max(...ia), 2), maxGap: round(Math.max(...gap), 4), writes: inf[inf.length - 1].writes - inf[0].writes };
  }
  // Seek service: write -> seeked, and write -> presented (first rVFC whose mediaTime reached the requested time's frame)
  const svc = []; const pres = []; let unpres = 0;
  { let si = 0;
    for (let i = 0; i < writes.length; i += 1) {
      const w = writes[i]; if (w.id !== run.boundary) continue;
      while (si < run.rec.seeked.length && (run.rec.seeked[si].t < w.t || run.rec.seeked[si].id !== run.boundary)) si += 1;
      if (si < run.rec.seeked.length) { const nxt = writes[i + 1] && writes[i + 1].t; if (!nxt || run.rec.seeked[si].t <= nxt) svc.push(run.rec.seeked[si].t - w.t); }
    }
    const pl = run.rec.presentedLog.filter((x) => x.id === run.boundary);
    let pi = 0;
    for (let i = 0; i < writes.length; i += 1) {
      const w = writes[i]; if (w.id !== run.boundary) continue;
      while (pi > 0 && pl[pi - 1].t >= w.t) pi -= 1;
      while (pi < pl.length && pl[pi].t < w.t) pi += 1;
      let hit = null;
      for (let k = pi; k < pl.length && pl[k].t <= w.t + 300; k += 1) { if (Math.abs(pl[k].mt - w.v) <= 0.009) { hit = pl[k]; break; } }
      if (hit) pres.push(hit.t - w.t); else unpres += 1;
    }
  }
  // sign changes of visual velocity beyond noise (direction snaps)
  let signFlips = 0;
  for (let i = 1; i < vel.length; i += 1) if (Math.abs(vel[i]) > 0.05 && Math.abs(vel[i - 1]) > 0.05 && Math.sign(vel[i]) !== Math.sign(vel[i - 1])) signFlips += 1;
  // acceleration spikes
  const acc = [];
  for (let i = 1; i < vel.length; i += 1) acc.push((vel[i] - vel[i - 1]) / Math.max(0.004, (tfr[i] - tfr[i - 1]) / 1000));
  const jerkVel = [];
  for (let i = 1; i < vel.length; i += 1) jerkVel.push(Math.abs(vel[i] - vel[i - 1]));
  // presented-frame lag: requested time minus presented mediaTime, ms
  const lag = fr.filter((f) => f.pm !== null && f.pm !== undefined).map((f) => (f.ct - f.pm) * 1000);
  const stale = lag.filter((l) => Math.abs(l) > 25).length;
  // settle latency: last wheel event -> last frame where the visual progress moved
  const lastWheelAbs = run.wall0 + run.lastWheelAt; // node clock; convert using page t0 offset
  let lastMove = null; let lastMoveIdx = -1;
  for (let i = 1; i < fr.length; i += 1) if (Math.abs(vp[i] - vp[i - 1]) > 1 / (fr[i].dur * 240)) { lastMove = fr[i].t; lastMoveIdx = i; }
  const lastWheelPage = t0 + run.lastWheelAt;
  const settleMs = lastMove === null ? null : Math.max(0, lastMove - lastWheelPage);
  // largest visual jump over ~1 frame
  const largestJump = absd.length ? Math.max(...absd) : 0;
  // reverse spike: max |velocity change| in the window around the scroll-direction reversal (scroll-side)
  let reverseSpike = null;
  if (/fwd_rev|rev_fwd/.test(run.name)) {
    let rev = -1;
    for (let i = 2; i < tvel.length; i += 1) if (Math.abs(tvel[i]) > 0.1 && Math.sign(tvel[i]) !== Math.sign(tvel[i - 2]) && Math.abs(tvel[i - 2]) > 0.1) { rev = i; break; }
    if (rev >= 0) reverseSpike = Math.max(...jerkVel.slice(Math.max(0, rev - 8), rev + 12));
  }
  // stop -> still, measured from when the TARGET (scroll progress) stops moving: what the transport itself adds after Lenis' tail.
  let targetStop = null; let reqStill = null; let shownStill = null;
  for (let i = 1; i < fr.length; i += 1) if (Math.abs(fr[i].tp - fr[i - 1].tp) > 2e-5) targetStop = fr[i].t;
  for (let i = 1; i < fr.length; i += 1) if (Math.abs(ctp[i] - ctp[i - 1]) > 1 / (fr[i].dur * 240)) reqStill = fr[i].t;
  for (let i = 1; i < fr.length; i += 1) if (Math.abs(vp[i] - vp[i - 1]) > 1 / (fr[i].dur * 240)) shownStill = fr[i].t;
  const settleAfterTarget = targetStop !== null && reqStill !== null ? { requested: round(Math.max(0, reqStill - targetStop), 0), shown: shownStill !== null ? round(Math.max(0, shownStill - targetStop), 0) : null } : null;
  // reverse latency: scroll-progress (target) direction reversal -> shown/requested direction reversal
  let reverseLag = null;
  if (/fwd_rev|rev_fwd/.test(run.name) && fr.length > 40) {
    const K = 8; const dirOf = (arr, i) => arr[i] - arr[i - K];
    let first = 0; for (let i = K; i < fr.length; i += 1) { const d = dirOf(fr.map((f) => f.tp), i); if (Math.abs(d) > 4e-4) { first = Math.sign(d); break; } }
    const tpArr = fr.map((f) => f.tp); let ti = -1;
    for (let i = K; i < fr.length; i += 1) { const d = dirOf(tpArr, i); if (first && Math.sign(d) === -first && Math.abs(d) > 4e-4) { ti = i; break; } }
    if (ti > 0) for (let i = ti - 4; i < fr.length; i += 1) { if (i < K) continue; const d = dirOf(vp, i); if (Math.sign(d) === -first && Math.abs(d) > 1.5e-4) { reverseLag = fr[i].t - fr[ti].t; break; } }
  }
  // input -> visible: first wheel event to the first presented frame that differs from the resting frame
  let inputToVisible = null;
  if (run.wheelLog.length && fr.length) {
    const firstWheelPage = t0 + run.wheelLog[0].t;
    const base = vp[0];
    for (let i = 0; i < fr.length; i += 1) { if (fr[i].t >= firstWheelPage && Math.abs(vp[i] - base) > 2 / (fr[i].dur * 120)) { inputToVisible = fr[i].t - firstWheelPage; break; } }
  }
  const totalTravel = vp.length ? Math.abs(vp[vp.length - 1] - vp[0]) : 0;
  const scrollSpanS = (run.lastWheelAt || 1) / 1000;
  const seekTimes = writes.map((w) => w.t);
  const seekGaps = []; for (let i = 1; i < seekTimes.length; i += 1) seekGaps.push(seekTimes[i] - seekTimes[i - 1]);
  const recSeconds = (frames.length ? frames[frames.length - 1].t - frames[0].t : 0) / 1000;
  return {
    profile: run.name, boundary: run.boundary, frames: frames.length, inBoundaryFrames: fr.length,
    rafDt: { p50: round(pct(dts, 50), 2), p95: round(pct(dts, 95), 2), max: round(Math.max(...dts), 2) },
    visualProgressPerFrame: { median: round(pct(moving, 50), 6), p95: round(pct(absd, 95), 6), max: round(largestJump, 6) },
    visualVelocity: { peakAbs: round(Math.max(0, ...vel.map(Math.abs)), 3), variance: round(variance(vel), 4), p95Abs: round(pct(vel.map(Math.abs), 95), 3) },
    requested: {
      perFrameMedian: round(pct(cmoving, 50), 6), perFrameP95: round(pct(cdp, 95), 6), perFrameMax: round(Math.max(0, ...cdp), 6),
      velocityPeakAbs: round(Math.max(0, ...cvel.map(Math.abs)), 3), velocityP95Abs: round(pct(cvel.map(Math.abs), 95), 3), velocityVariance: round(variance(cvel), 4),
      accelStepP95: round(pct(cacc, 95), 3), accelStepMax: round(Math.max(0, ...cacc), 3),
    },
    seekServiceMs: { n: svc.length, p50: round(pct(svc, 50), 1), p95: round(pct(svc, 95), 1), max: round(Math.max(0, ...svc), 1) },
    unpresentedWrites: unpres,
    staleWrites: pres.filter((d) => d > 50).length + unpres,
    writeToPresentMs: { n: pres.length, p50: round(pct(pres, 50), 1), p95: round(pct(pres, 95), 1), max: round(Math.max(0, ...pres), 1) },
    req60, shown60,
    internal,
    scrollProgressVelocityPeakAbs: round(Math.max(0, ...tvel.map(Math.abs)), 3),
    peakAccel: round(Math.max(0, ...acc.map(Math.abs)), 2),
    velocityStepP95: round(pct(jerkVel, 95), 3),
    velocityStepMax: round(Math.max(0, ...jerkVel), 3),
    signFlips,
    seekWrites: writes.length,
    seekWritesPerSec: round(writes.length / Math.max(0.001, recSeconds), 1),
    seekGapMs: { p50: round(pct(seekGaps, 50), 2), p05: round(pct(seekGaps, 5), 2) },
    presentedFramesPerSec: round((pframes || 0) / Math.max(0.001, recSeconds), 1),
    presentedFrames: pframes || 0,
    lagMs: { p50: round(pct(lag, 50), 1), p95: round(pct(lag.map(Math.abs), 95), 1), max: round(Math.max(0, ...lag.map(Math.abs)), 1) },
    staleFrames: stale,
    reverseLagMs: round(reverseLag, 0),
    settleAfterTargetStopMs: settleAfterTarget,
    inputToVisibleMs: round(inputToVisible, 0),
    settleMsAfterLastWheel: round(settleMs, 0),
    largestVisualJump: round(largestJump, 6),
    reverseSpike: round(reverseSpike, 3),
    visualTravel: round(totalTravel, 4),
    wheelTravelPx: run.cumulative,
    rangePx: round(run.range, 0),
    scrollSeconds: round(scrollSpanS, 2),
  };
}

// ------------------------------------------------------------------ main
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("harness.mjs")) {
  const names = profileArg === "all" ? Object.keys(PROFILES) : profileArg.split(",");
  const boundaries = boundaryArg.split(",").map(Number);
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
  const { ctx, page } = await openPage(browser);
  const info = await page.evaluate(() => ({ ua: navigator.userAgent, dpr: devicePixelRatio, w: innerWidth, h: innerHeight }));
  console.log("chrome", info);
  const summary = [];
  for (const b of boundaries) {
    for (const name of names) {
      const profile = PROFILES[name];
      if (!profile) { console.log("unknown profile", name); continue; }
      const run = await runProfile(page, name, profile, b);
      const a = analyze(run);
      fs.writeFileSync(path.join(OUT, `${name}@${run.boundary}.json`), JSON.stringify({ analysis: a, run }, null, 0));
      summary.push(a);
      console.log(name, run.boundary, JSON.stringify({ vpMed: a.visualProgressPerFrame.median, vpP95: a.visualProgressPerFrame.p95, vpMax: a.visualProgressPerFrame.max, v60: [a.req60.velocityPeak, a.shown60.velocityPeak], d60max: [a.req60.deltaMax, a.shown60.deltaMax], svc: [a.seekServiceMs.p50, a.seekServiceMs.p95], w2p: [a.writeToPresentMs.p50, a.writeToPresentMs.p95], tr: a.internal && [a.internal.peakVelocity, a.internal.peakAccel, a.internal.maxGap], sPeak: a.scrollProgressVelocityPeakAbs, seeks: a.seekWrites, settleT: a.settleAfterTargetStopMs, i2v: a.inputToVisibleMs, unpres: a.unpresentedWrites, stale: a.staleWrites, flips: a.signFlips }));
    }
  }
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ info, summary }, null, 2));
  await ctx.close();
  await browser.close();
}
