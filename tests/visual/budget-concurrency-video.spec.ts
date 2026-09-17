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

test.describe("Scene 07 — Motion Video Verification Suite", () => {
  const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");

  test.beforeAll(async () => {
    await mkdir(videoDir, { recursive: true });
  });

  test("1. Scene 06 → 07 Transition Forward and Reverse", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='split-defense']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='concurrency']").waitFor({ state: "attached", timeout: 15_000 });

    // Position at Split-Defense terminal state (0.90)
    await seekSceneProgress(page, "[data-scene='split-defense']", 0.90);
    await page.waitForTimeout(100);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const splitST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "split-defense");
      const concST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "concurrency");
      return {
        splitStart: splitST?.start ?? 0,
        splitEnd: splitST?.end ?? 0,
        concStart: concST?.start ?? 0,
        concEnd: concST?.end ?? 0,
      };
    });

    const startY = Math.round(stData.splitStart + (stData.splitEnd - stData.splitStart) * 0.90);
    const endY = Math.round(stData.concStart + (stData.concEnd - stData.concStart) * 0.35);

    // Forward scrub across boundary
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

    // Reverse scrub across boundary
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
      await video.saveAs(path.join(videoDir, "scene_06_07_transition.webm"));
    }
  });

  test("2. Scene 07 Normal Forward & Full Reverse Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const concST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "concurrency");
      return {
        start: concST?.start ?? 0,
        end: concST?.end ?? 0,
      };
    });

    const steps = 60;
    // Forward scrub
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    await page.waitForTimeout(300);

    // Full reverse scrub
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
      await video.saveAs(path.join(videoDir, "scene_07_normal_forward_reverse.webm"));
    }
  });

  test("3. Scene 07 Slow Hero Commit & Fast Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const concST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "concurrency");
      return {
        start: concST?.start ?? 0,
        end: concST?.end ?? 0,
      };
    });

    // Slow inspection through atomic reservation beats (0.35 - 0.88)
    const heroStart = stData.start + (stData.end - stData.start) * 0.35;
    const heroEnd = stData.start + (stData.end - stData.start) * 0.88;
    const slowSteps = 45;

    for (let i = 0; i <= slowSteps; i++) {
      const y = Math.round(heroStart + (i / slowSteps) * (heroEnd - heroStart));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(80);
    }

    // Fast scrub back
    const fastSteps = 15;
    for (let i = fastSteps; i >= 0; i--) {
      const y = Math.round(stData.start + (i / fastSteps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(20);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_07_slow_and_fast.webm"));
    }
  });

  test("4. Scene 07 Mobile Viewport (430x932)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "430x932", "Targeted to 430x932 mobile viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const concST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "concurrency");
      return {
        start: concST?.start ?? 0,
        end: concST?.end ?? 0,
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

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_07_mobile_430x932.webm"));
    }
  });

  test("5. Scene 07 Mobile Viewport (390x844)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "390x844", "Targeted to 390x844 mobile viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const concST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "concurrency");
      return {
        start: concST?.start ?? 0,
        end: concST?.end ?? 0,
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

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_07_mobile_390x844.webm"));
    }
  });
});
