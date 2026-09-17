import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { seekSceneProgress } from "./helpers/scene-checkpoints";

test.describe("Stage A.3 — Step D: Step-Up Migration & Full Film Structural Invariants", () => {
  test("1. Step-Up progression, boundary handoff, and structural invariants in 1920x1080", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    // Load without migration param to mount all five migrated scenes in canonical persistent stage
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    console.log(`[REAL VIEWPORT 1920x1080] innerWidth: ${vp.width}, innerHeight: ${vp.height}, scrollHeight: ${vp.scrollHeight}`);
    expect(vp.width).toBe(1920);
    expect(vp.height).toBe(1080);
    // scrollTrack must provide substantial scroll height
    expect(vp.scrollHeight).toBeGreaterThan(vp.height * 5);

    const outDir = path.join(process.cwd(), "output", "playwright", "step-d");
    await mkdir(outDir, { recursive: true });

    // =========================================================================
    // CONSTRAINT 19: STRUCTURAL INVARIANTS ACROSS ENTIRE PAGE
    // =========================================================================
    const structuralChecks = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
      const stageStyle = stage ? window.getComputedStyle(stage) : null;
      const stageRect = stage?.getBoundingClientRect();

      const scenes = [
        document.querySelector<HTMLElement>("[data-scene='prologue']"),
        document.querySelector<HTMLElement>("[data-scene='mandate']"),
        document.querySelector<HTMLElement>("[data-scene='decisions']"),
        document.querySelector<HTMLElement>("[data-scene='delegation']"),
        document.querySelector<HTMLElement>("[data-scene='step-up']"),
      ];

      const pinSpacers = document.querySelectorAll(".pin-spacer").length;

      const sceneStyles = scenes.map((s) => {
        if (!s) return null;
        const comp = window.getComputedStyle(s);
        return {
          scene: s.getAttribute("data-scene"),
          position: comp.position,
          marginTop: comp.marginTop,
          top: comp.top,
          left: comp.left,
          width: comp.width,
          height: comp.height,
        };
      });

      return {
        stagePosition: stageStyle?.position,
        stageInsetTop: stageRect?.top,
        stageInsetLeft: stageRect?.left,
        stageWidth: stageRect?.width,
        stageHeight: stageRect?.height,
        pinSpacers,
        sceneStyles,
      };
    });

    console.log("[STRUCTURAL CHECKS]", JSON.stringify(structuralChecks, null, 2));

    // 1. cinematicStage is position: fixed with inset: 0
    expect(structuralChecks.stagePosition).toBe("fixed");
    expect(structuralChecks.stageInsetTop).toBe(0);
    expect(structuralChecks.stageInsetLeft).toBe(0);
    expect(structuralChecks.stageWidth).toBe(1920);
    expect(structuralChecks.stageHeight).toBe(1080);

    // 2. Zero pin-spacers across the entire film
    expect(structuralChecks.pinSpacers).toBe(0);

    // 3. All 5 scene layers are absolute with 0 margin-top inside cinematicStage
    for (const s of structuralChecks.sceneStyles) {
      expect(s).not.toBeNull();
      expect(s?.position).toBe("absolute");
      expect(s?.marginTop).toBe("0px");
    }

    // Boundary check: Delegation 1.00
    await seekSceneProgress(page, "[data-scene='delegation']", 1.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_delegation_100_folio.png") });

    // Step-Up 0.00: Authority Folio continuity
    await seekSceneProgress(page, "[data-scene='step-up']", 0.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_stepup_000_entry.png") });

    // Step-Up 0.25: Travel request enters on execution rail
    await seekSceneProgress(page, "[data-scene='step-up']", 0.25);
    await page.screenshot({ path: path.join(outDir, "1920x1080_stepup_025_request_arrives.png") });

    // Step-Up 0.50: Held at datum (> ₹1,500 threshold)
    await seekSceneProgress(page, "[data-scene='step-up']", 0.50);
    await page.screenshot({ path: path.join(outDir, "1920x1080_stepup_050_held_at_datum.png") });

    // Step-Up 0.75: One-time clearance document unrolled & signed
    await seekSceneProgress(page, "[data-scene='step-up']", 0.75);
    await page.screenshot({ path: path.join(outDir, "1920x1080_stepup_075_clearance_unrolled.png") });

    // Semantic assertions on Step-Up elements at 0.70 (Hold for Clearance & referral open)
    const holdMetrics = await page.evaluate(() => {
      const doc = document.querySelector("[data-full-doc-wrap]");
      const holdStamp = document.querySelector("[data-hold-stamp]");
      const clearSeal = document.querySelector("[data-clear-seal]");
      const barStatus = document.querySelector("[data-bar-status]");

      const docStyle = doc ? window.getComputedStyle(doc) : null;
      const holdStyle = holdStamp ? window.getComputedStyle(holdStamp) : null;
      const sealStyle = clearSeal ? window.getComputedStyle(clearSeal) : null;

      return {
        docOpacity: docStyle ? parseFloat(docStyle.opacity) : 0,
        holdOpacity: holdStyle ? parseFloat(holdStyle.opacity) : 0,
        sealOpacity: sealStyle ? parseFloat(sealStyle.opacity) : 0,
        barStatusText: barStatus?.textContent?.trim(),
      };
    });

    console.log("[STEP-UP 0.70 HOLD METRICS]", JSON.stringify(holdMetrics, null, 2));

    expect(holdMetrics.docOpacity).toBe(1);
    expect(holdMetrics.holdOpacity).toBe(1);

    // Step-Up 0.84: One-time clearance seal stamped onto document
    await seekSceneProgress(page, "[data-scene='step-up']", 0.84);
    await page.screenshot({ path: path.join(outDir, "1920x1080_stepup_084_cleared_seal.png") });

    const clearedMetrics = await page.evaluate(() => {
      const clearSeal = document.querySelector("[data-clear-seal]");
      const sealStyle = clearSeal ? window.getComputedStyle(clearSeal) : null;
      const barStatus = document.querySelector("[data-bar-status]");
      return {
        sealOpacity: sealStyle ? parseFloat(sealStyle.opacity) : 0,
        barStatusText: barStatus?.textContent?.trim(),
      };
    });

    console.log("[STEP-UP 0.84 CLEARED METRICS]", JSON.stringify(clearedMetrics, null, 2));
    expect(clearedMetrics.sealOpacity).toBe(1);

    // Step-Up 0.95: Resumes downstream through open route (proves STEP-UP != DENY)
    await seekSceneProgress(page, "[data-scene='step-up']", 0.95);
    await page.screenshot({ path: path.join(outDir, "1920x1080_stepup_095_resumes_downstream.png") });

    // Complete Reverse Scrub: StepUp 0.95 -> StepUp 0.0 -> Delegation 0.5 -> Decisions 0.5 -> Mandate 0.5 -> Prologue 0.0
    await seekSceneProgress(page, "[data-scene='step-up']", 0.0);
    await seekSceneProgress(page, "[data-scene='delegation']", 0.5);
    await seekSceneProgress(page, "[data-scene='decisions']", 0.5);
    await seekSceneProgress(page, "[data-scene='mandate']", 0.5);
    await seekSceneProgress(page, "[data-scene='prologue']", 0.0);
    await page.screenshot({ path: path.join(outDir, "1920x1080_full_reverse_back_to_prologue.png") });
  });
});
