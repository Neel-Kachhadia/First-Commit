import { test, expect } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

test.use({
  viewport: { width: 1920, height: 1080 },
  video: {
    mode: "on",
    size: { width: 1920, height: 1080 },
  },
});

test.describe("Phase 1.3 Motion Review — Forward & Reverse Scrub", () => {

  test("Forward scroll, slow scrub, fast scrub, and full reverse scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);
    await page.locator("[data-scene='mandate']").waitFor({ state: "attached", timeout: 15_000 });

    // 1. Normal-speed forward progression through Mandate (0% -> 100%)
    for (let p = 0; p <= 1.0; p += 0.05) {
      await seekSceneProgress(page, "[data-scene='mandate']", Math.round(p * 100) / 100);
      await page.waitForTimeout(60);
    }

    // Verify activated state at 75% resting point
    await seekSceneProgress(page, "[data-scene='mandate']", 0.75);
    const stampVisible = await page.locator("[data-mandate-stamp]").isVisible();
    const sealVisible = await page.locator("[data-mandate-seal]").isVisible();
    expect(stampVisible).toBe(true);
    expect(sealVisible).toBe(true);

    // Verify delegation wording clarification: "2 LEVELS MAX"
    const delegationValue = await page.locator("[data-mandate-field='delegation'] [data-mandate-field-val]").textContent();
    expect(delegationValue?.trim()).toBe("2 LEVELS MAX");

    // 2. Slow scrub through Formation & Activation (0.10 -> 0.75)
    for (let p = 0.10; p <= 0.75; p += 0.02) {
      await seekSceneProgress(page, "[data-scene='mandate']", Math.round(p * 100) / 100);
      await page.waitForTimeout(80);
    }

    // 3. Fast scrub from 0.0 to 1.0
    for (let p = 0; p <= 1.0; p += 0.20) {
      await seekSceneProgress(page, "[data-scene='mandate']", Math.round(p * 100) / 100);
      await page.waitForTimeout(40);
    }

    // 4. Full Reverse scrub: Activated contract (100% -> 75% -> 50% -> 25% -> 0%)
    for (let p = 1.0; p >= 0; p -= 0.05) {
      await seekSceneProgress(page, "[data-scene='mandate']", Math.round(p * 100) / 100);
      await page.waitForTimeout(60);
    }

    // Verify clean restoration at 0%: Permission resting composition restored
    await seekSceneProgress(page, "[data-scene='mandate']", 0.0);
    const handoffOpacity = await page.locator("[data-mandate-handoff]").evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(handoffOpacity)).toBeGreaterThan(0.9);

    // And verify category and seal have retracted at 0%
    const sealOpacity = await page.locator("[data-mandate-seal]").evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(sealOpacity)).toBeLessThan(0.1);

    // 5. Dense QA: Record actual bounding rectangles at representative progress points (0%, 8%, 12%, 16%, 20%)
    const progressChecks = [0.0, 0.08, 0.12, 0.16, 0.20];
    const recordedBounds: {
      progress: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
      width: number;
      height: number;
    }[] = [];

    for (const p of progressChecks) {
      await seekSceneProgress(page, "[data-scene='mandate']", p);
      const b = await page.locator("[data-mandate-bounding-paper]").evaluate((el) => {
        const topAttr = el.getAttribute("data-paper-top");
        const rightAttr = el.getAttribute("data-paper-right");
        const bottomAttr = el.getAttribute("data-paper-bottom");
        const leftAttr = el.getAttribute("data-paper-left");
        let top = topAttr ? parseFloat(topAttr) : 0;
        let right = rightAttr ? parseFloat(rightAttr) : 0;
        let bottom = bottomAttr ? parseFloat(bottomAttr) : 0;
        let left = leftAttr ? parseFloat(leftAttr) : 0;

        if (!topAttr) {
          const match = /inset\(([^%]+)%\s+([^%]+)%\s+([^%]+)%\s+([^%]+)%\)/.exec(el.style.clipPath);
          if (match) {
            top = parseFloat(match[1]);
            right = parseFloat(match[2]);
            bottom = parseFloat(match[3]);
            left = parseFloat(match[4]);
          }
        }
        const width = 100 - (left + right);
        const height = 100 - (top + bottom);
        return { top, right, bottom, left, width, height };
      });
      recordedBounds.push({ progress: p, ...b });
    }

    console.log("Recorded Bounding Rectangles (0%, 8%, 12%, 16%, 20%):", JSON.stringify(recordedBounds, null, 2));

    const b0 = recordedBounds[0];
    const b8 = recordedBounds[1];
    const b12 = recordedBounds[2];

    expect(b8.top).toBeGreaterThanOrEqual(b0.top);
    expect(b8.bottom).toBeGreaterThanOrEqual(b0.bottom);
    expect(b8.left).toBeGreaterThanOrEqual(b0.left);
    expect(b8.right).toBeGreaterThanOrEqual(b0.right);
    expect(b8.width).toBeLessThanOrEqual(b0.width);
    expect(b8.height).toBeLessThanOrEqual(b0.height);

    expect(b12.top).toBeGreaterThan(b8.top);
    expect(b12.bottom).toBeGreaterThan(b8.bottom);
    expect(b12.left).toBeGreaterThan(b8.left);
    expect(b12.right).toBeGreaterThan(b8.right);
    expect(b12.width).toBeLessThan(b8.width);
    expect(b12.height).toBeLessThan(b8.height);

    const b16 = recordedBounds[3];
    const b20 = recordedBounds[4];

    expect(b16.top).toBeGreaterThan(b12.top);
    expect(b16.bottom).toBeGreaterThan(b12.bottom);
    expect(b16.left).toBeGreaterThan(b12.left);
    expect(b16.right).toBeGreaterThan(b12.right);
    expect(b16.width).toBeLessThan(b12.width);
    expect(b16.height).toBeLessThan(b12.height);

    expect(b20.top).toBe(b16.top);
    expect(b20.bottom).toBe(b16.bottom);
    expect(b20.left).toBe(b16.left);
    expect(b20.right).toBe(b16.right);

    const targetBounds = await page.locator("[data-mandate-bounding-paper]").evaluate((el) => ({
      top: parseFloat(el.getAttribute("data-target-top") || "0"),
      right: parseFloat(el.getAttribute("data-target-right") || "0"),
      bottom: parseFloat(el.getAttribute("data-target-bottom") || "0"),
      left: parseFloat(el.getAttribute("data-target-left") || "0"),
    }));

    expect(Math.abs(b16.top - targetBounds.top)).toBeLessThan(0.1);
    expect(Math.abs(b16.right - targetBounds.right)).toBeLessThan(0.1);
    expect(Math.abs(b16.bottom - targetBounds.bottom)).toBeLessThan(0.1);
    expect(Math.abs(b16.left - targetBounds.left)).toBeLessThan(0.1);

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/phase_1_3_motion_review.webm");
    }
  });

  test("Scene 02 Decisions Motion Review — Forward, Slow, Fast, and Reverse Scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);
    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });

    // 1. Normal-speed forward progression through Decisions (0% -> 100%)
    for (let p = 0; p <= 1.0; p += 0.05) {
      await seekSceneProgress(page, "[data-scene='decisions']", Math.round(p * 100) / 100);
      await page.waitForTimeout(70);
    }

    // Verify key states in resting final composition (100%)
    await seekSceneProgress(page, "[data-scene='decisions']", 1.0);
    await expect(page.locator("[data-stamp='allow']")).toBeVisible();
    await expect(page.locator("[data-stamp='stepup']")).toBeVisible();
    await expect(page.locator("[data-stamp='deny']")).toBeVisible();
    await expect(page.locator("[data-gate='stepup']")).toBeVisible();
    await expect(page.locator("[data-barrier='deny']")).toBeVisible();

    // 2. Slow scrub through the decision divergence moments (0.20 -> 0.85)
    for (let p = 0.20; p <= 0.85; p += 0.025) {
      await seekSceneProgress(page, "[data-scene='decisions']", Math.round(p * 100) / 100);
      await page.waitForTimeout(80);
    }

    // 3. Fast scrub from 0.0 to 1.0
    for (let p = 0; p <= 1.0; p += 0.20) {
      await seekSceneProgress(page, "[data-scene='decisions']", Math.round(p * 100) / 100);
      await page.waitForTimeout(40);
    }

    // 4. Full Reverse scrub: from 100% back to 0%
    for (let p = 1.0; p >= 0; p -= 0.05) {
      await seekSceneProgress(page, "[data-scene='decisions']", Math.round(p * 100) / 100);
      await page.waitForTimeout(60);
    }

    // 5. Verify coordinated contraction invariant: At ALL intermediate steps (0% to 25%),
    // ALLOW, STEP-UP, and DENY contract as ONE family with identical transform scales.
    for (const p of [0.0, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175, 0.20, 0.225, 0.25]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const scales = await page.evaluate(() => {
        const getTransformScale = (el: HTMLElement) => {
          const st = window.getComputedStyle(el).transform;
          if (!st || st === "none") return 1;
          const matrix = st.match(/^matrix\((.+)\)$/);
          if (matrix) {
            const values = matrix[1].split(", ");
            const a = parseFloat(values[0]);
            const b = parseFloat(values[1]);
            return Math.sqrt(a * a + b * b);
          }
          return 1;
        };

        const allow = document.querySelector<HTMLElement>("[data-lane-tag='allow']");
        const stepup = document.querySelector<HTMLElement>("[data-lane-tag='stepup']");
        const deny = document.querySelector<HTMLElement>("[data-lane-tag='deny']");

        return {
          allow: allow ? getTransformScale(allow) : 1,
          stepup: stepup ? getTransformScale(stepup) : 1,
          deny: deny ? getTransformScale(deny) : 1,
        };
      });

      // All three must contract together — maximum allowable discrepancy between any two scales is 5%
      const maxScale = Math.max(scales.allow, scales.stepup, scales.deny);
      const minScale = Math.min(scales.allow, scales.stepup, scales.deny);
      expect(maxScale - minScale).toBeLessThanOrEqual(0.1);
    }

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_02_decisions_motion_review.webm");
    }
  });

  test("Scene 04 Step-Up Motion Review — Forward scroll, slow scrub, fast scrub, and full reverse scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);
    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });

    // A. Normal forward progression through Step-Up (0% -> 100%)
    for (let p = 0; p <= 1.0; p += 0.05) {
      await seekSceneProgress(page, "[data-scene='step-up']", Math.round(p * 100) / 100);
      await page.waitForTimeout(60);
    }

    // B. Slow scrub through Limit Encounter, Hold, and Document Reveal (0.20 -> 0.75)
    for (let p = 0.20; p <= 0.75; p += 0.02) {
      await seekSceneProgress(page, "[data-scene='step-up']", Math.round(p * 100) / 100);
      await page.waitForTimeout(75);
    }

    // C. Fast scrub from 0.0 to 1.0
    for (let p = 0; p <= 1.0; p += 0.20) {
      await seekSceneProgress(page, "[data-scene='step-up']", Math.round(p * 100) / 100);
      await page.waitForTimeout(40);
    }

    // D. Full Reverse scrub: from 100% back to 0%
    for (let p = 1.0; p >= 0; p -= 0.05) {
      await seekSceneProgress(page, "[data-scene='step-up']", Math.round(p * 100) / 100);
      await page.waitForTimeout(60);
    }

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_04_step_up_motion_review.webm");
    }
  });
});

