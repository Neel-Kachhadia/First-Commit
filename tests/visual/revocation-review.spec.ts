import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

const denseStepsDesktop = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  0.85, 0.9, 0.95, 1.0,
] as const;

const denseStepsStandard = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

test.describe("Scene 05 — Revocation Visual & Semantic Verification", () => {
  test.describe.configure({ mode: "serial" });

  test("Revocation: dense checkpoints, semantic spine withdrawal & history preservation", async ({
    page,
  }, testInfo) => {
    await prepareVisualPage(page);

    const scene = page.locator("[data-scene='revocation']");
    await scene.waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(
      process.cwd(),
      "output",
      "playwright",
      "checkpoints",
      testInfo.project.name,
      "revocation",
    );
    await mkdir(outputDir, { recursive: true });

    const isMasterViewport = testInfo.project.name === "1920x1080";
    const steps = isMasterViewport ? denseStepsDesktop : denseStepsStandard;

    for (const progress of steps) {
      await seekSceneProgress(page, "[data-scene='revocation']", progress);

      // Verify Scene 04 → 05 Authority Folio continuity & Register establishment
      if (progress <= 0.15) {
        const folio = await page.locator("[data-revocation-folio]").textContent();
        expect(folio).toContain("05 // AUTHORITY REGISTER:");
        expect(folio).toContain("SHOPPING / GROCERY / DELIVERY / TRAVEL");
        await expect(page.locator("[data-register-station]")).toBeVisible();
      }

      // Verify All 4 records established in initial valid register
      if (progress >= 0.15 && progress <= 0.25) {
        await expect(page.locator("[data-record='AUTH-0301']")).toBeVisible();
        await expect(page.locator("[data-record='AUTH-0302']")).toBeVisible();
        await expect(page.locator("[data-record='AUTH-0303']")).toBeVisible();
        await expect(page.locator("[data-record='TX-1082']")).toBeVisible();

        const shoppingStatus = await page
          .locator("[data-state-value='AUTH-0301']")
          .textContent();
        expect(shoppingStatus).toBe("IN FORCE");
      }

      // Verify Shopping recall targeting (~0.28 - 0.36)
      if (progress >= 0.28 && progress <= 0.36) {
        await expect(page.locator("[data-recall-aperture]")).toBeVisible();
        const barStatus = await page.locator("[data-revocation-bar-status]").textContent();
        expect(barStatus).toContain("AUTH-0301 (SHOPPING AGENT)");
      }

      // Verify HERO FRAME (~0.45 - 0.50): Spine 50% withdrawn, Shopping failing, siblings wavering, Travel untouched
      if (progress >= 0.45 && progress <= 0.50) {
        await expect(page.locator("[data-source-spine]")).toBeVisible();
        const spineTransform = await page
          .locator("[data-source-spine]")
          .evaluate((el) => window.getComputedStyle(el).transform);
        expect(spineTransform).not.toBe("none");

        // Travel must remain untouched
        const travelStatus = await page
          .locator("[data-state-value='TX-1082']")
          .textContent();
        expect(travelStatus).toBe("ACTIVE");
      }

      // Verify Shopping Revocation & REVOKED stamp (~0.55 - 0.65)
      if (progress >= 0.56 && progress <= 0.65) {
        await expect(page.locator("[data-stamp-revoked]")).toBeVisible();
        const shopStamp = await page.locator("[data-stamp-revoked]").textContent();
        expect(shopStamp).toContain("REVOKED");

        const shoppingStatus = await page
          .locator("[data-state-value='AUTH-0301']")
          .textContent();
        expect(shoppingStatus).toBe("REVOKED");
      }

      // Verify Sibling Misregistration Resolution (~0.72 - 0.85)
      if (progress >= 0.75 && progress <= 0.85) {
        await expect(page.locator("[data-stamp-withdrawn='AUTH-0302']")).toBeVisible();
        await expect(page.locator("[data-stamp-withdrawn='AUTH-0303']")).toBeVisible();

        const grocStatus = await page
          .locator("[data-state-value='AUTH-0302']")
          .textContent();
        const delvStatus = await page
          .locator("[data-state-value='AUTH-0303']")
          .textContent();
        expect(grocStatus).toBe("WITHDRAWN");
        expect(delvStatus).toBe("WITHDRAWN");

        // Verify siblings both show lineage derived from Shopping
        const grocLineage = await page
          .locator("[data-lineage-derived='AUTH-0302']")
          .textContent();
        const delvLineage = await page
          .locator("[data-lineage-derived='AUTH-0303']")
          .textContent();
        expect(grocLineage).toContain("AUTH-0301");
        expect(delvLineage).toContain("AUTH-0301");
      }

      // Verify Travel Selectivity Proof (~0.85 - 1.00)
      if (progress >= 0.85) {
        const travelTransform = await page
          .locator("[data-independent-register='travel']")
          .evaluate((el) => window.getComputedStyle(el).transform);
        expect(travelTransform).not.toBe("none");

        // Travel receives zero revocation stamps
        const stampCount = await page.locator("[data-record='TX-1082'] .stampOverlay").count();
        expect(stampCount).toBe(0);

        // Final historical preservation: ALL 4 records still present
        await expect(page.locator("[data-record='AUTH-0301']")).toBeVisible();
        await expect(page.locator("[data-record='AUTH-0302']")).toBeVisible();
        await expect(page.locator("[data-record='AUTH-0303']")).toBeVisible();
        await expect(page.locator("[data-record='TX-1082']")).toBeVisible();
      }

      await page.screenshot({
        path: path.join(outputDir, `${progress}.png`),
        animations: "allow",
        caret: "hide",
        fullPage: false,
      });
    }

    // Verify Reverse Scrub Determinism
    await seekSceneProgress(page, "[data-scene='revocation']", 0.0);
    const initialShopStatus = await page
      .locator("[data-state-value='AUTH-0301']")
      .textContent();
    expect(initialShopStatus).toBe("IN FORCE");
  });

  test("Event-specific frames capture (1920x1080 master)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Event captures targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const eventDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "events-scene-05");
    await mkdir(eventDir, { recursive: true });

    const eventStates = [
      { name: "01_shopping_recall", progress: 0.32 },
      { name: "02_spine_unlock", progress: 0.38 },
      { name: "03_spine_25_withdrawn", progress: 0.42 },
      { name: "04_spine_50_withdrawn_HERO_FRAME", progress: 0.46 },
      { name: "05_spine_75_withdrawn", progress: 0.50 },
      { name: "06_shopping_revoked", progress: 0.58 },
      { name: "07_child_misregistration_onset", progress: 0.48 },
      { name: "08_child_full_withdrawal", progress: 0.72 },
      { name: "09_travel_registration_advance", progress: 0.82 },
      { name: "10_final_historical_hold", progress: 1.0 },
    ];

    for (const evt of eventStates) {
      await seekSceneProgress(page, "[data-scene='revocation']", evt.progress);
      await page.screenshot({
        path: path.join(eventDir, `${evt.name}.png`),
        animations: "allow",
        caret: "hide",
      });
    }
  });
});
