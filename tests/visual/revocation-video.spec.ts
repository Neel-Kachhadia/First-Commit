import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

test.use({
  video: {
    mode: "on",
    size: { width: 1920, height: 1080 },
  },
});

test.describe("Scene 05 — Motion Video Verification Suite", () => {
  const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");

  test.beforeAll(async () => {
    await mkdir(videoDir, { recursive: true });
  });

  test("1 & 2. Scene 04 → 05 Transition Forward and Reverse", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='revocation']").waitFor({ state: "attached", timeout: 15_000 });

    // Position at Step-Up terminal state (0.85)
    await seekSceneProgress(page, "[data-scene='step-up']", 0.85);
    await page.waitForTimeout(100);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const stepUpST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "step-up");
      const revST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "revocation");
      return {
        stepUpStart: stepUpST?.start ?? 0,
        stepUpEnd: stepUpST?.end ?? 0,
        revStart: revST?.start ?? 0,
        revEnd: revST?.end ?? 0,
      };
    });

    const startY = Math.round(stData.stepUpStart + (stData.stepUpEnd - stData.stepUpStart) * 0.85);
    const endY = Math.round(stData.revStart + (stData.revEnd - stData.revStart) * 0.35);

    // 1. Forward scrub across boundary
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(startY + (i / steps) * (endY - startY));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(50);
    }

    // 2. Reverse scrub across boundary
    for (let i = steps; i >= 0; i--) {
      const y = Math.round(startY + (i / steps) * (endY - startY));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(200);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_04_05_transition.webm"));
    }
  });

  test("3 & 6. Scene 05 Normal Forward & Full Reverse Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const revST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "revocation");
      return {
        start: revST?.start ?? 0,
        end: revST?.end ?? 0,
      };
    });

    const steps = 60;
    // Controlled forward scrub
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    // Hold at 1.0
    await page.waitForTimeout(300);

    // Full reverse scrub back to start
    for (let i = steps; i >= 0; i--) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    await page.waitForTimeout(200);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_05_normal_forward_reverse.webm"));
    }
  });

  test("4 & 5. Scene 05 Slow Interpolation Review & Fast Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const revST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "revocation");
      return {
        start: revST?.start ?? 0,
        end: revST?.end ?? 0,
      };
    });

    // Slow interpolation through hero moment (0.35 to 0.75)
    const slowSteps = 50;
    const heroStart = stData.start + (stData.end - stData.start) * 0.35;
    const heroEnd = stData.start + (stData.end - stData.start) * 0.75;
    for (let i = 0; i <= slowSteps; i++) {
      const y = Math.round(heroStart + (i / slowSteps) * (heroEnd - heroStart));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(70);
    }

    // Fast aggressive scrub across entire scene
    const fastSteps = 15;
    for (let i = 0; i <= fastSteps; i++) {
      const y = Math.round(stData.start + (i / fastSteps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(20);
    }

    await page.waitForTimeout(200);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_05_slow_and_fast.webm"));
    }
  });

  test("7 & 8. Mobile 430x932 and 390x844 Forward & Reverse", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "430x932" && testInfo.project.name !== "390x844",
      "Targeted to mobile viewports",
    );
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const revST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "revocation");
      return {
        start: revST?.start ?? 0,
        end: revST?.end ?? 0,
      };
    });

    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(50);
    }

    for (let i = steps; i >= 0; i--) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(200);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, `scene_05_mobile_${testInfo.project.name}.webm`));
    }
  });
});
