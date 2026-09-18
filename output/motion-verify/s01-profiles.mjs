import { open, trackY } from "./lib.mjs";
import fs from "node:fs";
const vp = process.argv[2] ?? "1440x900";
const record = process.argv[3] === "video";
const dir = `output/motion-verify/s01-video/${vp}`;
fs.mkdirSync(dir, { recursive: true });
const { browser, ctx, page } = await open(vp, record ? { video: dir } : {});

async function run(name, waypoints) {
  const samples = await page.evaluate(async ({ waypoints }) => {
    const out = [];
    const q = (s) => [...document.querySelectorAll(s)];
    const fixed = { sheet: document.querySelector("[data-mandate-sheet]"), intent: document.querySelector("[data-mandate-intent]"), head: document.querySelector("#mandate-scene-title") };
    const clipOpen = (e) => { const m = getComputedStyle(e).clipPath.match(/inset\(([\d.]+)(px|%)?\s+([\d.]+)(px|%)?/); if (!m) return 1; return getComputedStyle(e).clipPath === "none" ? 1 : 1 - parseFloat(m[3]) / (m[4] === "%" ? 100 : e.getBoundingClientRect().width || 1); };
    const metric = () => {
      let t = 0;
      for (const e of q("[data-mandate-header],[data-mandate-category],[data-mandate-field]")) t += clipOpen(e);
      for (const e of q("[data-mandate-field-val],[data-mandate-stamp],[data-mandate-footer],[data-mandate-seal],[data-mandate-frame]")) t += +getComputedStyle(e).opacity;
      return t;
    };
    let y = window.scrollY;
    const sample = (t) => out.push({ t, y: window.scrollY, m: metric(), r: Object.fromEntries(Object.entries(fixed).map(([k, e]) => { const r = e.getBoundingClientRect(); return [k, [r.left, r.top, r.width, r.height]]; })) });
    for (const wp of waypoints) {
      if (wp.pause) { const t0 = performance.now(); await new Promise((res) => { const f = () => { sample(performance.now()); performance.now() - t0 >= wp.pause ? res() : requestAnimationFrame(f); }; requestAnimationFrame(f); }); continue; }
      await new Promise((res) => {
        let last = performance.now();
        const step = (now) => {
          const dt = Math.min(now - last, 50) / 1000; last = now;
          const dir = Math.sign(wp.y - y); y += dir * wp.speed * dt;
          if ((dir > 0 && y >= wp.y) || (dir < 0 && y <= wp.y)) y = wp.y;
          window.scrollTo(0, y); window.ScrollTrigger.update(); sample(now);
          if (y === wp.y) res(); else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    return out;
  }, { waypoints });
  // hero objects (sheet, ticket, headline) must never move during the scene
  let drift = 0, maxDM = 0, at = null;
  const r0 = samples[0].r;
  for (const s of samples) for (const k of Object.keys(r0)) drift = Math.max(drift, ...s.r[k].map((v, j) => Math.abs(v - r0[k][j] - (k ? 0 : 0))));
  for (let i = 1; i < samples.length; i++) {
    const dy = Math.abs(samples[i].y - samples[i - 1].y), dm = Math.abs(samples[i].m - samples[i - 1].m);
    const per100 = dy > 0.5 ? (dm / dy) * 100 : (dm > 0.05 ? 99 : 0);
    if (per100 > maxDM) { maxDM = per100; at = { y: Math.round(samples[i].y), dm: +dm.toFixed(2), dy: Math.round(dy) }; }
  }
  console.log(name.padEnd(28), "frames", String(samples.length).padStart(5), "max revealed-units/100px", maxDM.toFixed(2), JSON.stringify(at), "hero-drift(px)", drift.toFixed(1));
}

const at = (p) => trackY(page, "scene", "mandate", p);
const s1 = await at(1);
await page.evaluate((y) => { window.scrollTo(0, y); window.ScrollTrigger.update(); }, await trackY(page, "tr", "00-01", 0.8));
await page.waitForTimeout(600);
await run("very slow in-seam -> 0.4", [{ y: await at(0.4), speed: 120 }]);
await run("normal 0.4 -> end", [{ y: s1, speed: 900 }]);
await run("reverse terminal -> 0.5", [{ y: await at(0.5), speed: 900 }]);
await run("fast fwd 0.5 -> end", [{ y: s1, speed: 4000 }]);
await run("fast reverse -> 0.03", [{ y: await at(0.03), speed: 4000 }]);
await run("slow->fast->slow", [{ y: await at(0.2), speed: 150 }, { y: await at(0.7), speed: 3000 }, { y: await at(0.9), speed: 150 }]);
await run("fast->slow->fast", [{ y: await at(0.15), speed: 3000 }, { y: await at(0.45), speed: 150 }, { y: await at(0.95), speed: 3000 }]);
await run("stop 25/50/75", [{ y: await at(0.25), speed: 900 }, { pause: 400 }, { y: await at(0.5), speed: 900 }, { pause: 400 }, { y: await at(0.75), speed: 900 }, { pause: 400 }]);
await run("reverse 0.75 -> 0.25", [{ y: await at(0.25), speed: 700 }]);
for (const [name, p] of [["limit", 0.29], ["blocked", 0.51], ["seal", 0.83]]) {
  const c = await at(p);
  await run(`oscillate ${name} (${p})`, [{ y: c - 120, speed: 600 }, { y: c + 120, speed: 300 }, { y: c - 120, speed: 300 }, { y: c + 120, speed: 300 }]);
}
await ctx.close(); await browser.close();
