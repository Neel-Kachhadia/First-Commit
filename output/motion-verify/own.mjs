import { open, seek } from "./lib.mjs";
const { browser, page } = await open("390x844");
for (const p of [0.05,0.3,0.6,0.85,0.97]) { await seek(page,"scene","decisions",p,6);
 console.log(p, JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll("[data-scene]")].filter(e=>getComputedStyle(e).visibility==="visible").map(e=>e.getAttribute("data-scene"))))); }
await browser.close();
