// Keyboard / native-scroll behaviour through boundaries (the non-Lenis path: ungoverned, absorbed by the transport).
//   node tools/scroll-transport/keyboard.mjs [viewport]
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const vp = process.argv[2] ?? "1440x900";
const [VW, VH] = vp.split("x").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await (await browser.newContext({ viewport: { width: VW, height: VH } })).newPage();
await page.goto(`${BASE}/?intro=0`, { waitUntil: "load", timeout: 120_000 });
await page.waitForFunction(() => window.__kpMotion && document.querySelectorAll("[data-transition-track]").length === 7);
await page.evaluate(async () => { await document.fonts.ready; });
await sleep(1200);

const state = () => page.evaluate(() => ({
  y: Math.round(window.scrollY),
  owner: document.querySelector("[data-cinematic-stage]").dataset.activeScene,
  b: window.__kpMotion.snapshot().filter((s) => s.presented > 0 && s.presented < 1 || s.target > 0 && s.target < 1).map((s) => ({ id: s.id, p: +s.presented.toFixed(4), t: +s.target.toFixed(4), settled: s.settled })),
}));
const start = await page.evaluate(() => { const el = document.querySelectorAll("[data-transition-track]")[1]; const st = window.ScrollTrigger.getAll().find((t) => t.trigger === el); window.scrollTo(0, st.start - 200); return st.start; });
await sleep(900);
await page.evaluate(() => window.__kpMotion.record(true));
const results = [];
for (const key of ["PageDown", "PageDown", "PageDown", "PageDown", "PageDown", "Space", "ArrowDown", "ArrowDown", "End", "Home", "PageDown"]) {
  await page.keyboard.press(key);
  await sleep(900);
  const s = await state();
  results.push({ key, ...s });
  console.log(key.padEnd(10), JSON.stringify(s));
}
const frames = await page.evaluate(() => { window.__kpMotion.record(false); return window.__kpMotion.frames(); });
const v = frames.map((f) => Math.abs(f.velocity));
console.log("frames", frames.length, "max |v|", Math.max(0, ...v).toFixed(3), "max |gap|", Math.max(0, ...frames.map((f) => Math.abs(f.gap))).toFixed(3));
await browser.close();
