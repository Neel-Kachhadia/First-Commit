import { chromium } from "@playwright/test";
const vp = process.argv[2] ?? "1440x900"; const mobile = process.argv[3] === "mobile";
const [w, h] = vp.split("x").map(Number);
const dir = `output/motion-verify/s00-full/${vp}-${Date.now()}`;
const b = await chromium.launch({ channel: "chrome", headless: true });
const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: "dark", recordVideo: { dir, size: { width: w, height: h } }, hasTouch: mobile, isMobile: mobile });
const p = await c.newPage();
await p.goto(mobile ? "/?intro=0" : "http://127.0.0.1:3100/?intro=1", { waitUntil: "domcontentloaded" }).catch(()=>{});
if (mobile) await p.goto("http://127.0.0.1:3100/?intro=0", { waitUntil: "networkidle" });
if (!mobile) { await p.waitForSelector("[data-film-intro]", { timeout: 15000 }); await p.waitForFunction(() => !document.querySelector("[data-film-intro]"), null, { timeout: 30000 }); }
await p.waitForTimeout(2500);
await p.mouse.move(w / 2, h / 2);
const total = mobile ? 1200 : 3000;
for (let y = 0; y < total; y += 60) { await p.mouse.wheel(0, 60); await p.waitForTimeout(32); }
await p.waitForTimeout(1500);
for (let y = 0; y < 600; y += 60) { await p.mouse.wheel(0, -60); await p.waitForTimeout(32); }
await p.waitForTimeout(800);
console.log(dir, "scrollY", await p.evaluate(() => Math.round(scrollY)));
await c.close(); await b.close();
