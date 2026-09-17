const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const messages = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  await page.goto("http://127.0.0.1:3000/?visualTest=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  messages.push(`scene-count: ${await page.locator("[data-scene]").count()}`);
  process.stdout.write(JSON.stringify(messages, null, 2));
  await browser.close();
})();
