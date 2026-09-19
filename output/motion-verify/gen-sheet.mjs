import { open, seek, shot } from "./lib.mjs";
// usage: node gen-sheet.mjs <outname> <vp> <kind:scene|tr> <id> p1 p2 ...
const [out, vp, kind, id, ...ps] = process.argv.slice(2);
const { browser, page } = await open(vp);
for (const p of ps.map(Number)) { await seek(page, kind, id, p, 6); await shot(page, `output/motion-verify/${out}/${vp}`, `${kind}_${id}_${String(Math.round(p*1000)).padStart(4,"0")}`); }
await browser.close();
