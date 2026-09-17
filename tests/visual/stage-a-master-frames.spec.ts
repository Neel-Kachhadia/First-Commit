import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { seekSceneProgress } from "./helpers/scene-checkpoints";

test.describe("Stage A.3 — 10 Static Master Frames Gate", () => {
  const masterFrames = [
    { id: "FRAME_01", name: "prologue_terminal", scene: "[data-scene='prologue']", progress: 0.5 },
    { id: "FRAME_02", name: "permission_takeover", scene: "[data-scene='prologue']", progress: 1.0 },
    { id: "FRAME_03", name: "mandate_scope", scene: "[data-scene='mandate']", progress: 0.25 },
    { id: "FRAME_04", name: "mandate_full_contract_hold", scene: "[data-scene='mandate']", progress: 0.75 },
    { id: "FRAME_05", name: "decisions_3lane_containment", scene: "[data-scene='decisions']", progress: 0.5 },
    { id: "FRAME_06", name: "decisions_settled_state", scene: "[data-scene='decisions']", progress: 0.75 },
    { id: "FRAME_07", name: "delegation_sibling_derivation", scene: "[data-scene='delegation']", progress: 0.5 },
    { id: "FRAME_08", name: "delegation_level2_compact_hold", scene: "[data-scene='delegation']", progress: 0.8 },
    { id: "FRAME_09", name: "stepup_datum_arrest", scene: "[data-scene='step-up']", progress: 0.5 },
    { id: "FRAME_10", name: "stepup_clearance_unrolled_stamped", scene: "[data-scene='step-up']", progress: 0.84 },
  ];

  test("Capture 10 Master Frames in 1920x1080", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "1920x1080 master viewport run");
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    console.log(`[MASTER FRAMES 1920x1080] innerWidth: ${vp.width}, innerHeight: ${vp.height}`);
    expect(vp.width).toBe(1920);
    expect(vp.height).toBe(1080);

    const outDir = path.join(process.cwd(), "output", "playwright", "master-frames", "1920x1080");
    await mkdir(outDir, { recursive: true });

    for (const frame of masterFrames) {
      await seekSceneProgress(page, frame.scene, frame.progress);
      const filePath = path.join(outDir, `${frame.id}_${frame.name}.png`);
      await page.screenshot({ path: filePath });
      console.log(`Captured ${frame.id}: ${filePath}`);
    }
  });

  test("Capture 10 Master Frames in 1366x768 (Compact Desktop Containment Check)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1366x768", "1366x768 compact desktop viewport run");
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    console.log(`[MASTER FRAMES 1366x768] innerWidth: ${vp.width}, innerHeight: ${vp.height}`);
    expect(vp.width).toBe(1366);
    expect(vp.height).toBe(768);

    const outDir = path.join(process.cwd(), "output", "playwright", "master-frames", "1366x768");
    await mkdir(outDir, { recursive: true });

    for (const frame of masterFrames) {
      await seekSceneProgress(page, frame.scene, frame.progress);
      const filePath = path.join(outDir, `${frame.id}_${frame.name}.png`);
      await page.screenshot({ path: filePath });
      console.log(`Captured 1366x768 ${frame.id}: ${filePath}`);
    }

    // Explicit Frame 5 containment assertion in 1366x768
    await seekSceneProgress(page, "[data-scene='decisions']", 0.5);
    const lanesMetrics = await page.evaluate(() => {
      const allow = document.querySelector("[data-lane='allow']")?.getBoundingClientRect();
      const deny = document.querySelector("[data-lane='deny']")?.getBoundingClientRect();
      const footer = document.querySelector("[data-decisions-footer]")?.getBoundingClientRect();
      return {
        viewportHeight: window.innerHeight,
        allowTop: allow?.top ?? 0,
        denyBottom: deny?.bottom ?? 0,
        footerBottom: footer?.bottom ?? 0,
      };
    });

    console.log("[1366x768 DECISIONS METRICS]", JSON.stringify(lanesMetrics, null, 2));
    expect(lanesMetrics.allowTop).toBeGreaterThanOrEqual(0);
    expect(lanesMetrics.denyBottom).toBeLessThanOrEqual(lanesMetrics.viewportHeight);
    expect(lanesMetrics.footerBottom).toBeLessThanOrEqual(lanesMetrics.viewportHeight);
  });
});
