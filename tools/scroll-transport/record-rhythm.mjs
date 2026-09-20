import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const [prefix = "before", trArg = "normal", vpArg = "1440x900"] = process.argv.slice(2);
const [VW, VH] = vpArg.split("x").map(Number);
const OUT = path.join("output", "recordings");
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sleepUntil(t) {
  for (;;) {
    const d = t - performance.now();
    if (d <= 2) break;
    await sleep(Math.max(1, d - 3));
  }
  while (performance.now() < t) { /* spin */ }
}
const rep = (n, dy, gap) => Array.from({ length: n }, () => ({ dy, gap }));

const TRAVERSALS = {
  normal: { dir: 1, events: () => rep(4000, 100, 100) },
  slow: { dir: 1, events: () => rep(20000, 4, 16) },
  fast: { dir: 1, events: () => rep(4000, 300, 40) },
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
  const seqOk = JSON.stringify(dedup) === JSON.stringify(expected);
  return { traversal: name, ownerSequence: dedup, ownerChanges: owners.length, maxScrollY: Math.round(maxY), currentTimeWrites: writes, boundaries: perBoundary, seqOk };
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
for (const name of trArg.split(",")) {
  const prog = TRAVERSALS[name];
  const videoDir = path.join(OUT, `_temp_${prefix}_${name}`);
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    colorScheme: "dark",
    recordVideo: {
      dir: videoDir,
      size: { width: Math.min(VW, 1280), height: Math.round((Math.min(VW, 1280) * VH) / VW) },
    },
  });
  const page = await ctx.newPage();
  await page.addInitScript(RECORDER);
  const q = name === "normal" ? "?intro=1" : "?intro=0";
  console.log(`Starting ${prefix} ${name} traversal on ${BASE}/${q}...`);
  await page.goto(`${BASE}/${q}`, { waitUntil: "load", timeout: 120_000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForFunction(() => window.ScrollTrigger && document.querySelectorAll("[data-transition-track]").length === 7, null, { timeout: 60_000 });
  if (q.includes("intro=1")) {
    await page.locator("[data-film-intro]").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => console.log("intro did not hide in 30 s"));
  }
  await sleep(1500);
  await page.mouse.move(VW / 2, VH / 2);
  await page.evaluate(() => { document.querySelectorAll("[data-transition-video]").forEach((v) => v.load && 0); });
  await page.evaluate(() => { window.__fp.on = true; });

  const t0 = performance.now();
  let at = t0 + 200;
  await sleepUntil(at);
  const events = prog.events();
  let idleTicks = 0;
  for (let i = 0; i < events.length; i += 1) {
    if (events[i].dy) await page.mouse.wheel(0, events[i].dy);
    at += events[i].gap;
    await sleepUntil(at);
    if (i % 25 === 0) {
      const atEnd = await page.evaluate(() => window.scrollY >= document.documentElement.scrollHeight - innerHeight - 2);
      idleTicks = atEnd ? idleTicks + 1 : 0;
      if (idleTicks >= 3) break;
    }
  }
  await sleep(1500);
  const res = await page.evaluate(() => {
    window.__fp.on = false;
    return { frames: window.__fp.frames, owners: window.__fp.owners, writes: window.__fp.writes, wheel: window.__fp.wheel };
  });
  const wallSeconds = r4((performance.now() - t0) / 1000);
  const a = analyse(name, res);
  a.wallSeconds = wallSeconds;

  const targetFilename = `fullsite-${prefix}-${name}`;
  fs.writeFileSync(path.join(OUT, `${targetFilename}.json`), JSON.stringify(a, null, 2));

  const vid = page.video();
  await ctx.close();
  if (vid) {
    const videoPath = await vid.path();
    fs.copyFileSync(videoPath, path.join(OUT, `${targetFilename}.webm`));
    console.log(`Saved video to ${path.join(OUT, `${targetFilename}.webm`)}`);
  }
  fs.rmSync(videoDir, { recursive: true, force: true });
  console.log(`Finished ${prefix} ${name}: wallSeconds=${wallSeconds}, maxScrollY=${a.maxScrollY}, seqOk=${a.seqOk}`);
}
await browser.close();
