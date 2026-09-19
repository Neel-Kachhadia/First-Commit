import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
await seek(page,"tr","03-04",0.93); await shot(page,`output/motion-verify/seam/${vp}`,"a_video");
await seek(page,"scene","step-up",0.03,6); await shot(page,`output/motion-verify/seam/${vp}`,"b_live");
await browser.close();
