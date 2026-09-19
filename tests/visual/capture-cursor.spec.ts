import { test } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.resolve("output/session-checkpoint/screenshots");
const VIDEO_DIR = path.resolve("output/session-checkpoint/videos");

test.describe("Visual Comparison and Recording Capture", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
  });

  test("Capture Landing Page States and Walkthrough Video", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: VIDEO_DIR,
        size: { width: 1440, height: 900 },
      },
    });
    const page = await context.newPage();

    // 1. Landing Dark Default
    await page.goto("/?intro=0");
    const cursor = page.locator("[data-cursor-root]");
    await cursor.waitFor({ state: "attached" });
    await page.mouse.move(500, 350);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "A_landing_dark_default.png") });

    // 2. Navbar Brand Hover (Registration Halo)
    const brandBtn = page.locator("[data-global-navbar] button").first();
    const brandBox = await brandBtn.boundingBox();
    if (brandBox) {
      await page.mouse.move(brandBox.x + brandBox.width / 2, brandBox.y + brandBox.height / 2);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "C_landing_navbar_hover.png") });
    }

    // 3. Navbar CTA Hover
    const ctaBtn = page.locator("[data-global-navbar] button[class*='primaryAction']").first();
    if (await ctaBtn.count() > 0) {
      const ctaBox = await ctaBtn.boundingBox();
      if (ctaBox) {
        await page.mouse.move(ctaBox.x + ctaBox.width / 2, ctaBox.y + ctaBox.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "D_landing_cta_hover.png") });
      }
    }

    // 4. Click / Active State
    await page.mouse.move(600, 450);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "E_landing_click_active.png") });
    await page.mouse.up();
    await page.waitForTimeout(100);

    // 5. Scrolling Dim State
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(50);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "G_landing_scrolling.png") });

    // 6. Transition Film
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "F_landing_transition_film.png") });

    // 7. Light / Ivory Paper Surface
    await page.evaluate(() => window.scrollTo({ top: 3200, behavior: "instant" }));
    await page.waitForTimeout(400);
    await page.mouse.move(720, 450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "B_landing_ivory_paper.png") });

    // 8. Scene 08 Causal Replay
    await page.evaluate(() => window.scrollTo({ top: 8500, behavior: "instant" }));
    await page.waitForTimeout(400);
    await page.mouse.move(720, 500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "H_landing_scene08.png") });

    // 9. Pointer Leave
    await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseleave")));
    await page.waitForTimeout(150);

    await context.close();
  });

  test("Capture Dashboard States and Walkthrough Video", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: VIDEO_DIR,
        size: { width: 1440, height: 900 },
      },
    });
    const page = await context.newPage();

    await page.goto("/dashboard?mockAuth=1");
    const cursor = page.locator("[data-cursor-root]");
    await cursor.waitFor({ state: "attached" });
    await page.waitForTimeout(400);

    // I. Dashboard dark default
    await page.mouse.move(600, 300);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "I_dashboard_dark_default.png") });

    // J. Sidebar navigation hover
    const navItem = page.locator("a[href*='/agents'], a[href*='/authority']").first();
    if (await navItem.count() > 0) {
      const box = await navItem.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "J_dashboard_sidebar_hover.png") });
      }
    }

    // K. Create mandate / Primary light button hover
    const createBtn = page.locator("button:has-text('Create mandate')").first();
    if (await createBtn.count() > 0) {
      await createBtn.scrollIntoViewIfNeeded();
      const box = await createBtn.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "K_dashboard_create_mandate_hover.png") });
      }
    }

    // L. Search input hover (Native I-beam / text state)
    const searchInput = page.locator("input[placeholder*='Search'], input[type='search']").first();
    if (await searchInput.count() > 0 && (await searchInput.isVisible())) {
      const box = await searchInput.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "L_dashboard_search_input_text.png") });
      }
    }

    // M. Open graph / secondary action hover
    const actionBtn = page.locator("button:has-text('Open graph'), a:has-text('Open graph'), :text('Open graph')").first();
    if (await actionBtn.count() > 0) {
      const box = await actionBtn.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "M_dashboard_open_graph_hover.png") });
      }
    }

    // N. Stop all / Danger action hover
    const stopBtn = page.locator("button:has-text('Stop all')").first();
    if (await stopBtn.count() > 0) {
      const box = await stopBtn.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "N_dashboard_stop_all_hover.png") });
      }
    }

    // O. Non-interactive Card / Metric hover
    const metricCard = page.locator("[class*='card'], [class*='Card']").first();
    if (await metricCard.count() > 0) {
      const box = await metricCard.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "O_dashboard_card_non_interactive.png") });
      }
    }

    await context.close();
  });
});
