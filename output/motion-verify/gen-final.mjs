import { open, seek, shot } from "./lib.mjs";
// usage: node gen-final.mjs <out> <slug> p1 p2 ... (fwd then reverse) across 5 viewports
const [out, slug, ...P] = process.argv.slice(2).map((v, i) => (i < 2 ? v : Number(v)));
const vps = ["1920x1080","1440x900","1366x768","430x932","390x844"];
for (const vp of vps) {
  const { browser, page } = await open(vp);
  const dir = `output/motion-verify/${out}/${vp}`;
  for (const p of P) { await seek(page,"scene",slug,p,6); await shot(page,dir,`fwd_${p}`); }
  for (const p of [...P].reverse()) { await seek(page,"scene",slug,p,6); await shot(page,dir,`rev_${p}`); }
  await browser.close();
}
