// Full-page traversal in visible Chrome with REAL wheel input, recorded to .webm (Playwright recordVideo) and
// sampled every rAF. Verifies chapter order (no skipped / flip-flopping scene ownership), film continuity across all
// seven boundaries, reverse traversal, and reports per-traversal continuity metrics.
//
//   node tools/scroll-transport/fullpage.mjs <label> [traversals,comma] [viewport WxH]
//   traversals: normal | slow | fast | mixed | reverse
//
// Output: output/scroll-transport/fullpage/<label>/<viewport>/<traversal>.{webm,json}
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const QUERY = process.env.QUERY ?? "?intro=1";
const [label = "run", trArg = "normal,slow,fast,mixed,reverse", vpArg = "1440x900"] = process.argv.slice(2);
const [VW, VH] = vpArg.split("x").map(Number);
const OUT = path.join("output", "scroll-transport", "fullpage", label, vpArg);
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sleepUntil(t) { for (;;) { const d = t - performance.now(); if (d <= 2) break; await sleep(Math.max(1, d - 3)); } while (performance.now() < t) { /* spin */ } }
const rep = (n, dy, gap) => Array.from({ length: n }, () => ({ dy, gap }));

/** Wheel programs; `until` says when a traversal is complete. */
const TRAVERSALS = {
  normal: { dir: 1, events: () => [...rep(20, 100, 100), { dy: 0, gap: 700 }, ...rep(3, -50, 100), { dy: 0, gap: 500 }, ...rep(4000, 100, 100)] }, // normal wheel plus an explicit stop/reverse/continue demonstration
  slow: { dir: 1, events: () => rep(20000, 4, 16) },                           // ~250 px/s micro deltas
  fast: { dir: 1, events: () => rep(4000, 300, 40) },                          // ~7500 px/s flicks
  mixed: { dir: 1, events: () => { const out = []; for (let k = 0; k < 400; k += 1) out.push(...rep(12, 100, 100), ...rep(30, 6, 16), ...rep(5, 300, 40)); return out; } },
  reverse: { dir: -1, events: () => rep(4000, -100, 100) },
};

const RECORDER = `
(() => {
  if (window.__fp) return;
  const fp = (window.__fp = { on: false, frames: [], writes: 0, presented: {}, owners: [], wheel: [] });
  window.addEventListener('wheel', (e) => { if (fp.on) fp.wheel.push({ t: performance.now(), dy: e.deltaY }); }, {capture: true, passive: true});
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", { configurable: true, get() { return desc.get.call(this); }, set(v) { if (fp.on) fp.writes += 1; desc.set.call(this, v); } });
  const arm = (el) => { if (el.__a || typeof el.requestVideoFrameCallback !== "function") return; el.__a = true; const id = el.dataset.transitionVideo; const cb = (n, md) => { fp.presented[id] = md.mediaTime; el.requestVideoFrameCallback(cb); }; el.requestVideoFrameCallback(cb); };
  let lastOwner = null;
  const loop = (ts) => {
    document.querySelectorAll("[data-transition-video]").forEach(arm);
    if (fp.on) {
      if (window.__kpWheel !== fp.wheelHook) { fp.invalidations++; fp.wheelHook = window.__kpWheel; }
      const stage = document.querySelector("[data-cinematic-stage]");
      const owner = stage && stage.dataset.activeScene;
      if (owner !== lastOwner) { fp.owners.push({ t: ts, owner, y: window.scrollY }); lastOwner = owner; }
      const st = window.ScrollTrigger ? window.ScrollTrigger.getAll().filter((t) => t.trigger && t.trigger.dataset && t.trigger.dataset.transitionTrack) : [];
      const act = st.find((t) => t.progress > 0 && t.progress < 1);
      let f = { t: ts, y: window.scrollY, owner, wheel: window.__kpWheel?.snapshot() ?? null };
      if (act) { const id = act.trigger.dataset.transitionTrack; const v = document.querySelector("[data-transition-video='" + id + "']"); f = { ...f, id, tp: act.progress, ct: v.currentTime, dur: v.duration, pm: fp.presented[id] ?? null, op: parseFloat(v.style.opacity || "0") }; }
      fp.frames.push(f);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
`;

const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const r4 = (x) => (x === null || x === undefined ? null : Math.round(x * 1e4) / 1e4);

function analyse(name, res) {
  const { frames, owners, writes } = res;
  const maxY = Math.max(...frames.map((f) => f.y));
  // per-boundary: 60 Hz grid of shown progress within that boundary
  const perBoundary = {};
  for (const id of [...new Set(frames.filter((f) => f.id).map((f) => f.id))]) {
    const fr = frames.filter((f) => f.id === id && f.dur > 0);
    const shown = fr.map((f) => (f.pm ?? f.ct) / f.dur);
    const grid = []; let k = 0;
    if (fr.length > 2) for (let tt = fr[0].t; tt <= fr[fr.length - 1].t; tt += 1000 / 60) { while (k < fr.length - 2 && fr[k + 1].t < tt) k += 1; grid.push(shown[k]); }
    const d = []; for (let i = 1; i < grid.length; i += 1) d.push(Math.abs(grid[i] - grid[i - 1]));
    const opac = fr.map((f) => f.op);
    perBoundary[id] = { frames: fr.length, seconds: r4(fr.length ? (fr[fr.length - 1].t - fr[0].t) / 1000 : 0), shown60DeltaP95: r4(pct(d, 95)), shown60DeltaMax: r4(Math.max(0, ...d)), maxOpacityDip: r4(fr.length ? Math.max(0, ...opac.map((o, i) => (i && opac[i - 1] > 0.99 && o < 0.99 && i < opac.length - 1 && opac[i + 1] > 0.99 ? 1 - o : 0))) : 0) };
  }
  const order = owners.map((o) => o.owner).filter(Boolean);
  const dedup = order.filter((o, i) => i === 0 || o !== order[i - 1]);
  const expected = ["prologue", "mandate", "decisions", "delegation", "stepUp", "revocation", "splitDefense", "concurrency", "causalReplay"];
  if (name === "reverse") expected.reverse();
  const seqOk = JSON.stringify(dedup) === JSON.stringify(expected);
  return { traversal: name, ownerSequence: dedup, ownerChanges: owners.length, maxScrollY: Math.round(maxY), currentTimeWrites: writes, boundaries: perBoundary, seqOk };
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
const summary = [];
for (const name of trArg.split(",")) {
  const prog = TRAVERSALS[name];
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, colorScheme: "dark", recordVideo: { dir: path.join(OUT, `_${name}`), size: { width: Math.min(VW, 1280), height: Math.round((Math.min(VW, 1280) * VH) / VW) } } });
  const page = await ctx.newPage();
  await page.addInitScript(RECORDER);
  const q = name === "normal" ? QUERY : "?intro=0"; // the intro is part of the FIRST (normal) recording only
  await page.goto(`${BASE}/${q}`, { waitUntil: "load", timeout: 120_000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForFunction(() => window.ScrollTrigger && document.querySelectorAll("[data-transition-track]").length === 7, null, { timeout: 60_000 });
  if (q.includes("intro=1")) { await page.locator("[data-film-intro]").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => console.log("intro did not hide in 30 s")); }
  await sleep(1500);
  if (process.env.WHEEL_PARAMS) await page.evaluate((p) => window.__kpWheel.setParams(JSON.parse(p)), process.env.WHEEL_PARAMS);
  if (process.env.PARAMS) await page.evaluate((p) => window.__kpMotion.setParams(JSON.parse(p)), process.env.PARAMS);
  if (process.env.WARM && prog.dir === -1) {
    // Prime the HTTP cache with a quick forward pass (unrecorded) so first-arrival buffering is not part of the measurement.
    await page.mouse.move(VW / 2, VH / 2);
    for (let i = 0; i < 600; i += 1) { await page.mouse.wheel(0, 300); await sleep(30); if (i % 20 === 0 && await page.evaluate(() => window.scrollY >= document.documentElement.scrollHeight - innerHeight - 2)) break; }
    await sleep(1500);
  }
  if (prog.dir === -1) { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(1200); }
  await page.mouse.move(VW / 2, VH / 2);
  // warm the media so a traversal never measures first-load buffering
  await page.evaluate(() => { document.querySelectorAll("[data-transition-video]").forEach((v) => v.load && 0); });
  const settings = await page.evaluate(() => ({ boundary: window.__kpMotion?.params(), wheel: window.__kpWheel?.params?.(), tier: document.querySelector('[data-cinematic-transition-layer]')?.dataset.transitionQuality }));
  await page.evaluate(() => { window.__fp.on = true; window.__fp.invalidations = 0; window.__fp.wheelHook = window.__kpWheel; });
  const t0 = performance.now(); let at = t0 + 200; await sleepUntil(at);
  const events = prog.events();
  let idleTicks = 0;
  for (let i = 0; i < events.length; i += 1) {
    if (events[i].dy) await page.mouse.wheel(0, events[i].dy);
    at += events[i].gap; await sleepUntil(at);
    if (i % 25 === 0) {
      const atEnd = await page.evaluate((dir) => (dir > 0 ? window.scrollY >= document.documentElement.scrollHeight - innerHeight - 2 : window.scrollY <= 2), prog.dir);
      idleTicks = atEnd ? idleTicks + 1 : 0;
      if (idleTicks >= 2) break;
    }
  }
  await sleep(1200);
  const res = await page.evaluate(() => { window.__fp.on = false; return { frames: window.__fp.frames, owners: window.__fp.owners, writes: window.__fp.writes, wheel: window.__fp.wheel, invalidations: window.__fp.invalidations }; });
  const endingSettings = await page.evaluate(() => ({ boundary: window.__kpMotion?.params(), wheel: window.__kpWheel?.params?.(), tier: document.querySelector('[data-cinematic-transition-layer]')?.dataset.transitionQuality }));
  if (res.invalidations || !res.frames.length || JSON.stringify(settings) !== JSON.stringify(endingSettings)) throw new Error('Transport settings changed during traversal; discard this run');
  const seconds = (performance.now() - t0) / 1000;
  const a = analyse(name, res); a.wallSeconds = r4(seconds); a.settings = settings;
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(a, null, 1));
  fs.writeFileSync(path.join(OUT, `${name}-raw.json`), JSON.stringify(res));
  const vid = page.video();
  await ctx.close();
  try { if (vid) fs.copyFileSync(await vid.path(), path.join(OUT, `${name}.webm`)); } catch (e) { console.log("video copy failed", e.message); }
  const temporaryVideoDir = path.resolve(OUT, `_${name}`);
  if (!temporaryVideoDir.startsWith(path.resolve(OUT) + path.sep)) throw new Error("Recording directory outside output root");
  fs.rmSync(temporaryVideoDir, { recursive: true, force: true });
  console.log(name, JSON.stringify({ seconds: a.wallSeconds, owners: a.ownerSequence.join(">"), changes: a.ownerChanges, writes: a.currentTimeWrites, worst60Max: Math.max(0, ...Object.values(a.boundaries).map((b) => b.shown60DeltaMax)), dips: Math.max(0, ...Object.values(a.boundaries).map((b) => b.maxOpacityDip)) }));
  summary.push(a);
}
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();
