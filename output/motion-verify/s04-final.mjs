import { open, seek, shot } from "./lib.mjs";
import fs from "node:fs";
const vps = ["1920x1080","1440x900","1366x768","430x932","390x844"];
const P = [0,0.25,0.5,0.75,1.0];
for (const vp of vps) {
  const { browser, page } = await open(vp);
  const dir = `output/motion-verify/s04-final/${vp}`;
  // forward
  for (const p of P) { await seek(page,"scene","step-up",p===0?0.001:p===1?0.999:p,6); await shot(page,dir,`fwd_${p}`); }
  // reverse from terminal
  for (const p of [...P].reverse()) { await seek(page,"scene","step-up",p===0?0.001:p===1?0.999:p,6); await shot(page,dir,`rev_${p}`); }
  // seam frames
  if (!vp.startsWith("4") && !vp.startsWith("3")||vp==="1920x1080"||vp==="1440x900"||vp==="1366x768") {
    await seek(page,"tr","03-04",0.93,6); await shot(page,dir,"seam_in_video");
    await seek(page,"scene","step-up",0.03,6); await shot(page,dir,"seam_in_live");
    await seek(page,"scene","step-up",0.95,6); await shot(page,dir,"seam_out_live");
    await seek(page,"tr","04-05",0.06,6); await shot(page,dir,"seam_out_video");
  }
  await browser.close();
}
