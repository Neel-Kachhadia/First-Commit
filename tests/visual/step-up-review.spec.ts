import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

const denseSteps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

test.describe("Scene 04 — Step-Up Clearance Visual & Semantic Verification", () => {
  test.describe.configure({ mode: "serial" });

  test("Step-Up: 11-step dense checkpoints, semantic clearance & reverse scrub", async ({ page }, testInfo) => {
    await prepareVisualPage(page);

    const scene = page.locator("[data-scene='step-up']");
    await scene.waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(
      process.cwd(),
      "output",
      "playwright",
      "checkpoints",
      testInfo.project.name,
      "step-up",
    );
    await mkdir(outputDir, { recursive: true });

    // Step through the dense checkpoints
    for (const progress of denseSteps) {
      await seekSceneProgress(page, "[data-scene='step-up']", progress);

      // Verify Scene 03 → 04 Authority Folio & persistent downstream route
      if (progress <= 0.12) {
        const folio = await page.locator("[data-authority-folio]").textContent();
        expect(folio).toContain("03 // AUTHORITY FOLIO:");
        expect(folio).toContain("SHOPPING / GROCERY / DELIVERY");

        // The route ahead must be visible from the very start
        await expect(page.locator("[data-execution-route]")).toBeVisible();
      }

      // Verify limit interception and held datum (~0.35 - 0.45)
      if (progress >= 0.35 && progress <= 0.45) {
        const barStatus = await page.locator("[data-bar-status]").textContent();
        expect(barStatus).toContain("HELD AT DATUM");

        // Downstream route MUST remain intact while held (STEP-UP ≠ DENY)
        await expect(page.locator("[data-execution-route]")).toBeVisible();
      }

      // Verify full authorization document & HOLD FOR CLEARANCE stamp (~0.55 - 0.75)
      if (progress >= 0.55 && progress <= 0.75) {
        await expect(page.locator("[data-clearance-document]")).toBeVisible();
        const docTitle = await page.locator("#clearance-doc-title").textContent();
        expect(docTitle).toContain("TRAVEL");
        expect(docTitle).toContain("AUTHORIZATION");
        expect(docTitle).toContain("REQUEST");

        await expect(page.locator("[data-hold-stamp]")).toBeVisible();
        const stampText = await page.locator("[data-hold-stamp]").textContent();
        expect(stampText).toContain("HOLD FOR CLEARANCE");

        await expect(page.locator("[data-referral-notice]")).toBeVisible();
        const referralText = await page.locator("[data-referral-notice]").textContent();
        expect(referralText).toContain("REFER FOR APPROVAL");

        // Downstream path still visible during review!
        await expect(page.locator("[data-execution-route]")).toBeVisible();
      }

      // Verify CLEAR ONCE authorization granted (~0.80 - 0.86)
      if (progress >= 0.82 && progress <= 0.87) {
        await expect(page.locator("[data-clear-seal]")).toBeVisible();
        const sealText = await page.locator("[data-clear-seal]").textContent();
        expect(sealText).toContain("CLEARED // SINGLE USE");
        expect(sealText).toContain("TX–1082");

        const barStatus = await page.locator("[data-bar-status]").textContent();
        expect(barStatus).toContain("ONE-TIME CLEARANCE GRANTED");
      }

      // Verify downstream release & resumption (>= 0.95)
      if (progress >= 0.95) {
        await expect(page.locator("[data-active-slip]")).toBeVisible();
        const slipText = await page.locator("[data-active-slip]").textContent();
        expect(slipText).toContain("TRAVEL AGENT");
        expect(slipText).toContain("4,900");

        const footerText = await page.locator("[data-stepup-footer]").textContent();
        expect(footerText).toContain("STEP-UP CLEARANCE // 04");
      }

      await page.screenshot({
        path: path.join(outputDir, `${progress}.png`),
        animations: "allow",
        caret: "hide",
        fullPage: false,
      });
    }

    // Verify Reverse Scrub Determinism: Unwind from 1.0 back to 0.0
    // 1. Back to full review state (progress 0.65)
    await seekSceneProgress(page, "[data-scene='step-up']", 0.65);
    await expect(page.locator("[data-clearance-document]")).toBeVisible();
    await expect(page.locator("[data-hold-stamp]")).toBeVisible();

    // 2. Back to held datum state (progress 0.38)
    await seekSceneProgress(page, "[data-scene='step-up']", 0.38);
    const midStatus = await page.locator("[data-bar-status]").textContent();
    expect(midStatus).toContain("HELD AT DATUM");

    // 3. Back to incoming approach (progress 0.05)
    await seekSceneProgress(page, "[data-scene='step-up']", 0.05);
    const startFolio = await page.locator("[data-authority-folio]").textContent();
    expect(startFolio).toContain("SHOPPING / GROCERY / DELIVERY");
  });
});
