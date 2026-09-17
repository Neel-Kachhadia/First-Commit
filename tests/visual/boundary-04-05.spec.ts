import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

test.use({
  viewport: { width: 1920, height: 1080 },
  video: {
    mode: "on",
    size: { width: 1920, height: 1080 },
  },
});

test.describe("Scene 04 to Scene 05 Editorial Splice Boundary Review", () => {
  test("Forward and reverse boundary scrub across Step-Up (0.85 - 1.00) and Revocation (0.00 - 0.20): Authority Folio bridge, no double banners", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='revocation']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "boundary_04_05");
    await mkdir(outputDir, { recursive: true });

    const readFolioOpacities = () =>
      page.evaluate(() => {
        const stepUpFolio = document.querySelector<HTMLElement>("[data-authority-folio]");
        const stepUpHeader = document.querySelector<HTMLElement>("[data-stepup-header]");
        const revFolio = document.querySelector<HTMLElement>("[data-revocation-folio]");
        const revHeader = document.querySelector<HTMLElement>("[data-revocation-header]");
        const opacityOf = (el: HTMLElement | null) => (el ? parseFloat(window.getComputedStyle(el).opacity) : 0);
        return {
          stepUpFolio: opacityOf(stepUpFolio),
          stepUpHeader: opacityOf(stepUpHeader),
          revFolio: opacityOf(revFolio),
          revHeader: opacityOf(revHeader),
        };
      });

    // =========================================================================
    // 1. FORWARD PROGRESSION ACROSS SCENE 04 -> 05 BOUNDARY
    // =========================================================================

    // Step-Up terminal dense steps: travel artifact exits, folio/header begin cross-fade out
    const s04TerminalSteps = [0.85, 0.90, 0.94, 0.96, 0.98, 1.00];
    for (const p of s04TerminalSteps) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      await page.waitForTimeout(60);

      const op = await readFolioOpacities();
      // Hard invariant: Step-Up folio/header and Revocation folio/header must never
      // BOTH render at strong opacity at the same time (no stacked banners).
      expect(op.stepUpFolio + op.revFolio).toBeLessThanOrEqual(1.15);
      expect(op.stepUpHeader + op.revHeader).toBeLessThanOrEqual(1.15);

      await page.screenshot({ path: path.join(outputDir, `01_stepup_${p.toFixed(2)}.png`) });
    }

    // Revocation handoff dense steps: register takes over, Step-Up folio/header fully gone
    const s05HandoffSteps = [0.00, 0.02, 0.04, 0.06, 0.08, 0.10, 0.15, 0.20];
    for (const p of s05HandoffSteps) {
      await seekSceneProgress(page, "[data-scene='revocation']", p);
      await page.waitForTimeout(60);

      expect(await page.locator("[data-scene='revocation']").isVisible()).toBe(true);
      expect(await page.locator("[data-revocation-folio]").isVisible()).toBe(true);
      expect(await page.locator("[data-register-station]").isVisible()).toBe(true);

      // Revocation folio must carry forward the Step-Up authority context into the register
      const folioText = await page.locator("[data-revocation-folio]").textContent();
      expect(folioText).toContain("05 // AUTHORITY REGISTER:");
      expect(folioText).toContain("SHOPPING / GROCERY / DELIVERY / TRAVEL");

      const op = await readFolioOpacities();
      expect(op.stepUpFolio + op.revFolio).toBeLessThanOrEqual(1.15);
      expect(op.stepUpHeader + op.revHeader).toBeLessThanOrEqual(1.15);

      await page.screenshot({ path: path.join(outputDir, `02_revocation_${p.toFixed(2)}.png`) });
    }

    // At Revocation 0.20, Step-Up must be fully out of the frame (hard ownership transfer complete)
    const stepUpGone = await page.locator("[data-scene='step-up']").evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return cs.visibility === "hidden";
    });
    expect(stepUpGone).toBe(true);

    // =========================================================================
    // 2. REVERSE SCRUB ACROSS BOUNDARY
    // =========================================================================
    for (const p of [0.15, 0.10, 0.06, 0.02, 0.00]) {
      await seekSceneProgress(page, "[data-scene='revocation']", p);
      await page.waitForTimeout(40);
    }

    for (const p of [1.00, 0.98, 0.96, 0.94, 0.90]) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      await page.waitForTimeout(40);
      const op = await readFolioOpacities();
      expect(op.stepUpFolio + op.revFolio).toBeLessThanOrEqual(1.15);
    }

    // Verify Step-Up folio/header fully restored after reverse scrub
    await seekSceneProgress(page, "[data-scene='step-up']", 0.85);
    const restoredOp = await readFolioOpacities();
    expect(restoredOp.stepUpFolio).toBeGreaterThan(0.95);
    expect(restoredOp.stepUpHeader).toBeGreaterThan(0.95);
    await page.screenshot({ path: path.join(outputDir, "03_stepup_0.85_restored_after_reverse.png") });

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_04_to_05_boundary_splice.webm");
    }
  });
});
