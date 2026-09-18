import { chromium } from "@playwright/test";
const [hash, ...vps] = process.argv.slice(2);
for (const vp of vps) {
  const [w, h] = vp.split("x").map(Number);
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: "dark" });
  const p = await c.newPage();
  await p.goto(`http://127.0.0.1:3100/?visualTest=1${hash}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({ y: Math.round(scrollY), vis: getComputedStyle(document.querySelector("[data-scene='delegation']")).visibility, alloc: document.querySelector("[data-accounting-allocated]").textContent }));
  console.log(vp, hash, JSON.stringify(info));
  await p.screenshot({ path: `output/motion-verify/deeplink_${vp}.png` });
  await b.close();
}
