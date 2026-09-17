import { test } from "@playwright/test";
import path from "node:path";
import { mkdir, rename } from "node:fs/promises";

type FrameMetrics = {
  deltas: number[];
  lastTime: number;
  measuring: boolean;
};

type ScrollTriggerDebug = {
  trigger?: Element;
  start: number;
  end: number;
};

test.describe("Stage A.4 — Technical Pipeline Motion Audit", () => {
  test.describe.configure({ timeout: 120_000 });

  test("Measure frame pacing and record baseline video with Lenis active", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-baseline");
    await mkdir(videoDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1920, height: 1080 },
      },
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    });

    // Navigate to live experience WITHOUT visualTest=1 so Lenis runs on its single clock
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);


    const debugInfo = await page.evaluate(() => {
      const runtimeWindow = window as Window & {
        ScrollTrigger?: { getAll?: () => ScrollTriggerDebug[] };
      };
      const stList = runtimeWindow.ScrollTrigger?.getAll?.() ?? [];
      const scenes = Array.from(document.querySelectorAll("[data-scene]")).map((el) => ({
        scene: el.getAttribute("data-scene"),
        visibility: window.getComputedStyle(el).visibility,
        display: window.getComputedStyle(el).display,
        zIndex: window.getComputedStyle(el).zIndex,
      }));
      return {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scenes,
        triggers: stList.map((t) => ({
          id: t.trigger?.getAttribute?.("data-track") || t.trigger?.getAttribute?.("data-scene"),
          start: t.start,
          end: t.end,
        })),
      };
    });
    console.log("=== SCENE DEBUG AT Y=0 ===", JSON.stringify(debugInfo, null, 2));



    // Instrument frame pacing measurement
    await page.evaluate(() => {
      const runtimeWindow = window as Window & { __frameMetrics?: FrameMetrics };
      runtimeWindow.__frameMetrics = {
        deltas: [] as number[],
        lastTime: performance.now(),
        measuring: false,
      };

      function frameLoop(time: number) {
        const m = runtimeWindow.__frameMetrics;
        if (!m) return;
        if (m.measuring) {
          const delta = time - m.lastTime;
          m.deltas.push(delta);
        }
        m.lastTime = time;
        requestAnimationFrame(frameLoop);
      }
      requestAnimationFrame(frameLoop);
    });

    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );

    // Start measuring frame pacing during active scrolling
    await page.evaluate(() => {
      const metrics = (window as Window & { __frameMetrics?: FrameMetrics }).__frameMetrics;
      if (!metrics) return;
      metrics.measuring = true;
      metrics.lastTime = performance.now();
    });

    // Perform smooth progressive scroll with realistic mouse wheel cadence
    const totalWheelDelta = maxScroll;
    const steps = 120;
    const deltaPerStep = totalWheelDelta / steps;
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, deltaPerStep);
      await page.waitForTimeout(65);
    }

    // Wait for Lenis momentum to settle
    await page.waitForTimeout(1000);


    // Stop measuring
    const metrics = await page.evaluate(() => {
      const frameMetrics = (window as Window & { __frameMetrics?: FrameMetrics }).__frameMetrics;
      if (!frameMetrics) throw new Error("Frame metrics were not initialized");
      frameMetrics.measuring = false;
      const deltas = frameMetrics.deltas;
      deltas.sort((a, b) => a - b);

      const totalFrames = deltas.length;
      const sum = deltas.reduce((a, b) => a + b, 0);
      const avg = sum / totalFrames;
      const median = deltas[Math.floor(totalFrames * 0.5)];
      const p95 = deltas[Math.floor(totalFrames * 0.95)];
      const p99 = deltas[Math.floor(totalFrames * 0.99)];
      const max = deltas[totalFrames - 1];
      const min = deltas[0];

      const framesOver16_7ms = deltas.filter((d) => d > 16.7).length;
      const framesOver33_3ms = deltas.filter((d) => d > 33.3).length;
      const framesOver50ms = deltas.filter((d) => d > 50).length;

      return {
        totalFrames,
        avgFps: (1000 / avg).toFixed(1),
        minDelta: min.toFixed(2),
        avgDelta: avg.toFixed(2),
        medianDelta: median.toFixed(2),
        p95Delta: p95.toFixed(2),
        p99Delta: p99.toFixed(2),
        maxDelta: max.toFixed(2),
        framesOver16_7ms,
        framesOver33_3ms,
        framesOver50ms,
      };
    });

    console.log("=== TECHNICAL PIPELINE FRAME PACING METRICS ===");
    console.log(JSON.stringify(metrics, null, 2));

    await page.waitForTimeout(1000);

    const video = page.video();
    await page.close();

    if (video) {
      const videoPath = await video.path();
      const dest = path.join(
        process.cwd(),
        "output",
        "playwright",
        "videos",
        "technical-pipeline-baseline.webm"
      );
      await mkdir(path.dirname(dest), { recursive: true });
      await rename(videoPath, dest);
      console.log(`Baseline video saved to: ${dest}`);
    }

    await context.close();
  });
});
