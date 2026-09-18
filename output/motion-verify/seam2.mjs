import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
await seek(page,"scene","step-up",1.0,6); await shot(page,`output/motion-verify/seam2/${vp}`,"a_live_end");
await seek(page,"scene","step-up",0.9,6); await shot(page,`output/motion-verify/seam2/${vp}`,"a_live_090");
await seek(page,"tr","04-05",0.06,6); await shot(page,`output/motion-verify/seam2/${vp}`,"b_video_start");
await browser.close();
