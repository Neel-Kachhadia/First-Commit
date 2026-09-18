import { open, seek } from "./lib.mjs";
const { browser, page } = await open("390x844");
for (const p of [0.6,0.85,0.97]) { await seek(page,"scene","mandate",p,6);
 console.log(p, JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll("[data-scene]")].map(e=>[e.dataset.scene,getComputedStyle(e).visibility,e.getAttribute("aria-hidden")])))); }
await browser.close();
