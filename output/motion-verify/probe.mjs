import { open, seek } from "./lib.mjs";
const vp = process.argv[2] ?? "1440x900";
const { browser, page } = await open(vp);
for (const p of [0, 0.02, 0.04, 0.06, 0.09, 0.13, 0.2]) {
  await seek(page, "scene", "step-up", p, 6);
  const r = await page.evaluate(() => {
    const c = document.querySelector("[data-stepup-travel-carrier]");
    const a = document.querySelector("[data-travel-artifact]").getBoundingClientRect();
    return { tf: c.style.transform, l: Math.round(a.left), r: Math.round(a.right), w: Math.round(a.width) };
  });
  console.log(p, JSON.stringify(r));
}
await browser.close();
