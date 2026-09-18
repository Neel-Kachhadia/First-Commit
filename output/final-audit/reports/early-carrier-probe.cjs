const { chromium } = require("playwright");
const fs = require("node:fs/promises");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://127.0.0.1:3000/?visualTest=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.ScrollTrigger?.getAll?.().length > 0);

  const seek = async (track, progress) => {
    const y = await page.evaluate(({ track, progress }) => {
      const el = document.querySelector(`[data-track='${track}']`);
      const trigger = window.ScrollTrigger.getAll().find((item) => item.trigger === el && item.vars.scrub);
      return Math.round(trigger.start + (trigger.end - trigger.start) * progress);
    }, { track, progress });
    await page.evaluate((target) => window.scrollTo(0, target), y);
    await page.waitForTimeout(100);
  };

  const samples = [];
  for (const progress of [0.96, 0.98, 0.99, 0.995, 1]) {
    await seek("decisions", progress);
    samples.push(await page.evaluate((progress) => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, opacity: Number(getComputedStyle(el).opacity) };
      };
      const out = rect("[data-decision-evidence-outgoing]");
      const incoming = rect("[data-decision-evidence-incoming]");
      return {
        progress,
        out,
        incoming,
        delta: out && incoming ? {
          x: Math.abs(out.x - incoming.x),
          y: Math.abs(out.y - incoming.y),
          width: Math.abs(out.width - incoming.width),
          height: Math.abs(out.height - incoming.height),
        } : null,
      };
    }, progress));
  }

  await seek("decisions", 0.99);
  await page.screenshot({ path: "output/final-audit/after/02-03-physical-evidence-handoff.png" });
  await seek("delegation", 0.04);
  await page.screenshot({ path: "output/final-audit/after/03-delegation-established-no-bars.png" });
  await seek("delegation", 0.99);
  await page.screenshot({ path: "output/final-audit/after/03-04-derived-pass-carrier.png" });

  const zeroCount = await page.evaluate(() => ({
    decisionRegister: document.querySelectorAll("[data-decision-register], [data-decision-register-outgoing]").length,
    authorityFolio: document.querySelectorAll("[data-authority-folio-outgoing]").length,
  }));

  await fs.writeFile(
    "output/final-audit/reports/early-carrier-probe.json",
    JSON.stringify({ samples, zeroCount }, null, 2),
  );
  await browser.close();
})();
