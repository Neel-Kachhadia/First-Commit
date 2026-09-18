import { open, seek, shot } from "./lib.mjs";
const vp = process.argv[2];
const { browser, page } = await open(vp);
const d = `output/motion-verify/s03seam/${vp}`;
await seek(page,"tr","02-03",0.93,6); await shot(page,d,"in_film");
await seek(page,"scene","delegation",0.03,6); await shot(page,d,"in_live");
await seek(page,"scene","delegation",0.97,6); await shot(page,d,"out_live");
await seek(page,"tr","03-04",0.09,6); await shot(page,d,"out_film");
await browser.close();
