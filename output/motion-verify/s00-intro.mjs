import { chromium } from "@playwright/test";
import fs from "node:fs";
const vp = process.argv[2] ?? "1440x900";
const [w, h] = vp.split("x").map(Number);
const dir = `output/motion-verify/s00-intro/${vp}-${Date.now()}`;

const b = await chromium.launch({ channel: "chrome", headless: true });
const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: "dark", recordVideo: { dir, size: { width: w, height: h } } });
const p = await c.newPage();
const t0 = Date.now();
await p.goto("http://127.0.0.1:3100/?intro=1", { waitUntil: "domcontentloaded" });
await p.waitForSelector("[data-film-intro]", { timeout: 15000 }); const tShow = Date.now() - t0; console.log("intro shown at", tShow); await p.waitForFunction(() => !document.querySelector("[data-film-intro]"), null, { timeout: 30000 });
const tGone = Date.now() - t0;
await p.waitForTimeout(2500);
console.log("intro gone at ~", tGone, "ms");
await c.close(); await b.close();
