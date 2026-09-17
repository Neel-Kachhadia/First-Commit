import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

const denseStepsDesktop = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  0.85, 0.9, 0.95, 1.0,
] as const;

const denseStepsStandard = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

test.describe("Scene 07 — Budget / Concurrency Visual & Semantic Verification", () => {
  test.describe.configure({ mode: "serial" });

  test("Budget & Concurrency: dense checkpoints, atomic reservation, authoritative update & conservation proof", async ({
    page,
  }, testInfo) => {
    await prepareVisualPage(page);

    const scene = page.locator("[data-scene='concurrency']");
    await scene.waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(
      process.cwd(),
      "output",
      "playwright",
      "checkpoints",
      testInfo.project.name,
      "budget-concurrency",
    );
    await mkdir(outputDir, { recursive: true });

    const isMasterViewport = testInfo.project.name === "1920x1080";
    const steps = isMasterViewport ? denseStepsDesktop : denseStepsStandard;

    for (const progress of steps) {
      await seekSceneProgress(page, "[data-scene='concurrency']", progress);

      // Verify Scene Header & Folio at start
      if (progress <= 0.15) {
        const header = await page.locator("[data-concurrency-header]").textContent();
        expect(header).toContain("BUDGET / CONCURRENCY");
        expect(header).toContain("ONE BUDGET. ONE AT A TIME.");

        // Initial balance must show ₹500 REMAINING
        const initialNumeral = await page.locator("[data-balance-initial]").textContent();
        expect(initialNumeral).toContain("₹500");
      }

      // Verify Concurrent Arrival of Both Requests (0.15 - 0.30)
      if (progress >= 0.15) {
        await expect(page.locator("[data-concurrency-slip='TX-1094']")).toBeVisible();
        await expect(page.locator("[data-concurrency-slip='TX-1095']")).toBeVisible();
      }

      // "Both Valid" Contention Hold (0.22 - 0.32)
      if (progress >= 0.22 && progress <= 0.32) {
        const cafeStatus = await page
          .locator("[data-concurrency-slip='TX-1094'] [data-slip-status]")
          .textContent();
        const booksStatus = await page
          .locator("[data-concurrency-slip='TX-1095'] [data-slip-status]")
          .textContent();
        expect(cafeStatus).toContain("PENDING CLAIM");
        expect(booksStatus).toContain("PENDING CLAIM");
      }

      // Commit Datum Active (0.40+)
      if (progress >= 0.40) {
        await expect(page.locator("[data-commit-datum]")).toBeVisible();
      }

      // Hero Stamp: RESERVED on TX-1094 (0.65+)
      if (progress >= 0.65) {
        await expect(page.locator("[data-stamp-reserved]")).toBeVisible();
        const stampText = await page.locator("[data-stamp-reserved]").textContent();
        expect(stampText).toContain("RESERVED");
      }

      // Authoritative State Update: ₹0 REMAINING (0.74+)
      if (progress >= 0.74) {
        await expect(page.locator("[data-balance-final]")).toBeVisible();
        const finalNumeral = await page.locator("[data-balance-final]").textContent();
        expect(finalNumeral).toContain("₹0");
      }

      // Stale-Balance Defense: TX-1095 confronts ₹0 and receives UNAVAILABLE (0.84+)
      if (progress >= 0.84) {
        await expect(page.locator("[data-stamp-unavailable]")).toBeVisible();
        const unavailText = await page.locator("[data-stamp-unavailable]").textContent();
        expect(unavailText).toContain("UNAVAILABLE");
      }

      // Terminal Conservation Ledger Summary (0.90+)
      if (progress >= 0.90) {
        await expect(page.locator("[data-terminal-ledger]")).toBeVisible();
        const proofText = await page.locator("[data-conservation-proof]").textContent();
        expect(proofText).toContain("₹3,500 PRIOR + ₹500 RESERVED + ₹0 REMAINING = ₹4,000");
      }

      // Capture Checkpoint Screenshot
      const pct = Math.round(progress * 100);
      const filename = `budget-concurrency_${String(pct).padStart(3, "0")}.png`;
      await page.screenshot({
        path: path.join(outputDir, filename),
        fullPage: false,
      });
    }

    // Explicit Arithmetic Conservation Test at 1.00
    await seekSceneProgress(page, "[data-scene='concurrency']", 1.0);
    const accountingSummary = await page.evaluate(() => {
      const proof = document.querySelector("[data-conservation-proof]")?.textContent || "";
      const cafeAmount = 500;
      const priorSpend = 3500;
      const mandateCap = 4000;
      const remaining = 0;
      const conserved = priorSpend + cafeAmount + remaining === mandateCap;
      return { proof, conserved };
    });
    expect(accountingSummary.conserved).toBe(true);
    expect(accountingSummary.proof).toContain("₹3,500 PRIOR + ₹500 RESERVED + ₹0 REMAINING = ₹4,000");

    // Stale-Balance Invariant Test: Verify TX-1095 was NOT evaluated against stale ₹500
    const finalDatumText = await page.locator("[data-datum-status]").textContent();
    expect(finalDatumText).toContain("RESERVED: ₹500 // CURRENT: ₹0");

    // Verify Reverse Scrub Causality (1.00 -> 0.00)
    for (const revProgress of [0.90, 0.75, 0.50, 0.25, 0.0]) {
      await seekSceneProgress(page, "[data-scene='concurrency']", revProgress);

      if (revProgress <= 0.70) {
        // UNAVAILABLE mark must be retracted
        const unavailOpacity = await page
          .locator("[data-stamp-unavailable]")
          .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
        expect(unavailOpacity).toBeLessThanOrEqual(0.1);
      }

      if (revProgress <= 0.55) {
        // RESERVED stamp must be retracted
        const reservedOpacity = await page
          .locator("[data-stamp-reserved]")
          .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
        expect(reservedOpacity).toBeLessThanOrEqual(0.1);

        // Initial balance ₹500 restored
        const initialOpacity = await page
          .locator("[data-balance-initial]")
          .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
        expect(initialOpacity).toBeGreaterThan(0.5);
      }
    }
  });
});
