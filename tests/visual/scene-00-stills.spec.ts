import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const outStills = path.join(process.cwd(), "output", "playwright", "scene00_review");

test.describe("Scene 00 Visual QA — 5 Viewports & Checkpoints", () => {
  test("Capture fully registered Scene 00 hero across all viewports", async ({ page }, testInfo) => {
    const vp = testInfo.project.name;
    await mkdir(outStills, { recursive: true });

    await page.goto("/?visualTest=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);

    // Verify key elements exist
    const heroTitle = page.locator("[data-hero-title]");
    await expect(heroTitle).toBeVisible();

    const filmStrip = page.locator("[data-film-strip]");
    await expect(filmStrip).toBeAttached();

    const redResidue = page.locator("[data-action-residue]");
    await expect(redResidue).toBeAttached();

    // Verify navbar has not collided
    const navbar = page.locator("[data-global-navbar]");
    await expect(navbar).toBeVisible();

    // Screenshot fully registered state
    const screenshotPath = path.join(outStills, `scene00_registered_${vp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[STILL SAVED] ${screenshotPath}`);
  });
});

test.describe("Scene 00 Transition Checkpoints @ 1440x900", () => {
  test("Capture 5 release transition checkpoints from ACTION to Scene 00", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1440x900", "Run transition checkpoints on 1440x900");
    await mkdir(outStills, { recursive: true });

    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    // Checkpoint 1: Slate visible & ACTION writing (~3.35s)
    await page.locator("[data-director-slate]").waitFor({ state: "visible", timeout: 4000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outStills, "checkpoint_1_action_midpoint.png") });

    // Checkpoint 2: ACTION completed with red stroke (~3.60s)
    const underline = page.locator("[data-action-underline]");
    await expect
      .poll(
        async () => underline.evaluate((el) => Number.parseFloat(el.getAttribute("stroke-dashoffset") ?? "1")),
        { timeout: 5000 },
      )
      .toBeLessThan(1);
    await page.screenshot({ path: path.join(outStills, "checkpoint_2_action_completed.png") });

    // Checkpoint 3: Ownership transfer / release moment (~3.70s)
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(outStills, "checkpoint_3_ownership_transfer.png") });

    // Checkpoint 4: First Scene 00 exposure (~3.90s)
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outStills, "checkpoint_4_first_scene00_exposure.png") });

    // Checkpoint 5: Fully registered Scene 00 (~4.30s)
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outStills, "checkpoint_5_fully_registered.png") });
    console.log("[ALL 5 TRANSITION CHECKPOINTS SAVED]");
  });
});
