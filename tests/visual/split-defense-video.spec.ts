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

test.describe("Scene 06 — Motion Video Verification Suite", () => {
  const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");

  test.beforeAll(async () => {
    await mkdir(videoDir, { recursive: true });
  });

  test("1. Scene 05 → 06 Transition Forward and Reverse", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='revocation']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='split-defense']").waitFor({ state: "attached", timeout: 15_000 });

    // Position at Revocation terminal state (0.85)
    await seekSceneProgress(page, "[data-scene='revocation']", 0.85);
    await page.waitForTimeout(100);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const revST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "revocation");
      const splitST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "split-defense");
      return {
        revStart: revST?.start ?? 0,
        revEnd: revST?.end ?? 0,
        splitStart: splitST?.start ?? 0,
        splitEnd: splitST?.end ?? 0,
      };
    });

    const startY = Math.round(stData.revStart + (stData.revEnd - stData.revStart) * 0.85);
    const endY = Math.round(stData.splitStart + (stData.splitEnd - stData.splitStart) * 0.35);

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
      await video.saveAs(path.join(videoDir, "scene_05_06_transition.webm"));
    }
  });

  test("2. Scene 06 Normal Forward & Full Reverse Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const splitST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "split-defense");
      return {
        start: splitST?.start ?? 0,
        end: splitST?.end ?? 0,
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
      await page.waitForTimeout(60);
    }

    await page.waitForTimeout(400);

    // Smooth reverse scrub back to 0.00
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
      await video.saveAs(path.join(videoDir, "scene_06_normal_forward_reverse.webm"));
    }
  });

  test("3. Scene 06 Slow Hero & High Velocity Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const splitST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "split-defense");
      return {
        start: splitST?.start ?? 0,
        end: splitST?.end ?? 0,
      };
    });

    // Slow micro-scrub across hero correlation window (0.34 to 0.85)
    const heroStart = Math.round(stData.start + (stData.end - stData.start) * 0.34);
    const heroEnd = Math.round(stData.start + (stData.end - stData.start) * 0.85);
    const heroSteps = 50;

    for (let i = 0; i <= heroSteps; i++) {
      const y = Math.round(heroStart + (i / heroSteps) * (heroEnd - heroStart));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(80);
    }

    // Fast scroll to completion
    await page.evaluate((targetY) => {
      window.scrollTo(0, targetY);
      window.dispatchEvent(new Event("scroll"));
      (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
    }, stData.end);
    await page.waitForTimeout(400);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_06_slow_and_fast.webm"));
    }
  });

  test("4. Scene 06 Mobile 430x932 Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "430x932", "Targeted to 430x932 mobile viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const splitST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "split-defense");
      return {
        start: splitST?.start ?? 0,
        end: splitST?.end ?? 0,
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
      await page.waitForTimeout(60);
    }

    for (let i = steps; i >= 0; i--) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_06_mobile_430x932.webm"));
    }
  });

  test("5. Scene 06 Mobile 390x844 Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "390x844", "Targeted to 390x844 mobile viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const splitST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "split-defense");
      return {
        start: splitST?.start ?? 0,
        end: splitST?.end ?? 0,
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
      await page.waitForTimeout(60);
    }

    for (let i = steps; i >= 0; i--) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_06_mobile_390x844.webm"));
    }
  });
});
