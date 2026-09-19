import { open, seek } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
await seek(page,"scene","step-up",0.03,6);
console.log(vp, JSON.stringify(await page.evaluate(()=>{const f=s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};return {header:f("[data-stepup-header]"),bar:f("[data-registration-bar]"),brk:f("[data-clearance-bracket]"),footer:f("[data-stepup-footer]")}})));
await browser.close();
