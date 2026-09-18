import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { prepareVisualPage } from "./helpers/scene-checkpoints";
import { readOwnership } from "./helpers/ownership";

/**
 * Verifies the single-owner cinematic video transition layer
 * (CinematicTransitionLayer + transition-registry + transition-math):
 * scroll-position -> video.currentTime determinism, exactly seven video
 * boundaries with none at 07->08, bypass paths (mobile / reduced motion /
 * direct nav / failed media), and that the layer never steals interaction.
 */

async function scrollToBoundaryProgress(page: Page, id: string, progress: number) {
  return page.evaluate(
    ({ id, progress }) => {
      const el = document.querySelector<HTMLElement>(`[data-transition-track='${id}']`);
      if (!el) throw new Error(`Missing transition track: ${id}`);
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const start = top - 64;
      const end = top + rect.height + 64;
      const y = start + progress * (end - start);
      window.scrollTo(0, y);
      (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      return y;
    },
    { id, progress },
  );
}

function readVideo(page: Page, id: string) {
  return page.evaluate(
    (id) => {
      const v = document.querySelector<HTMLVideoElement>(`[data-transition-video='${id}']`);
      if (!v) return null;
      const cs = window.getComputedStyle(v);
      return {
        opacity: parseFloat(cs.opacity),
        pointerEvents: cs.pointerEvents,
        currentTime: v.currentTime,
        duration: v.duration,
        paused: v.paused,
        muted: v.muted,
        controls: v.controls,
      };
    },
    id,
  );
}

test.describe("Cinematic transition registry", () => {
  test("exactly seven boundaries, none for 07->08", async ({ page }) => {
    await prepareVisualPage(page);
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-transition-track]")).map(
        (el) => (el as HTMLElement).dataset.transitionTrack,
      ),
    );
    expect(ids).toHaveLength(7);
    expect(ids).toEqual([
      "00-01",
      "01-02",
      "02-03",
      "03-04",
      "04-05",
      "05-06",
      "06-07",
    ]);
    expect(ids).not.toContain("07-08");

    // Videos mirror the tracks 1:1.
    const videoIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-transition-video]")).map(
        (el) => (el as HTMLElement).dataset.transitionVideo,
      ),
    );
    expect(videoIds).toHaveLength(7);
  });

  test("videos are paused, muted, controls-less, and never intercept pointer events", async ({ page }) => {
    await prepareVisualPage(page);
    const boundaryIds = ["00-01", "01-02", "02-03", "03-04", "04-05", "05-06", "06-07"];
    for (const id of boundaryIds) {
      const v = await readVideo(page, id);
      expect(v, id).not.toBeNull();
      expect(v!.paused, id).toBe(true);
      expect(v!.muted, id).toBe(true);
      expect(v!.controls, id).toBe(false);
      expect(v!.pointerEvents, id).toBe("none");
    }
  });
});

const MOBILE_PROJECTS = new Set(["430x932", "390x844"]);

test.describe("Scroll-driven scrub determinism", () => {
  test("progress maps linearly to video.currentTime, forward and reverse", async ({ page }, testInfo) => {
    test.skip(
      MOBILE_PROJECTS.has(testInfo.project.name),
      "Mobile intentionally bypasses the video layer (responsive policy) — scrub determinism is a desktop/tablet concern.",
    );
    await prepareVisualPage(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    // Warm the boundary's metadata (duration) before asserting exact times.
    await scrollToBoundaryProgress(page, "00-01", 0.01);
    await page.waitForFunction(() => {
      const v = document.querySelector<HTMLVideoElement>("[data-transition-video='00-01']");
      return !!v && v.duration > 0;
    });

    const samples = [0.1, 0.3, 0.5, 0.7, 0.9];
    for (const p of samples) {
      await scrollToBoundaryProgress(page, "00-01", p);
      await page.waitForTimeout(30);
      const v = await readVideo(page, "00-01");
      expect(v!.currentTime, `forward @ ${p}`).toBeCloseTo(p * v!.duration, 1);
    }

    // Reverse: must scrub backward smoothly, not snap to 0 or replay.
    const reverseSamples = [0.7, 0.5, 0.3, 0.55, 0.4];
    for (const p of reverseSamples) {
      await scrollToBoundaryProgress(page, "00-01", p);
      await page.waitForTimeout(30);
      const v = await readVideo(page, "00-01");
      expect(v!.currentTime, `reverse @ ${p}`).toBeCloseTo(p * v!.duration, 1);
    }
  });

  test("outgoing scene fully visible at progress 0, incoming scene fully visible at progress 1, video invisible at both edges", async ({ page }) => {
    await prepareVisualPage(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    await scrollToBoundaryProgress(page, "00-01", 0.0);
    await page.waitForTimeout(30);
    let o = await readOwnership(page);
    expect(o.visibleRootIds).toEqual(["prologue"]);
    let v = await readVideo(page, "00-01");
    expect(v!.opacity).toBeLessThan(0.05);

    await scrollToBoundaryProgress(page, "00-01", 1.0);
    await page.waitForTimeout(30);
    o = await readOwnership(page);
    expect(o.visibleRootIds).toEqual(["mandate"]);
    v = await readVideo(page, "00-01");
    expect(v!.opacity).toBeLessThan(0.05);
  });

  test("exactly one live scene owns the stage mid-transition (video fully occludes both)", async ({ page }, testInfo) => {
    test.skip(
      MOBILE_PROJECTS.has(testInfo.project.name),
      "Mobile intentionally bypasses the video layer (responsive policy) — no video occlusion to assert.",
    );
    await prepareVisualPage(page);
    await scrollToBoundaryProgress(page, "00-01", 0.5);
    await page.waitForTimeout(30);
    const o = await readOwnership(page);
    expect(o.visibleRootCount).toBeLessThanOrEqual(1);
    const v = await readVideo(page, "00-01");
    expect(v!.opacity).toBeGreaterThan(0.9);
  });
});

test.describe("Bypass paths", () => {
  test("navbar direct navigation bypasses the video layer entirely", async ({ page }, testInfo) => {
    await prepareVisualPage(page);
    if (MOBILE_PROJECTS.has(testInfo.project.name)) {
      await page.getByRole("button", { name: "CONTROL INDEX" }).click();
      await page.locator("[data-mobile-chapter]", { hasText: "REVOCATION" }).click();
    } else {
      await page.getByRole("button", { name: "05 REVOCATION" }).click();
    }
    await page.waitForTimeout(100);

    const opacities = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLVideoElement>("[data-transition-video]")).map(
        (v) => parseFloat(getComputedStyle(v).opacity) || 0,
      ),
    );
    for (const opacity of opacities) {
      expect(opacity).toBeLessThan(0.05);
    }
    const o = await readOwnership(page);
    expect(o.visibleRootIds).toEqual(["revocation"]);
  });

  test("prefers-reduced-motion bypasses scrubbing: video stays invisible across the whole boundary", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepareVisualPage(page);

    for (const p of [0.1, 0.5, 0.9]) {
      await scrollToBoundaryProgress(page, "00-01", p);
      await page.waitForTimeout(30);
      const v = await readVideo(page, "00-01");
      expect(v!.opacity, `reduced-motion @ ${p}`).toBeLessThan(0.05);
    }
  });

  test("a boundary whose video fails to load falls back to a clean cut without trapping scroll", async ({ page }) => {
    await page.route("**/00-01-opening-mandate.mp4", (route) => route.fulfill({ status: 404 }));
    await prepareVisualPage(page);

    await scrollToBoundaryProgress(page, "00-01", 0.5);
    await page.waitForTimeout(200);

    const v = await readVideo(page, "00-01");
    expect(v!.opacity).toBeLessThan(0.05);

    // Scroll must still work past the failed boundary.
    await scrollToBoundaryProgress(page, "00-01", 1.0);
    await page.waitForTimeout(50);
    const o = await readOwnership(page);
    expect(o.visibleRootIds).toEqual(["mandate"]);
  });
});
