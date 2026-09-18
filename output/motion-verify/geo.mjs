import { open, seek } from "./lib.mjs";
const { browser, page } = await open("1920x1080");
await seek(page,"scene","step-up",0.13,6);
console.log(await page.evaluate(()=>{const c=document.querySelector("[data-stepup-travel-carrier]");const a=document.querySelector("[data-travel-artifact]");const f=e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round)};const cs=getComputedStyle(c);return {c:f(c),a:f(a),origin:cs.transformOrigin,disp:cs.display,st:f(document.querySelector("[data-clearance-station]"))}}));
await browser.close();
