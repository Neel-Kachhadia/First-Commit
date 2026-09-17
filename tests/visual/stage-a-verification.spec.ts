import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

test.use({
  video: {
    mode: "on",
    size: { width: 1920, height: 1080 },
  },
});

test.describe("Stage A Global Transition Recovery — Motion & Continuity Verification", () => {

  test("1. FULL FORWARD: Continuous forward experience from Prologue through Step-Up", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");
    await mkdir(videoDir, { recursive: true });

    // Wait for all active scenes
    await page.locator("[data-scene='prologue']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='mandate']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='delegation']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    // Smooth forward progression through entire experience
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round((i / steps) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    // Assert final Step-Up state
    await seekSceneProgress(page, "[data-scene='step-up']", 1.0);
    const slipVisible = await page.locator("[data-active-slip]").isVisible();
    const footerVisible = await page.locator("[data-stepup-footer]").isVisible();
    expect(slipVisible).toBe(true);
    expect(footerVisible).toBe(true);

    await page.waitForTimeout(300);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "stage_a_full_forward.webm"));
    }
  });

  test("2. SLOW BOUNDARY SCRUB: Fine-grained inspection across all 4 boundaries", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");
    await mkdir(videoDir, { recursive: true });

    const boundaries = await page.evaluate(() => {
      const getST = (sel: string) => {
        const el = document.querySelector(sel);
        const all = (window as unknown as { ScrollTrigger?: { getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }> } }).ScrollTrigger?.getAll?.() ?? [];
        return all.find((t) => t.trigger === el);
      };
      return {
        b1_prologue_mandate: getST("[data-scene='mandate']")?.start ?? 0,
        b2_mandate_decisions: getST("[data-scene='decisions']")?.start ?? 0,
        b3_decisions_delegation: getST("[data-scene='delegation']")?.start ?? 0,
        b4_delegation_stepup: getST("[data-scene='step-up']")?.start ?? 0,
      };
    });

    const scrubZone = async (centerY: number, delta: number, label: string) => {
      console.log(`Scrubbing boundary: ${label} around Y=${centerY}`);
      const startY = centerY - delta;
      const endY = centerY + delta;
      const steps = 25;

      // Forward scrub
      for (let i = 0; i <= steps; i++) {
        const y = Math.round(startY + (i / steps) * (endY - startY));
        await page.evaluate((targetY) => {
          window.scrollTo(0, targetY);
          window.dispatchEvent(new Event("scroll"));
          (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
        }, y);
        await page.waitForTimeout(60);
      }

      // Reverse scrub
      for (let i = steps; i >= 0; i--) {
        const y = Math.round(startY + (i / steps) * (endY - startY));
        await page.evaluate((targetY) => {
          window.scrollTo(0, targetY);
          window.dispatchEvent(new Event("scroll"));
          (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
        }, y);
        await page.waitForTimeout(50);
      }
    };

    // 1. Prologue -> Mandate (boundary 1)
    await scrubZone(boundaries.b1_prologue_mandate, 200, "Prologue -> Mandate");

    // 2. Mandate -> Decisions (boundary 2)
    await scrubZone(boundaries.b2_mandate_decisions, 250, "Mandate -> Decisions");

    // 3. Decisions -> Delegation (boundary 3)
    await scrubZone(boundaries.b3_decisions_delegation, 250, "Decisions -> Delegation");

    // 4. Delegation -> Step-Up (boundary 4)
    await scrubZone(boundaries.b4_delegation_stepup, 250, "Delegation -> Step-Up");

    await page.waitForTimeout(300);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "stage_a_slow_boundary_scrub.webm"));
    }
  });

  test("3. FAST SCROLL: High-velocity scrub forward and backward", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");
    await mkdir(videoDir, { recursive: true });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    // Fast scroll forward (15 jumps)
    for (let i = 0; i <= 15; i++) {
      const y = Math.round((i / 15) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(35);
    }

    await page.waitForTimeout(100);

    // Fast scroll reverse (15 jumps)
    for (let i = 15; i >= 0; i--) {
      const y = Math.round((i / 15) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(35);
    }

    await page.waitForTimeout(300);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "stage_a_fast_scroll.webm"));
    }
  });

  test("4. FULL REVERSE: Continuous reverse scrub from end of Step-Up back to Prologue", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");
    await mkdir(videoDir, { recursive: true });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    // Seek to very end first
    await page.evaluate((targetY) => {
      window.scrollTo(0, targetY);
      window.dispatchEvent(new Event("scroll"));
      (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
    }, totalHeight);
    await page.waitForTimeout(200);

    // Smooth reverse scrub back to 0
    const steps = 120;
    for (let i = steps; i >= 0; i--) {
      const y = Math.round((i / steps) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(40);
    }

    // Verify Prologue resting state restored
    const wordmarkVisible = await page.locator("[data-opening-word]").isVisible();
    expect(wordmarkVisible).toBe(true);

    await page.waitForTimeout(300);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "stage_a_full_reverse.webm"));
    }
  });

  test("5. MOBILE 430x932: Complete forward and reverse boundary verification", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Single runner execution with mobile viewport");
    await page.setViewportSize({ width: 430, height: 932 });
    await prepareVisualPage(page);

    const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");
    await mkdir(videoDir, { recursive: true });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    // Forward scroll across all scenes
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round((i / steps) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(45);
    }

    // Reverse scrub back
    for (let i = steps; i >= 0; i -= 2) {
      const y = Math.round((i / steps) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(35);
    }

    await page.waitForTimeout(300);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "stage_a_mobile_430x932.webm"));
    }
  });

  test("6. MOBILE 390x844: Complete forward and reverse boundary verification", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Single runner execution with mobile viewport");
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareVisualPage(page);

    const videoDir = path.join(process.cwd(), "output", "playwright", "motion-video");
    await mkdir(videoDir, { recursive: true });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    // Forward scroll across all scenes
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const y = Math.round((i / steps) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(45);
    }

    // Reverse scrub back
    for (let i = steps; i >= 0; i -= 2) {
      const y = Math.round((i / steps) * totalHeight);
      await page.evaluate((targetY) => {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, y);
      await page.waitForTimeout(35);
    }

    await page.waitForTimeout(300);
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(videoDir, "stage_a_mobile_390x844.webm"));
    }
  });
});
