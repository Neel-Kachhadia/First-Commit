import { open, scrollTo, shot } from "./lib.mjs";
const vp = process.argv[2]; const which = process.argv[3] ?? "in"; // in = 03-04 -> scene start ; out = scene end -> 04-05
const { browser, page } = await open(vp);
const key = which === "in" ? "03-04" : "04-05";
const sceneY = await page.evaluate((w)=>{const st=window.ScrollTrigger.getAll().find(t=>t.trigger?.getAttribute?.("data-track")==="step-up"&&t.animation);return w==="in"?st.start:st.end},which);
const offs = which==="in" ? [-160,-96,-64,-32,-8,0,16,32,64,96,144] : [-144,-96,-64,-32,-8,0,16,32,64,96,160];
const rows=[];
for (const o of offs) {
  await scrollTo(page, sceneY+o, 6);
  const r = await page.evaluate((k)=>{const v=document.querySelector(`video[src*="${k}"]`);return {op:+getComputedStyle(v).opacity, t:+v.currentTime.toFixed(2)}},key);
  rows.push({o, ...r});
  await shot(page,`output/motion-verify/blend/${vp}/${which}`,`o${o<0?"m"+(-o):"p"+o}`);
}
console.log(vp,which,rows.map(r=>`${r.o}:${r.op.toFixed(2)}`).join("  "));
await browser.close();
