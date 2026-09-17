import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { seekSceneProgress } from "./helpers/scene-checkpoints";

test.describe("Stage A.3 — Step B: Decisions Migration & Viewport Fit Verification", () => {
  test("1. Decisions 3-lane containment & boundary in 1920x1080", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await page.goto("/?visualTest=1&migration=B", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    console.log(`[REAL VIEWPORT 1920x1080] innerWidth: ${vp.width}, innerHeight: ${vp.height}`);
    expect(vp.width).toBe(1920);
    expect(vp.height).toBe(1080);

    const outDir = path.join(process.cwd(), "output", "playwright", "step-b");
    await mkdir(outDir, { recursive: true });

    // Invariant: No pin-spacers exist
    const pinSpacers = await page.evaluate(() => document.querySelectorAll(".pin-spacer").length);
    expect(pinSpacers).toBe(0);

    // Boundary: Mandate 1.00
    await seekSceneProgress(page, "[data-scene='mandate']", 1.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_mandate_100_departure.png") });

    // Decisions 0.00: Registration bridge
    await seekSceneProgress(page, "[data-scene='decisions']", 0.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_decisions_000_threshold_entry.png") });

    // Decisions 0.25: Contracted into operational lanes
    await seekSceneProgress(page, "[data-scene='decisions']", 0.25);
    await page.screenshot({ path: path.join(outDir, "1920x1080_decisions_025_lanes_settled.png") });

    // Decisions 0.50: Evaluation in progress
    await seekSceneProgress(page, "[data-scene='decisions']", 0.50);
    await page.screenshot({ path: path.join(outDir, "1920x1080_decisions_050_evaluating.png") });

    // Decisions 0.75: Full 3-lane operational state (ALLOW, STEP-UP, DENY)
    await seekSceneProgress(page, "[data-scene='decisions']", 0.75);
    await page.screenshot({ path: path.join(outDir, "1920x1080_decisions_075_full_hold.png") });

    // GATE C ASSERTION: ALLOW, STEP-UP, DENY all fit inside the viewport!
    const lanesMetrics = await page.evaluate(() => {
      const allowLane = document.querySelector("[data-lane-tag='allow']");
      const stepUpLane = document.querySelector("[data-lane-tag='stepup']");
      const denyLane = document.querySelector("[data-lane-tag='deny']");
      const footer = document.querySelector("[data-decisions-footer]");
      const stage = document.querySelector("[data-cinematic-stage]");

      return {
        allowRect: allowLane?.getBoundingClientRect(),
        stepUpRect: stepUpLane?.getBoundingClientRect(),
        denyRect: denyLane?.getBoundingClientRect(),
        footerRect: footer?.getBoundingClientRect(),
        stageRect: stage?.getBoundingClientRect(),
        viewportHeight: window.innerHeight,
      };
    });

    console.log("[GATE C 1920x1080 METRICS]", JSON.stringify(lanesMetrics, null, 2));

    expect(lanesMetrics.allowRect).toBeTruthy();
    expect(lanesMetrics.stepUpRect).toBeTruthy();
    expect(lanesMetrics.denyRect).toBeTruthy();
    expect(lanesMetrics.footerRect).toBeTruthy();

    // Critical assertion: DENY is inside viewport (not pushed below stage)
    expect(lanesMetrics.denyRect!.bottom).toBeLessThanOrEqual(lanesMetrics.viewportHeight);
    expect(lanesMetrics.footerRect!.bottom).toBeLessThanOrEqual(lanesMetrics.viewportHeight);

    // Reverse scrub check: from Decisions 0.75 back to 0.0, Mandate 0.5, Prologue 0.0
    await seekSceneProgress(page, "[data-scene='decisions']", 0.0);
    await seekSceneProgress(page, "[data-scene='mandate']", 0.5);
    await seekSceneProgress(page, "[data-scene='prologue']", 0.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_reverse_back_to_prologue.png") });
  });

  test("2. Decisions 3-lane containment in 1366x768 (Constraint 12)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Runs in this worker with explicit viewport resize");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/?visualTest=1&migration=B", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    console.log(`[REAL VIEWPORT 1366x768] innerWidth: ${vp.width}, innerHeight: ${vp.height}`);
    expect(vp.width).toBe(1366);
    expect(vp.height).toBe(768);

    const outDir = path.join(process.cwd(), "output", "playwright", "step-b");

    // Seek to 0.75
    await seekSceneProgress(page, "[data-scene='decisions']", 0.75);
    await page.screenshot({ path: path.join(outDir, "1366x768_decisions_075_containment.png") });

    // GATE C ASSERTION in 1366x768:
    const metrics768 = await page.evaluate(() => {
      const allowLane = document.querySelector("[data-lane-tag='allow']");
      const stepUpLane = document.querySelector("[data-lane-tag='stepup']");
      const denyLane = document.querySelector("[data-lane-tag='deny']");
      const footer = document.querySelector("[data-decisions-footer]");

      return {
        allowRect: allowLane?.getBoundingClientRect(),
        stepUpRect: stepUpLane?.getBoundingClientRect(),
        denyRect: denyLane?.getBoundingClientRect(),
        footerRect: footer?.getBoundingClientRect(),
        viewportHeight: window.innerHeight,
      };
    });

    console.log("[GATE C 1366x768 METRICS]", JSON.stringify(metrics768, null, 2));

    expect(metrics768.allowRect).toBeTruthy();
    expect(metrics768.stepUpRect).toBeTruthy();
    expect(metrics768.denyRect).toBeTruthy();
    expect(metrics768.footerRect).toBeTruthy();

    // CRITICAL: Even at 768px height, DENY and footer must NEVER be pushed below viewport
    expect(metrics768.denyRect!.bottom).toBeLessThanOrEqual(768);
    expect(metrics768.footerRect!.bottom).toBeLessThanOrEqual(768);
  });
});
