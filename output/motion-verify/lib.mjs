import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const VIEWPORTS = {
  "1920x1080": [1920, 1080], "1440x900": [1440, 900], "1366x768": [1366, 768],
  "430x932": [430, 932], "390x844": [390, 844],
};

export async function open(vpName, { video } = {}) {
  const [width, height] = VIEWPORTS[vpName];
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: "dark",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3100/?visualTest=1", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(800);
  return { browser, ctx, page };
}

// Resolve absolute scrollY for a track (scene or transition) at progress p.
export async function trackY(page, kind, id, p) {
  return page.evaluate(({ kind, id, p }) => {
    const sel = kind === "scene" ? `[data-track='${id}']` : `[data-transition-track='${id}']`;
    const el = document.querySelector(sel);
    const st = window.ScrollTrigger.getAll().find((t) => t.trigger === el && (kind === "scene" ? !!t.animation : true));
    // fall back to geometry when no anim trigger
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const start = st ? st.start : top;
    const end = st ? st.end : top + rect.height;
    return start + (end - start) * p;
  }, { kind, id, p });
}

export async function scrollTo(page, y, settle = 3) {
  await page.evaluate((y) => { window.scrollTo(0, y); window.dispatchEvent(new Event("scroll")); window.ScrollTrigger.update(); }, y);
  await page.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), settle);
}

export async function seek(page, kind, id, p, settle = 4) {
  const y = await trackY(page, kind, id, p);
  await scrollTo(page, y, settle);
  return y;
}

export async function shot(page, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(dir, name + ".png") });
}
