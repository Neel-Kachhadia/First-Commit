import { open, seek } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
for (const p of [0.02, 0.12, 0.5, 0.62]) {
  await seek(page,"scene","step-up",p,6);
  console.log(p, JSON.stringify(await page.evaluate(()=>{const f=s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom),Math.round(r.left),Math.round(r.right)]};return {header:f("[data-stepup-header]"),bar:f("[data-registration-bar]"),art:f("[data-travel-artifact]"),brk:f("[data-clearance-bracket]"),foot:f("[data-stepup-footer]"),vh:innerHeight}})));
}
await browser.close();
