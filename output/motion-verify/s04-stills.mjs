import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2] ?? "1440x900";
const out = `output/motion-verify/s04/${vp}`;
const { browser, page } = await open(vp);
const info = await page.evaluate(() => window.ScrollTrigger.getAll().filter(t=>t.trigger?.getAttribute?.("data-track")==="step-up"||t.trigger?.getAttribute?.("data-transition-track")).map(t=>({tr:t.trigger.getAttribute("data-track")||t.trigger.getAttribute("data-transition-track"),s:Math.round(t.start),e:Math.round(t.end),anim:!!t.animation})));
console.log(JSON.stringify(info));
for (const p of [0.7, 0.9, 1.0]) { await seek(page,"tr","03-04",p); await shot(page,out,`a_t0304_${p}`); }
for (const p of [0, 0.02, 0.05, 0.1, 0.15, 0.25, 0.37, 0.45, 0.5, 0.6, 0.75, 0.85, 0.9, 0.98, 1.0]) { await seek(page,"scene","step-up",p); await shot(page,out,`b_s04_${String(p).padStart(4,"0")}`); }
for (const p of [0, 0.05, 0.1, 0.3]) { await seek(page,"tr","04-05",p); await shot(page,out,`c_t0405_${p}`); }
await browser.close();
