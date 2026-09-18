import { open, seek } from "./lib.mjs";
const { browser, page } = await open("1440x900");
await seek(page,"tr","03-04",0.9);
console.log(await page.evaluate(()=>{const v=[...document.querySelectorAll("video")].find(v=>v.src.includes("03-04"));const r=v.getBoundingClientRect();return {r:[r.left,r.top,r.width,r.height],vw:v.videoWidth,vh:v.videoHeight,t:v.currentTime,op:v.style.opacity,dpr:devicePixelRatio,iw:innerWidth}}));
await browser.close();
