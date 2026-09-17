import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

const denseSteps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

test.describe("Scene 03 — Delegation Visual & Semantic Verification", () => {
  test.describe.configure({ mode: "serial" });

  test("Delegation: 11-step dense checkpoints & semantic accounting", async ({ page }, testInfo) => {
    await prepareVisualPage(page);

    const scene = page.locator("[data-scene='delegation']");
    await scene.waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(
      process.cwd(),
      "output",
      "playwright",
      "checkpoints",
      testInfo.project.name,
      "delegation",
    );
    await mkdir(outputDir, { recursive: true });

    // Step through the dense checkpoints
    for (const progress of denseSteps) {
      await seekSceneProgress(page, "[data-scene='delegation']", progress);

      // Verify accounting semantics at key beats
      if (progress <= 0.15) {
        const alloc = await page.locator("[data-accounting-allocated]").textContent();
        const rem = await page.locator("[data-accounting-remaining]").textContent();
        expect(alloc?.trim()).toBe("₹0");
        expect(rem?.trim()).toBe("₹4,000");
      } else if (progress >= 0.32 && progress <= 0.45) {
        const alloc = await page.locator("[data-accounting-allocated]").textContent();
        const rem = await page.locator("[data-accounting-remaining]").textContent();
        expect(alloc?.trim()).toBe("₹1,500");
        expect(rem?.trim()).toBe("₹2,500");
      } else if (progress >= 0.55) {
        const alloc = await page.locator("[data-accounting-allocated]").textContent();
        const rem = await page.locator("[data-accounting-remaining]").textContent();
        expect(alloc?.trim()).toBe("₹2,500");
        expect(rem?.trim()).toBe("₹1,500");
      }

      // Verify Level 2 sealed boundary presence at terminal beats
      if (progress >= 0.8) {
        await expect(page.locator("[data-sealed-boundary]")).toBeVisible();
        const sealedText = await page.locator("[data-sealed-boundary]").textContent();
        expect(sealedText).toContain("2 LEVELS MAX");
        expect(sealedText).toContain("NO FURTHER DELEGATION");
      }

      await page.screenshot({
        path: path.join(outputDir, `${progress}.png`),
        animations: "allow",
        caret: "hide",
        fullPage: false,
      });
    }

    // Verify reverse scrub determinism: unwind from 1.0 back to 0.0
    await seekSceneProgress(page, "[data-scene='delegation']", 0.4);
    const midAlloc = await page.locator("[data-accounting-allocated]").textContent();
    expect(midAlloc?.trim()).toBe("₹1,500");

    await seekSceneProgress(page, "[data-scene='delegation']", 0.05);
    const startAlloc = await page.locator("[data-accounting-allocated]").textContent();
    const startRem = await page.locator("[data-accounting-remaining]").textContent();
    expect(startAlloc?.trim()).toBe("₹0");
    expect(startRem?.trim()).toBe("₹4,000");
  });
});
