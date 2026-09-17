import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

const denseStepsDesktop = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  0.85, 0.9, 0.95, 1.0,
] as const;

const denseStepsStandard = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

test.describe("Scene 06 — Split-Payment Defense Visual & Semantic Verification", () => {
  test.describe.configure({ mode: "serial" });

  test("Split Defense: dense checkpoints, correlation window, evidence registration & blocked outcome", async ({
    page,
  }, testInfo) => {
    await prepareVisualPage(page);

    const scene = page.locator("[data-scene='split-defense']");
    await scene.waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(
      process.cwd(),
      "output",
      "playwright",
      "checkpoints",
      testInfo.project.name,
      "split-defense",
    );
    await mkdir(outputDir, { recursive: true });

    const isMasterViewport = testInfo.project.name === "1920x1080";
    const steps = isMasterViewport ? denseStepsDesktop : denseStepsStandard;

    for (const progress of steps) {
      await seekSceneProgress(page, "[data-scene='split-defense']", progress);

      // Verify Scene Header & Folio
      if (progress <= 0.15) {
        const header = await page.locator("[data-split-header]").textContent();
        expect(header).toContain("SPLIT-PAYMENT DEFENSE");
      }

      // Verify First Request Arrival (0.05 - 0.10)
      if (progress >= 0.05) {
        await expect(page.locator("[data-split-receipt='TX-1091']")).toBeVisible();
      }

      // Verify Second Request Arrival (0.15 - 0.22)
      if (progress >= 0.15) {
        await expect(page.locator("[data-split-receipt='TX-1092']")).toBeVisible();
      }

      // Verify Third Request Arrival (0.25 - 0.32)
      if (progress >= 0.25) {
        await expect(page.locator("[data-split-receipt='TX-1093']")).toBeVisible();
      }

      // Verify Temporal Review Aperture Engages (~0.35 - 0.50)
      if (progress >= 0.40) {
        await expect(page.locator("[data-temporal-aperture]")).toBeVisible();
      }

      // Verify Identity Evidence Registration Datums (~0.55 - 0.68)
      if (progress >= 0.55 && progress <= 0.68) {
        await expect(page.locator("[data-registration-datum='merchant']")).toBeVisible();
      }

      // Verify Accounting Aggregation Tally (~0.70 - 0.85)
      if (progress >= 0.70) {
        await expect(page.locator("[data-ledger-tally]")).toBeVisible();
        const tallyText = await page.locator("[data-ledger-tally]").textContent();
        expect(tallyText).toContain("3,000");
      }

      // Verify Correlation Dossier Backing Sheet (~0.80+)
      if (progress >= 0.80) {
        await expect(page.locator("[data-dossier-backing]")).toBeVisible();
      }

      // Verify Hero Stamp 1: ONE ECONOMIC ACTION (~0.88+)
      if (progress >= 0.88) {
        await expect(page.locator("[data-stamp-economic-action]")).toBeVisible();
        const stampText = await page.locator("[data-stamp-economic-action]").textContent();
        expect(stampText).toContain("ONE ECONOMIC ACTION");
      }

      // Verify Hero Stamp 2: BLOCKED (~0.95+)
      if (progress >= 0.95) {
        await expect(page.locator("[data-stamp-blocked]")).toBeVisible();
        const stampText = await page.locator("[data-stamp-blocked]").textContent();
        expect(stampText).toContain("BLOCKED");
      }

      // Capture Checkpoint Screenshot
      const pct = Math.round(progress * 100);
      const filename = `split-defense_${String(pct).padStart(3, "0")}.png`;
      await page.screenshot({
        path: path.join(outputDir, filename),
        fullPage: false,
      });
    }

    // Verify Terminal Historical Hold at 1.00
    await seekSceneProgress(page, "[data-scene='split-defense']", 1.0);
    await expect(page.locator("[data-split-receipt='TX-1091']")).toBeVisible();
    await expect(page.locator("[data-split-receipt='TX-1092']")).toBeVisible();
    await expect(page.locator("[data-split-receipt='TX-1093']")).toBeVisible();
    await expect(page.locator("[data-stamp-economic-action]")).toBeVisible();
    await expect(page.locator("[data-stamp-blocked]")).toBeVisible();

    // Verify Reverse Scrub Causality (1.00 -> 0.00)
    for (const revProgress of [0.90, 0.75, 0.50, 0.25, 0.0]) {
      await seekSceneProgress(page, "[data-scene='split-defense']", revProgress);

      if (revProgress <= 0.80) {
        // Stamps must retract
        const stamp1Opacity = await page
          .locator("[data-stamp-economic-action]")
          .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
        expect(stamp1Opacity).toBeLessThanOrEqual(0.1);
      }

      if (revProgress <= 0.30) {
        // Temporal aperture retracts
        const apertureOpacity = await page
          .locator("[data-temporal-aperture]")
          .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
        expect(apertureOpacity).toBeLessThanOrEqual(0.1);
      }
    }
  });
});
