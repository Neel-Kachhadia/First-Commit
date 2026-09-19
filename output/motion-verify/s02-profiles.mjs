import { open, trackY } from "./lib.mjs";
import fs from "node:fs";
const vp = process.argv[2] ?? "1440x900";
const record = process.argv[3] === "video";
const dir = `output/motion-verify/s02-video/${vp}`;
fs.mkdirSync(dir, { recursive: true });
const { browser, ctx, page } = await open(vp, record ? { video: dir } : {});

async function run(name, waypoints) {
  const samples = await page.evaluate(async ({ waypoints }) => {
    const out = [];
    const els = {
      allow: document.querySelector("[data-receipt-wrap='allow']"),
      stepup: document.querySelector("[data-receipt-wrap='stepup']"),
      deny: document.querySelector("[data-receipt-wrap='deny']"),
      lblA: document.querySelector("[data-lane-tagwrap='allow']"),
      lblB: document.querySelector("[data-lane-tagwrap='stepup']"),
      lblC: document.querySelector("[data-lane-tagwrap='deny']"),
    };
    const alloc = { textContent: "0" }, rem = { textContent: "4000" };
    let y = window.scrollY;
    const rect = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
    const sample = (t) => out.push({
      t, y: window.scrollY,
      r: Object.fromEntries(Object.entries(els).map(([k, e]) => [k, rect(e)])),
      op: Object.fromEntries(Object.entries(els).map(([k, e]) => [k, +getComputedStyle(e).opacity])),
      alloc: "0", rem: "4000",
    });
    for (const wp of waypoints) {
      if (wp.pause) {
        const t0 = performance.now();
        await new Promise((res) => { const f = () => { sample(performance.now()); performance.now() - t0 >= wp.pause ? res() : requestAnimationFrame(f); }; requestAnimationFrame(f); });
        continue;
      }
      await new Promise((res) => {
        let last = performance.now();
        const step = (now) => {
          const dt = Math.min(now - last, 50) / 1000; last = now;
          const dir = Math.sign(wp.y - y);
          y += dir * wp.speed * dt;
          if ((dir > 0 && y >= wp.y) || (dir < 0 && y <= wp.y)) y = wp.y;
          window.scrollTo(0, y); window.ScrollTrigger.update();
          sample(now);
          if (y === wp.y) res(); else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    return out;
  }, { waypoints });
  let maxNorm = 0, at = null, bad = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const dy = Math.abs(b.y - a.y);
    for (const k of Object.keys(a.r)) {
      const jump = Math.max(...a.r[k].map((v, j) => Math.abs(v - b.r[k][j])));
      const norm = dy > 0.5 ? jump / dy : (jump > 3 ? 999 : 0);
      if (norm > maxNorm) { maxNorm = norm; at = { k, y: Math.round(b.y), jump: Math.round(jump), dy: Math.round(dy) }; }
    }
    // impossible accounting: delegated + remaining must equal 4000
  }
  console.log(name.padEnd(30), "frames", String(samples.length).padStart(5), "max px/scrollpx", maxNorm.toFixed(2), JSON.stringify(at), "accounting-violations", bad);
}

const at = (p) => trackY(page, "scene", "decisions", p);
const s1 = await at(1);
await page.evaluate((y) => { window.scrollTo(0, y); window.ScrollTrigger.update(); }, await trackY(page, "tr", "01-02", 0.8));
await page.waitForTimeout(500);
await run("very slow in-seam -> 0.45", [{ y: await at(0.45), speed: 120 }]);
await run("normal 0.45 -> end", [{ y: s1, speed: 900 }]);
await run("reverse terminal -> 0.5", [{ y: await at(0.5), speed: 900 }]);
await run("fast fwd 0.5 -> end", [{ y: s1, speed: 4000 }]);
await run("fast reverse -> 0.03", [{ y: await at(0.03), speed: 4000 }]);
await run("slow->fast->slow", [{ y: await at(0.2), speed: 150 }, { y: await at(0.7), speed: 3000 }, { y: await at(0.9), speed: 150 }]);
await run("fast->slow->fast", [{ y: await at(0.15), speed: 3000 }, { y: await at(0.45), speed: 150 }, { y: await at(0.95), speed: 3000 }]);
await run("stop 25/50/75", [{ y: await at(0.25), speed: 900 }, { pause: 400 }, { y: await at(0.5), speed: 900 }, { pause: 400 }, { y: await at(0.75), speed: 900 }, { pause: 400 }]);
await run("reverse 0.75 -> 0.25", [{ y: await at(0.25), speed: 700 }]);
for (const [name, p] of [["allow", 0.27], ["stepup", 0.55], ["deny", 0.78]]) {
  const c = await at(p);
  await run(`oscillate ${name} (${p})`, [{ y: c - 120, speed: 600 }, { y: c + 120, speed: 300 }, { y: c - 120, speed: 300 }, { y: c + 120, speed: 300 }]);
}
await ctx.close(); await browser.close();
