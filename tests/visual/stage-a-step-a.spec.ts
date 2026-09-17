import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { seekSceneProgress } from "./helpers/scene-checkpoints";

test.describe("Stage A.3 — Step A: Prologue -> Mandate Persistent Stage Verification", () => {
  test("1. Structural assertions & boundary continuity", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await page.goto("/?visualTest=1&migration=A", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    // Log actual viewport dimensions (Constraint 18)
    const viewportDim = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
    }));
    console.log(`[REAL VIEWPORT] innerWidth: ${viewportDim.width}, innerHeight: ${viewportDim.height}`);
    expect(viewportDim.width).toBe(1920);
    expect(viewportDim.height).toBe(1080);

    const outDir = path.join(process.cwd(), "output", "playwright", "step-a");
    await mkdir(outDir, { recursive: true });

    // Invariant 1: cinematicStage is position: fixed with inset: 0 (bounds equal viewport)
    const stageInfo = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
      if (!stage) return null;
      const computed = window.getComputedStyle(stage);
      const rect = stage.getBoundingClientRect();
      return {
        position: computed.position,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
    });

    expect(stageInfo).not.toBeNull();
    expect(stageInfo?.position).toBe("fixed");
    expect(stageInfo?.top).toBeLessThanOrEqual(60);
    expect(stageInfo?.left).toBe(0);
    expect(stageInfo?.width).toBe(viewportDim.width);
    expect(stageInfo?.height).toBeCloseTo(viewportDim.height - stageInfo!.top, 0);

    // Invariant 2: No pin-spacers exist for migrated scenes
    const pinSpacers = await page.evaluate(() => document.querySelectorAll(".pin-spacer").length);
    expect(pinSpacers).toBe(0);

    // Invariant 3: Both Prologue and Mandate are absolute inset: 0 inside stage
    const layersInfo = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>("[data-scene='prologue']");
      const m = document.querySelector<HTMLElement>("[data-scene='mandate']");
      if (!p || !m) return null;
      const cp = window.getComputedStyle(p);
      const cm = window.getComputedStyle(m);
      return {
        pPos: cp.position,
        pMarginTop: cp.marginTop,
        mPos: cm.position,
        mMarginTop: cm.marginTop,
      };
    });

    expect(layersInfo?.pPos).toBe("absolute");
    expect(layersInfo?.mPos).toBe("absolute");
    expect(layersInfo?.pMarginTop).toBe("0px");
    expect(layersInfo?.mMarginTop).toBe("0px");

    // Capture checkpoints through Prologue
    await seekSceneProgress(page, "[data-scene='prologue']", 0.0);
    await page.screenshot({ path: path.join(outDir, "prologue_000.png") });

    await seekSceneProgress(page, "[data-scene='prologue']", 0.50);
    await page.screenshot({ path: path.join(outDir, "prologue_050.png") });

    // Prologue 1.00: Full ivory Permission takeover
    await seekSceneProgress(page, "[data-scene='prologue']", 1.0);
    await page.screenshot({ path: path.join(outDir, "prologue_100_permission_takeover.png") });

    // Mandate 0.00: Exactly matching full ivory Permission takeover
    await seekSceneProgress(page, "[data-scene='mandate']", 0.0);
    await page.screenshot({ path: path.join(outDir, "mandate_000_permission_handoff.png") });

    // GATE A: Verify that at the boundary, NO 50/50 vertical split exists
    const boundaryCheck = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>("[data-scene='prologue']");
      const m = document.querySelector<HTMLElement>("[data-scene='mandate']");
      const pRect = p?.getBoundingClientRect();
      const mRect = m?.getBoundingClientRect();
      return {
        pTop: pRect?.top,
        mTop: mRect?.top,
        mHeight: mRect?.height,
        windowHeight: window.innerHeight,
      };
    });
    expect(boundaryCheck.mTop).toBeLessThanOrEqual(60);
    expect(boundaryCheck.mHeight).toBeCloseTo(viewportDim.height - (boundaryCheck.mTop ?? 0), 0);

    // Mandate progression
    await seekSceneProgress(page, "[data-scene='mandate']", 0.25);
    await page.screenshot({ path: path.join(outDir, "mandate_025.png") });

    await seekSceneProgress(page, "[data-scene='mandate']", 0.50);
    await page.screenshot({ path: path.join(outDir, "mandate_050.png") });

    // GATE B: Full completed contract hold at 0.75
    await seekSceneProgress(page, "[data-scene='mandate']", 0.75);
    await page.screenshot({ path: path.join(outDir, "mandate_075_full_contract_hold.png") });

    // Semantic assertions for all authority fields at resting hold (0.75):
    const fields = await page.evaluate(() => {
      const getVal = (key: string) => {
        const el = document.querySelector(`[data-mandate-field='${key}'] [data-mandate-field-val]`);
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim(),
          opacity: parseFloat(style.opacity),
          visible: style.display !== "none" && style.visibility !== "hidden",
        };
      };

      const sealEl = document.querySelector("[data-mandate-seal]");
      const sealStyle = sealEl ? window.getComputedStyle(sealEl) : null;

      const stampEl = document.querySelector("[data-mandate-stamp]");
      const stampStyle = stampEl ? window.getComputedStyle(stampEl) : null;

      const intentEl = document.querySelector("[data-mandate-intent]");
      const intentStyle = intentEl ? window.getComputedStyle(intentEl) : null;

      return {
        limit: getVal("limit"),
        stepup: getVal("stepup"),
        blocked: getVal("blocked"),
        expires: getVal("expires"),
        delegation: getVal("delegation"),
        sealOpacity: sealStyle ? parseFloat(sealStyle.opacity) : 0,
        stampOpacity: stampStyle ? parseFloat(stampStyle.opacity) : 0,
        intentOpacity: intentStyle ? parseFloat(intentStyle.opacity) : 0,
      };
    });

    console.log("[GATE B FIELDS]", JSON.stringify(fields, null, 2));

    expect(fields.limit?.text).toBe("₹4,000 / WEEK");
    expect(fields.limit?.opacity).toBe(1);

    expect(fields.stepup?.text).toBe("> ₹1,500");
    expect(fields.stepup?.opacity).toBe(1);

    expect(fields.blocked?.text).toBe("ALCOHOL");
    expect(fields.blocked?.opacity).toBe(1);

    // CRITICAL GATE B ASSERTIONS: EXPIRES and DELEGATION MUST BE POPULATED!
    expect(fields.expires?.text).toBe("SUN 23:59");
    expect(fields.expires?.opacity).toBe(1);

    expect(fields.delegation?.text).toBe("2 LEVELS MAX");
    expect(fields.delegation?.opacity).toBe(1);

    expect(fields.sealOpacity).toBe(1);
    expect(fields.stampOpacity).toBe(1);
    expect(fields.intentOpacity).toBe(1);

    // Mandate terminal departure
    await seekSceneProgress(page, "[data-scene='mandate']", 1.0);
    await page.screenshot({ path: path.join(outDir, "mandate_100_departure.png") });

    // Reverse test: scroll backwards from Mandate 100 back to Prologue 0
    await seekSceneProgress(page, "[data-scene='mandate']", 0.5);
    await seekSceneProgress(page, "[data-scene='mandate']", 0.0);
    await seekSceneProgress(page, "[data-scene='prologue']", 0.8);
    await seekSceneProgress(page, "[data-scene='prologue']", 0.0);
    await page.screenshot({ path: path.join(outDir, "reverse_prologue_000.png") });
  });
});
