import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareVisualPage } from "./helpers/scene-checkpoints";

test.use({
  viewport: { width: 1920, height: 1080 },
  video: {
    mode: "on",
    size: { width: 1920, height: 1080 },
  },
});

test.describe("Stage A.4 — Continuous Motion & Boundary Continuity", () => {
  test("Boundary A: Mandate -> Decisions Physical Departure and Rule Continuity", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary test targeted to master 1920x1080 viewport");

    await prepareVisualPage(page);

    await page.locator("[data-scene='mandate']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "videos");
    await mkdir(outputDir, { recursive: true });

    // Scroll to Mandate resting hold at Y = 2700 (progress ~0.81)
    await page.evaluate(() => window.scrollTo(0, 2700));
    await page.waitForTimeout(200);

    // Track transforms and opacities across the boundary from Y=2700 to Y=3350
    // (Mandate end is at 3024, Decisions start is at 3024)
    interface FrameMetric {
      scrollY: number;
      mandateProgress: number;
      decisionsProgress: number;
      mandateVisible: boolean;
      decisionsVisible: boolean;
      carrierY: number;
      carrierOpacity: number;
      spliceRuleScaleX: number;
      allowOpacity: number;
      allowScale: number;
    }

    const recordedFrames: FrameMetric[] = [];

    const getFrameMetric = async (): Promise<FrameMetric> => {
      return await page.evaluate(() => {
        const getMatrix = (el: HTMLElement | null) => {
          if (!el) return { ty: 0, scale: 1 };
          const st = window.getComputedStyle(el);
          const tr = st.transform;
          if (!tr || tr === "none") return { ty: 0, scale: 1 };
          const match = tr.match(/^matrix\((.+)\)$/);
          if (match) {
            const vals = match[1].split(", ").map(parseFloat);
            return {
              scale: Math.sqrt(vals[0] * vals[0] + vals[1] * vals[1]),
              ty: vals[5] || 0,
            };
          }
          return { ty: 0, scale: 1 };
        };

        const mandateEl = document.querySelector<HTMLElement>("[data-scene='mandate']");
        const decisionsEl = document.querySelector<HTMLElement>("[data-scene='decisions']");
        const carrierEl = document.querySelector<HTMLElement>("[data-mandate-paper-carrier]");
        const spliceRuleEl = document.querySelector<HTMLElement>("[data-mandate-splice-rule='upper']");
        const allowEl = document.querySelector<HTMLElement>("[data-lane-tag='allow']");

        const carrierMatrix = getMatrix(carrierEl);
        const allowMatrix = getMatrix(allowEl);
        const ruleMatrix = getMatrix(spliceRuleEl);

        const bus = (window as unknown as { __KP_PROGRESS_BUS__?: { get: (s: string) => number } }).__KP_PROGRESS_BUS__;

        return {
          scrollY: window.scrollY,
          mandateProgress: bus ? bus.get("mandate") : 0,
          decisionsProgress: bus ? bus.get("decisions") : 0,
          mandateVisible: mandateEl ? window.getComputedStyle(mandateEl).visibility === "visible" : false,
          decisionsVisible: decisionsEl ? window.getComputedStyle(decisionsEl).visibility === "visible" : false,
          carrierY: carrierMatrix.ty,
          carrierOpacity: carrierEl ? parseFloat(window.getComputedStyle(carrierEl).opacity) : 0,
          spliceRuleScaleX: ruleMatrix.scale,
          allowOpacity: allowEl ? parseFloat(window.getComputedStyle(allowEl).opacity) : 0,
          allowScale: allowMatrix.scale,
        };
      });
    };

    // Forward smooth scrub through the boundary
    console.log("Beginning forward boundary scrub from Y=2700 to Y=3350...");
    for (let targetY = 2700; targetY <= 3350; targetY += 15) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(30);
      const metric = await getFrameMetric();
      recordedFrames.push(metric);
    }

    // Settle hold at Y=3350
    await page.waitForTimeout(300);

    // Reverse smooth scrub through the boundary
    console.log("Beginning reverse boundary scrub from Y=3350 to Y=2700...");
    for (let targetY = 3350; targetY >= 2700; targetY -= 15) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(30);
      const metric = await getFrameMetric();
      recordedFrames.push(metric);
    }

    await page.waitForTimeout(300);

    // Test Constraint 6: rapid scroll stop settles without drift
    await page.evaluate(() => window.scrollTo(0, 2900));
    await page.waitForTimeout(50);
    const stopY1 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(200);
    const stopY2 = await page.evaluate(() => window.scrollY);
    expect(Math.abs(stopY2 - stopY1)).toBeLessThan(5); // Settle is immediate with scrub: true

    // Verify continuity across recordedFrames
    console.log(`Captured ${recordedFrames.length} boundary transition frames.`);

    // Analyze forward frames:
    const forwardFrames = recordedFrames.slice(0, Math.floor(recordedFrames.length / 2));
    
    // 1. Mandate carrier translation should monotonically decrease (moving upward, negative Y)
    // and physical displacement must do 85-90% before opacity drops
    const startCarrier = forwardFrames.find((f) => f.mandateProgress > 0.88);
    const midCarrier = forwardFrames.find((f) => f.mandateProgress > 0.94);
    const exitCarrier = forwardFrames.find((f) => f.mandateProgress > 0.98);

    if (startCarrier && midCarrier) {
      console.log(`Carrier Y at start (${startCarrier.mandateProgress.toFixed(2)}): ${startCarrier.carrierY}`);
      console.log(`Carrier Y at mid (${midCarrier.mandateProgress.toFixed(2)}): ${midCarrier.carrierY}`);
      expect(midCarrier.carrierY).toBeLessThan(startCarrier.carrierY); // moving upward
      expect(midCarrier.carrierOpacity).toBeGreaterThan(0.8); // materially present!
    }

    if (exitCarrier) {
      console.log(`Carrier Y at exit (${exitCarrier.mandateProgress.toFixed(2)}): ${exitCarrier.carrierY}`);
      expect(exitCarrier.carrierY).toBeLessThan(-500); // deeply displaced past top boundary
    }

    // 2. Both scenes are active during the boundary window around 3024
    const boundaryFrames = forwardFrames.filter((f) => f.scrollY >= 2950 && f.scrollY <= 3100);
    const hasOverlap = boundaryFrames.some((f) => f.mandateVisible && f.decisionsVisible);
    console.log(`Boundary overlap detected: ${hasOverlap}`);
    expect(hasOverlap).toBe(true);

    // Save video
    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      const destPath = path.join(outputDir, "boundary-a-mandate-decisions.webm");
      const fs = await import("node:fs/promises");
      await fs.copyFile(videoPath, destPath);
      console.log(`Boundary A review video saved to: ${destPath}`);
    }
  });

  test("Boundary B: Decisions -> Delegation Receipt Filing and Register Handoff", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary test targeted to master 1920x1080 viewport");

    await prepareVisualPage(page);

    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='delegation']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "videos");
    await mkdir(outputDir, { recursive: true });

    // Decisions ends at 5400, Delegation starts at 5400
    // Forward scrub from Y=5000 (Decisions rest) to Y=5800 (Delegation parent registered)
    console.log("Beginning forward boundary scrub from Y=5000 to Y=5800...");
    for (let targetY = 5000; targetY <= 5800; targetY += 15) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(300);

    // Reverse scrub from Y=5800 to Y=5000
    console.log("Beginning reverse boundary scrub from Y=5800 to Y=5000...");
    for (let targetY = 5800; targetY >= 5000; targetY -= 15) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(300);

    // Save video
    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      const destPath = path.join(outputDir, "boundary-b-decisions-delegation.webm");
      const fs = await import("node:fs/promises");
      await fs.copyFile(videoPath, destPath);
      console.log(`Boundary B review video saved to: ${destPath}`);
    }
  });

  test("Boundary C: Delegation -> Step-Up Folio Settlement and Live Route Encounter", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary test targeted to master 1920x1080 viewport");

    await prepareVisualPage(page);

    await page.locator("[data-scene='delegation']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "videos");
    await mkdir(outputDir, { recursive: true });

    // Delegation ends at 9072, Step-Up starts at 9072
    // Forward scrub from Y=8700 (Delegation rest) to Y=9600 (Step-Up arrival)
    console.log("Beginning forward boundary scrub from Y=8700 to Y=9600...");
    for (let targetY = 8700; targetY <= 9600; targetY += 15) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(300);

    // Reverse scrub from Y=9600 to Y=8700
    console.log("Beginning reverse boundary scrub from Y=9600 to Y=8700...");
    for (let targetY = 9600; targetY >= 8700; targetY -= 15) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(300);

    // Save video
    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      const destPath = path.join(outputDir, "boundary-c-delegation-stepup.webm");
      const fs = await import("node:fs/promises");
      await fs.copyFile(videoPath, destPath);
      console.log(`Boundary C review video saved to: ${destPath}`);
    }
  });

  test("Boundary D: Step-Up Single Continuous Document Transformation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary test targeted to master 1920x1080 viewport");

    await prepareVisualPage(page);

    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "videos");
    await mkdir(outputDir, { recursive: true });

    // Step-Up active from Y=9072 to Y=12528
    // Forward scrub through complete transformation sequence
    console.log("Beginning Step-Up full transformation scrub from Y=9100 to Y=12500...");
    for (let targetY = 9100; targetY <= 12500; targetY += 18) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(25);
    }

    await page.waitForTimeout(300);

    // Reverse scrub back through transformation
    console.log("Beginning Step-Up reverse scrub from Y=12500 to Y=9100...");
    for (let targetY = 12500; targetY >= 9100; targetY -= 18) {
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(25);
    }

    await page.waitForTimeout(300);

    // Save video
    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      const destPath = path.join(outputDir, "boundary-d-stepup-transformation.webm");
      const fs = await import("node:fs/promises");
      await fs.copyFile(videoPath, destPath);
      console.log(`Boundary D review video saved to: ${destPath}`);
    }
  });
});
