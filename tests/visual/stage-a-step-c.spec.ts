import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { seekSceneProgress } from "./helpers/scene-checkpoints";

test.describe("Stage A.3 — Step C: Delegation Migration & Level-2 Refinement Verification", () => {
  test("1. Delegation Level-2 compact bounds & hierarchy in 1920x1080", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await page.goto("/?visualTest=1&migration=C", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    console.log(`[REAL VIEWPORT 1920x1080] innerWidth: ${vp.width}, innerHeight: ${vp.height}`);
    expect(vp.width).toBe(1920);
    expect(vp.height).toBe(1080);

    const outDir = path.join(process.cwd(), "output", "playwright", "step-c");
    await mkdir(outDir, { recursive: true });

    // Invariant: Zero pin spacers
    const pinSpacers = await page.evaluate(() => document.querySelectorAll(".pin-spacer").length);
    expect(pinSpacers).toBe(0);

    // Boundary: Decisions 1.00
    await seekSceneProgress(page, "[data-scene='decisions']", 1.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_decisions_100.png") });

    // Delegation 0.00: Decision Register continuity
    await seekSceneProgress(page, "[data-scene='delegation']", 0.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_delegation_000_entry.png") });

    // Delegation 0.25: Hero Grocery derivation
    await seekSceneProgress(page, "[data-scene='delegation']", 0.25);
    await page.screenshot({ path: path.join(outDir, "1920x1080_delegation_025_grocery_derivation.png") });

    // Delegation 0.50: Sibling delivery derivation
    await seekSceneProgress(page, "[data-scene='delegation']", 0.50);
    await page.screenshot({ path: path.join(outDir, "1920x1080_delegation_050_delivery_derivation.png") });

    // Delegation 0.75: Level-2 Secondary Delegation (AUTH-0304)
    await seekSceneProgress(page, "[data-scene='delegation']", 0.75);
    await page.screenshot({ path: path.join(outDir, "1920x1080_delegation_075_level2_derivation.png") });

    // Delegation 0.95: Full resting portfolio hold with sealed seam
    await seekSceneProgress(page, "[data-scene='delegation']", 0.95);
    await page.screenshot({ path: path.join(outDir, "1920x1080_delegation_095_sealed_boundary_hold.png") });

    // GATE D ASSERTIONS: Level-2 downstream pass geometry & depth refusal
    const passMetrics = await page.evaluate(() => {
      const parent = document.querySelector("[data-delegation-parent]");
      const grocery = document.querySelector("[data-delegation-grocery]");
      const downstream = document.querySelector("[data-delegation-downstream]");
      const sealed = document.querySelector("[data-sealed-boundary]");

      const pRect = parent?.getBoundingClientRect();
      const gRect = grocery?.getBoundingClientRect();
      const dRect = downstream?.getBoundingClientRect();

      const sealedStyle = sealed ? window.getComputedStyle(sealed) : null;

      return {
        parentWidth: pRect?.width,
        groceryWidth: gRect?.width,
        downstreamWidth: dRect?.width,
        downstreamHeight: dRect?.height,
        downstreamBottom: dRect?.bottom,
        sealedOpacity: sealedStyle ? parseFloat(sealedStyle.opacity) : 0,
        sealedText: sealed?.textContent?.trim(),
        viewportHeight: window.innerHeight,
      };
    });

    console.log("[GATE D METRICS]", JSON.stringify(passMetrics, null, 2));

    // Downstream pass must be subordinate in width to parent and grocery
    expect(passMetrics.downstreamWidth).toBeLessThan(passMetrics.parentWidth!);
    expect(passMetrics.downstreamWidth).toBeLessThanOrEqual(285);
    expect(passMetrics.downstreamWidth).toBeGreaterThanOrEqual(220);

    // Height must be compact (NOT a giant empty white sheet)
    // The previous pass was > 360px due to giant empty spacer; compact pass is ~170-240px
    expect(passMetrics.downstreamHeight).toBeLessThan(260);

    // Must fit inside viewport comfortably
    expect(passMetrics.downstreamBottom).toBeLessThanOrEqual(1080);

    // Depth refusal assertion: Seam sealed and visible
    expect(passMetrics.sealedOpacity).toBe(1);
    expect(passMetrics.sealedText).toContain("2 LEVELS MAX // NO FURTHER DELEGATION");

    // Reverse scrub test: Delegation 0.95 -> 0.0 -> Decisions 0.5 -> Mandate 0.5 -> Prologue 0.0
    await seekSceneProgress(page, "[data-scene='delegation']", 0.0);
    await seekSceneProgress(page, "[data-scene='decisions']", 0.5);
    await seekSceneProgress(page, "[data-scene='mandate']", 0.5);
    await seekSceneProgress(page, "[data-scene='prologue']", 0.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_reverse_back_to_prologue.png") });
  });
});
