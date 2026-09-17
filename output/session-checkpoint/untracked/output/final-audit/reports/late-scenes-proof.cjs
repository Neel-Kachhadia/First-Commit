const { chromium } = require("playwright");
const fs = require("fs");

async function seek(page, id, progress) {
  const y = await page.evaluate(({ id, progress }) => {
    const track = document.querySelector(`[data-track='${id}']`);
    const rect = track.getBoundingClientRect();
    return Math.round(scrollY + rect.top + rect.height * progress);
  }, { id, progress });
  await page.evaluate((target) => {
    scrollTo(0, target);
    dispatchEvent(new Event("scroll"));
    window.ScrollTrigger?.update?.();
  }, y);
  await page.waitForTimeout(100);
}

(async () => {
  fs.mkdirSync("output/final-audit/after/late-scenes", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const result = {};
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    const page = await browser.newPage({ viewport });
    await page.goto("http://127.0.0.1:3000/?visualTest=1", { waitUntil: "networkidle" });
    result[name] = { oldBars: await page.locator("[data-split-folio], [data-concurrency-folio]").count(), scenes: {} };
    for (const id of ["split-defense", "concurrency", "causal-replay"]) {
      await seek(page, id, 0.5);
      result[name].scenes[id] = await page.evaluate((id) => {
        const root = document.querySelector(`[data-scene='${id}']`);
        return { visibility: getComputedStyle(root).visibility, ariaHidden: root.getAttribute("aria-hidden") };
      }, id);
      await page.screenshot({ path: `output/final-audit/after/late-scenes/${name}-${id}.png` });
    }
    await page.close();
  }
  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await reduced.goto("http://127.0.0.1:3000/?visualTest=1", { waitUntil: "networkidle" });
  result.reduced = {};
  for (const id of ["split-defense", "concurrency", "causal-replay"]) {
    await seek(reduced, id, 0.5);
    result.reduced[id] = await reduced.evaluate(() => [...document.querySelectorAll("[data-scene='split-defense'], [data-scene='concurrency'], [data-scene='causal-replay']")].map((root) => ({ id: root.dataset.scene, visibility: getComputedStyle(root).visibility, ariaHidden: root.getAttribute("aria-hidden"), pointerEvents: getComputedStyle(root).pointerEvents })));
  }
  await reduced.close();
  fs.writeFileSync("output/final-audit/reports/late-scenes-proof.json", JSON.stringify(result, null, 2));
  await browser.close();
})();
