import { open, scrollTo, shot } from "./lib.mjs";
const [vp, slug, edge, ...offs] = process.argv.slice(2); // edge: start|end
const { browser, page } = await open(vp);
const y0 = await page.evaluate(([slug,edge])=>{const st=window.ScrollTrigger.getAll().find(t=>t.trigger?.getAttribute?.("data-track")===slug&&t.animation);return edge==="start"?st.start:st.end},[slug,edge]);
for (const o of offs.map(Number)) { await scrollTo(page, y0+o, 6); await shot(page,`output/motion-verify/blend2/${slug}/${vp}/${edge}`,`o${o<0?"m"+(-o):"p"+o}`); }
await browser.close();
