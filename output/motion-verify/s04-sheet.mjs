import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2];
const ps = process.argv.slice(3).map(Number);
const { browser, page } = await open(vp);
for (const p of ps) { await seek(page,"scene","step-up",p,6); await shot(page,`output/motion-verify/s04sheet/${vp}`,`p${String(Math.round(p*100)).padStart(3,"0")}`); }
await browser.close();
