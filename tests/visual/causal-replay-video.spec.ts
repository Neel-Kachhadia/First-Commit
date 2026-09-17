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

test.describe("Scene 08 — Causal Replay / Evidence Reel Motion Video Suite", () => {
  const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");

  test.beforeAll(async () => {
    await mkdir(videoDir, { recursive: true });
  });

  test("1. Scene 07 → 08 Transition Forward and Reverse", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='concurrency']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='causal-replay']").waitFor({ state: "attached", timeout: 15_000 });

    // Position at Concurrency terminal state (0.92)
    await seekSceneProgress(page, "[data-scene='concurrency']", 0.92);
    await page.waitForTimeout(100);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const concST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "concurrency");
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        concStart: concST?.start ?? 0,
        concEnd: concST?.end ?? 0,
        replayStart: replayST?.start ?? 0,
        replayEnd: replayST?.end ?? 0,
      };
    });

    const startY = Math.round(stData.concStart + (stData.concEnd - stData.concStart) * 0.90);
    const endY = Math.round(stData.replayStart + (stData.replayEnd - stData.replayStart) * 0.30);

    // Forward scrub across boundary into Causal Replay establishment
    const steps = 45;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(startY + (i / steps) * (endY - startY));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    // Reverse scrub across boundary back into Concurrency
    for (let i = steps; i >= 0; i--) {
      const y = Math.round(startY + (i / steps) * (endY - startY));
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
      await video.saveAs(path.join(videoDir, "scene_07_08_transition.webm"));
    }
  });

  test("2. Scene 08 Normal Forward & Reverse Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        start: replayST?.start ?? 0,
        end: replayST?.end ?? 0,
      };
    });

    const steps = 70;
    // Forward scrub through all 8 stages
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(45);
    }

    await page.waitForTimeout(300);

    // Reverse scrub back to origin
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
      await video.saveAs(path.join(videoDir, "scene_08_normal_forward_reverse.webm"));
    }
  });

  test("3. Scene 08 Slow Forensic Inspection", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    // Holds at key stages: 0.24 (Result), 0.42 (Decision), 0.54 (Budget), 0.72 (Authority), 0.92 (Intent)
    const inspectionPoints = [0.15, 0.24, 0.33, 0.42, 0.54, 0.64, 0.72, 0.82, 0.92, 0.98];
    for (const p of inspectionPoints) {
      await seekSceneProgress(page, "[data-scene='causal-replay']", p);
      await page.waitForTimeout(250);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_08_slow_inspection.webm"));
    }
  });

  test("4. Scene 08 Fast Scrub & Full Reverse", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        start: replayST?.start ?? 0,
        end: replayST?.end ?? 0,
      };
    });

    // High velocity forward scrub
    const fastSteps = 20;
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

    // High velocity reverse scrub
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
      await video.saveAs(path.join(videoDir, "scene_08_fast.webm"));
    }
  });

  test("5. Scene 08 Full Reverse Scrub (1.00 down to 0.00)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        start: replayST?.start ?? 0,
        end: replayST?.end ?? 0,
      };
    });

    // Start at terminal state p=1.00
    await page.evaluate((targetY) => {
      window.scrollTo(0, targetY);
      window.dispatchEvent(new Event("scroll"));
      (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
    }, stData.end);
    await page.waitForTimeout(250);

    // Reverse steadily
    const steps = 60;
    for (let i = steps; i >= 0; i--) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(45);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_08_full_reverse.webm"));
    }
  });

  test("6. Scene 08 on 1366x768 Laptop Viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1366x768", "Targeted to 1366x768 laptop viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        start: replayST?.start ?? 0,
        end: replayST?.end ?? 0,
      };
    });

    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(stData.start + (i / steps) * (stData.end - stData.start));
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(45);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_08_1366x768.webm"));
    }
  });

  test("7. Scene 08 Mobile Scrub (430x932)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "430x932", "Targeted to 430x932 mobile viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        start: replayST?.start ?? 0,
        end: replayST?.end ?? 0,
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
      await page.waitForTimeout(45);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_08_mobile_430x932.webm"));
    }
  });

  test("8. Scene 08 Mobile Scrub (390x844)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "390x844", "Targeted to 390x844 mobile viewport");
    await prepareVisualPage(page);

    const stData = await page.evaluate(() => {
      const all = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }>;
        };
      }).ScrollTrigger?.getAll?.() ?? [];
      const replayST = all.find((t) => t.trigger?.getAttribute?.("data-track") === "causal-replay");
      return {
        start: replayST?.start ?? 0,
        end: replayST?.end ?? 0,
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
      await page.waitForTimeout(45);
    }

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "scene_08_mobile_390x844.webm"));
    }
  });
});
