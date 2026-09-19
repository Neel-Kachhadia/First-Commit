import { open, seek, shot } from "./lib.mjs";
for (const vp of ["1920x1080","1440x900","1366x768"]) {
  const { browser, page } = await open(vp);
  await seek(page,"tr","03-04",0.9); await shot(page,`output/motion-verify/edge/${vp}`,"t");
  await browser.close();
}
