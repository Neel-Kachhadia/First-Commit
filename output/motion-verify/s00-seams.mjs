import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
const d = `output/motion-verify/s00seam/${vp}`;
await seek(page,"scene","prologue",0.85,8); await page.waitForTimeout(400); await shot(page,d,"out_live");
await seek(page,"tr","00-01",0.07,8); await shot(page,d,"out_film");
await seek(page,"tr","00-01",0.12,8); await shot(page,d,"out_film2");
await browser.close();
