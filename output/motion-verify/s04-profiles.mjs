import { open, trackY } from "./lib.mjs";
import fs from "node:fs";
const vp = process.argv[2] ?? "1440x900";
const record = process.argv[3] === "video";
const dir = `output/motion-verify/s04-video/${vp}`;
fs.mkdirSync(dir, { recursive: true });
const { browser, ctx, page } = await open(vp, record ? { video: dir } : {});

// drive scroll along waypoints [{y, speed px/s}] one step per rAF; sample telemetry.
async function run(name, waypoints, opts = {}) {
  const samples = await page.evaluate(async ({ waypoints, opts }) => {
    const out = [];
    const carrier = document.querySelector("[data-stepup-travel-carrier]");
    const art = document.querySelector("[data-travel-artifact]");
    const bar = document.querySelector("[data-bar-status]");
    const stamps = ["[data-hold-stamp]","[data-clear-seal]","[data-referral-notice]"].map(s=>document.querySelector(s));
    let y = window.scrollY;
    const sample = (t) => {
      const r = art.getBoundingClientRect();
      out.push({ t, y: window.scrollY, l: r.left, r: r.right, top: r.top, h: r.height, w: r.width,
        op: [getComputedStyle(carrier).opacity, ...stamps.map(s=>getComputedStyle(s).opacity)].map(Number),
        vis: getComputedStyle(carrier).visibility, bar: bar.textContent });
    };
    for (const wp of waypoints) {
      if (wp.pause) { const t0 = performance.now(); await new Promise(res=>{const f=()=>{sample(performance.now()); (performance.now()-t0>=wp.pause)?res():requestAnimationFrame(f)}; requestAnimationFrame(f)}); continue; }
      const speed = wp.speed; // px/s
      await new Promise((res) => {
        let last = performance.now();
        const step = (now) => {
          const dt = Math.min(now - last, 50) / 1000; last = now;
          const dir = Math.sign(wp.y - y);
          y += dir * speed * dt;
          if ((dir > 0 && y >= wp.y) || (dir < 0 && y <= wp.y)) y = wp.y;
          window.scrollTo(0, y); window.ScrollTrigger.update();
          sample(now);
          if (y === wp.y) res(); else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    return out;
  }, { waypoints, opts });
  // analyse
  let maxJump = 0, jumpAt = null, dupStamp = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i-1], b = samples[i];
    const dy = Math.abs(b.y - a.y);
    const jump = Math.max(Math.abs(b.l - a.l), Math.abs(b.w - a.w), Math.abs(b.top - a.top), Math.abs(b.h - a.h));
    const norm = dy > 0.5 ? jump / dy : (jump > 3 ? 999 : 0);
    if (norm > maxJump) { maxJump = norm; jumpAt = { i, y: b.y, jump: Math.round(jump), dy: Math.round(dy), a: a.bar, b: b.bar }; }
  }
  console.log(name.padEnd(28), "frames", samples.length, "max px-per-scrollpx", maxJump.toFixed(2), JSON.stringify(jumpAt));
  return samples;
}

const Y = async (kind, id, p) => trackY(page, kind, id, p);
const inTail = await Y("tr","03-04",0.8);
const s0 = await Y("scene","step-up",0), s1 = await Y("scene","step-up",1);
const at = async (p) => Y("scene","step-up",p);
const outHead = await Y("tr","04-05",0.15);
await page.evaluate((y)=>{window.scrollTo(0,y);window.ScrollTrigger.update()}, inTail);
await page.waitForTimeout(500);

await run("very slow fwd (in seam→0.3)", [{y: await at(0.3), speed: 120}]);
await run("normal fwd (0.3→end)", [{y: s1, speed: 900}]);
await run("normal fwd (end→04-05 0.15)", [{y: outHead, speed: 900}]);
await run("reverse from terminal", [{y: await at(0.6), speed: 900}]);
await run("fast fwd (0.6→end)", [{y: s1, speed: 4000}]);
await run("reverse fast → 0.05", [{y: await at(0.05), speed: 4000}]);
await run("slow→fast→slow", [{y: await at(0.2), speed: 150},{y: await at(0.7), speed: 3000},{y: await at(0.85), speed: 150}]);
await run("stop mid 0.25/0.5/0.75", [{y: await at(0.25), speed: 900},{pause:400},{y: await at(0.5), speed: 900},{pause:400},{y: await at(0.75), speed: 900},{pause:400}]);
await run("reverse from 0.75→0.25", [{y: await at(0.25), speed: 700}]);
// oscillation around clearance threshold (seal ~0.55-0.61)
const c = await at(0.58);
await run("oscillate around clearance", [{y:c-120,speed:600},{y:c+120,speed:300},{y:c-120,speed:300},{y:c+120,speed:300},{y:c,speed:300}]);
await ctx.close(); await browser.close();
