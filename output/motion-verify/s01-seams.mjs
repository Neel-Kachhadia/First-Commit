import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
const d = `output/motion-verify/s01seam/${vp}`;
await seek(page,"tr","00-01",0.93,8); await shot(page,d,"in_film");
await seek(page,"scene","mandate",0.03,8); await page.waitForTimeout(400); await shot(page,d,"in_live");
await seek(page,"scene","mandate",0.97,8); await page.waitForTimeout(400); await shot(page,d,"out_live");
await seek(page,"tr","01-02",0.09,8); await shot(page,d,"out_film");
await browser.close();
