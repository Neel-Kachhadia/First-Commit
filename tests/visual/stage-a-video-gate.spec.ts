import { test, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir, rename } from "node:fs/promises";

test.describe("Stage A.3 — Full Video Gate", () => {
  test.describe.configure({ timeout: 120_000 });

  async function getRecordedVideo(page: Page, targetPath: string) {
    const video = page.video();
    if (!video) throw new Error("No video recorded");
    await page.close();
    const videoPath = await video.path();
    await mkdir(path.dirname(targetPath), { recursive: true });
    await rename(videoPath, targetPath);
    console.log(`Saved video to: ${targetPath}`);
  }

  test("1. Normal Controlled Forward Video", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-normal");
    await mkdir(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1920, height: 1080 },
      },
    });
    const page = await context.newPage();
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    // Wait for fonts & initial settle
    await page.waitForTimeout(1000);

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    console.log(`[NORMAL FORWARD] maxScroll: ${maxScroll}`);

    // Smooth forward scroll over 18 seconds
    await page.evaluate(async ({ durationMs, targetY }) => {
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const currentY = targetY * progress;
          window.scrollTo(0, currentY);
          window.dispatchEvent(new Event("scroll"));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }, { durationMs: 18000, targetY: maxScroll });

    // Hold at conclusion for 2 seconds
    await page.waitForTimeout(2000);

    const dest = path.join(process.cwd(), "output", "playwright", "videos", "video-normal.webm");
    await getRecordedVideo(page, dest);
    await context.close();
  });

  test("2. Slow Scrub Video (Micro-continuity & Boundary Verification)", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-slow");
    await mkdir(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1920, height: 1080 },
      },
    });
    const page = await context.newPage();
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    await page.waitForTimeout(1000);

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    console.log(`[SLOW SCRUB] maxScroll: ${maxScroll}`);

    // Slow scrub over 30 seconds
    await page.evaluate(async ({ durationMs, targetY }) => {
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const currentY = targetY * progress;
          window.scrollTo(0, currentY);
          window.dispatchEvent(new Event("scroll"));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }, { durationMs: 30000, targetY: maxScroll });

    await page.waitForTimeout(1500);

    const dest = path.join(process.cwd(), "output", "playwright", "videos", "video-slow.webm");
    await getRecordedVideo(page, dest);
    await context.close();
  });

  test("3. Fast Scroll Video (Stress & No Flash Verification)", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-fast");
    await mkdir(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1920, height: 1080 },
      },
    });
    const page = await context.newPage();
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    await page.waitForTimeout(1000);

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    console.log(`[FAST SCROLL] maxScroll: ${maxScroll}`);

    // Fast scroll over 5 seconds
    await page.evaluate(async ({ durationMs, targetY }) => {
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const currentY = targetY * progress;
          window.scrollTo(0, currentY);
          window.dispatchEvent(new Event("scroll"));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }, { durationMs: 5000, targetY: maxScroll });

    await page.waitForTimeout(1500);

    const dest = path.join(process.cwd(), "output", "playwright", "videos", "video-fast.webm");
    await getRecordedVideo(page, dest);
    await context.close();
  });

  test("4. Full Reverse Video (Step-Up 04 -> Delegation 03 -> Decisions 02 -> Mandate 01 -> Prologue 00)", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-reverse");
    await mkdir(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1920, height: 1080 },
      },
    });
    const page = await context.newPage();
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    console.log(`[FULL REVERSE] maxScroll: ${maxScroll}`);

    // Start at bottom
    await page.evaluate((bottomY) => {
      window.scrollTo(0, bottomY);
      window.dispatchEvent(new Event("scroll"));
    }, maxScroll);

    await page.waitForTimeout(1500);

    // Reverse scroll from bottom to top over 20 seconds
    await page.evaluate(async ({ durationMs, startY }) => {
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const currentY = startY * (1 - progress);
          window.scrollTo(0, currentY);
          window.dispatchEvent(new Event("scroll"));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }, { durationMs: 20000, startY: maxScroll });

    await page.waitForTimeout(1500);

    const dest = path.join(process.cwd(), "output", "playwright", "videos", "video-reverse.webm");
    await getRecordedVideo(page, dest);
    await context.close();
  });

  test("5. Mobile Controlled Forward Video (390x844)", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-mobile-forward");
    await mkdir(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: {
        dir: videoDir,
        size: { width: 390, height: 844 },
      },
    });
    const page = await context.newPage();
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    await page.waitForTimeout(1000);

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    console.log(`[MOBILE FORWARD] maxScroll: ${maxScroll}`);

    // Controlled mobile forward scroll over 18 seconds
    await page.evaluate(async ({ durationMs, targetY }) => {
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const currentY = targetY * progress;
          window.scrollTo(0, currentY);
          window.dispatchEvent(new Event("scroll"));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }, { durationMs: 18000, targetY: maxScroll });

    await page.waitForTimeout(1500);

    const dest = path.join(process.cwd(), "output", "playwright", "videos", "video-mobile-forward.webm");
    await getRecordedVideo(page, dest);
    await context.close();
  });

  test("6. Mobile Reverse Video (390x844)", async ({ browser }) => {
    const videoDir = path.join(process.cwd(), "output", "playwright", "videos", "temp-mobile-reverse");
    await mkdir(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: {
        dir: videoDir,
        size: { width: 390, height: 844 },
      },
    });
    const page = await context.newPage();
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    console.log(`[MOBILE REVERSE] maxScroll: ${maxScroll}`);

    // Seek to bottom first
    await page.evaluate((bottomY) => {
      window.scrollTo(0, bottomY);
      window.dispatchEvent(new Event("scroll"));
    }, maxScroll);

    await page.waitForTimeout(1500);

    // Controlled mobile reverse scroll over 18 seconds
    await page.evaluate(async ({ durationMs, startY }) => {
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const currentY = startY * (1 - progress);
          window.scrollTo(0, currentY);
          window.dispatchEvent(new Event("scroll"));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }, { durationMs: 18000, startY: maxScroll });

    await page.waitForTimeout(1500);

    const dest = path.join(process.cwd(), "output", "playwright", "videos", "video-mobile-reverse.webm");
    await getRecordedVideo(page, dest);
    await context.close();
  });
});
