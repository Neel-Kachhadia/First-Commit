import { expect, test, type Page } from "@playwright/test";
import {
  TRANSITION_SEAMS,
  insetToClipPath,
  poseAtViewport,
  seamOpacity,
  seamPoseAt,
  smootherstep,
} from "../../src/lib/experience/transition-seam";
import { TRANSITION_REGISTRY, TRANSITION_OVERLAP_PX } from "../../src/lib/experience/transition-registry";

/**
 * Zero-snap endpoint convergence: the film is presented through a small scroll-driven
 * similarity transform so its first/last frame coincide with the live scenes.
 * Part 1: pure model (no browser). Part 2: applied geometry in the real layer.
 */

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];
const overlapFor = (vh: number, trackVh: number) => TRANSITION_OVERLAP_PX / ((trackVh / 100) * vh + 128);

test.describe("Seam model (pure)", () => {
  test("smootherstep has zero slope at both ends and is monotone", () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    const eps = 1e-4;
    expect((smootherstep(eps) - smootherstep(0)) / eps).toBeLessThan(1e-3);
    expect((smootherstep(1) - smootherstep(1 - eps)) / eps).toBeLessThan(1e-3);
    let prev = -1;
    for (let i = 0; i <= 100; i += 1) {
      const v = smootherstep(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  test("every boundary has a well-formed table: ascending widths, sane poses, windows inside [0,1]", () => {
    for (const b of TRANSITION_REGISTRY) {
      const seam = TRANSITION_SEAMS[b.id];
      expect(seam, b.id).toBeTruthy();
      const widths = seam.samples.map((s) => s.width);
      expect(widths, b.id).toEqual([...widths].sort((x, y) => x - y));
      for (const s of seam.samples) {
        for (const p of [s.start, s.end]) {
          expect(Number.isFinite(p.scale + p.x + p.y)).toBe(true);
          expect(p.scale).toBeGreaterThanOrEqual(0.6);
          expect(p.scale).toBeLessThanOrEqual(1.3);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(100);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(100);
        }
      }
      expect(seam.relax[0]).toBeGreaterThanOrEqual(0);
      expect(seam.relax[1]).toBeLessThan(0.5);
      expect(seam.converge[0]).toBeGreaterThan(0.5);
      expect(seam.converge[1]).toBeLessThanOrEqual(1);
    }
  });

  test("interpolation is exact at samples, continuous between, and follows scale*width ~ const beyond the range", () => {
    for (const b of TRANSITION_REGISTRY) {
      const { samples } = TRANSITION_SEAMS[b.id];
      for (const s of samples) {
        for (const key of ["start", "end"] as const) {
          const p = poseAtViewport(samples, key, { width: s.width, height: s.height });
          expect(p.scale).toBeCloseTo(s[key].scale, 6);
          expect(p.x).toBeCloseTo(s[key].x, 4);
          expect(p.y).toBeCloseTo(s[key].y, 4);
        }
      }
      // continuity across the whole width range: no jump between neighbouring widths
      let prev = poseAtViewport(samples, "end", { width: 1200, height: 800 });
      for (let w = 1201; w <= 2800; w += 1) {
        const cur = poseAtViewport(samples, "end", { width: w, height: 800 });
        expect(Math.abs(cur.scale - prev.scale)).toBeLessThan(0.004);
        prev = cur;
      }
      // beyond the widest sample the layout law keeps scale * width constant
      const last = samples[samples.length - 1];
      const wide = poseAtViewport(samples, "end", { width: 2560, height: 1440 });
      expect(wide.scale * 2560).toBeCloseTo(Math.min(1.6, Math.max(0.5, last.end.scale * last.width * (2560 / 2560))), 0);
    }
  });

  test("pose is a continuous function of progress everywhere (no snap) and is 0-velocity at the seam ends", () => {
    for (const b of TRANSITION_REGISTRY) {
      const seam = TRANSITION_SEAMS[b.id];
      for (const vp of VIEWPORTS) {
        const ov = overlapFor(vp.height, b.trackVh);
        let prev = seamPoseAt(seam, 0, vp, ov);
        let maxStep = 0;
        for (let i = 1; i <= 4000; i += 1) {
          const p = i / 4000;
          const cur = seamPoseAt(seam, p, vp, ov);
          maxStep = Math.max(maxStep, Math.abs(cur.scale - prev.scale), Math.abs(cur.x - prev.x) / vp.width, Math.abs(cur.y - prev.y) / vp.height);
          prev = cur;
        }
        expect(maxStep, `${b.id} @${vp.width}`).toBeLessThan(0.006); // per 0.025% progress
        // zero velocity where the film hands over to / takes over from the live DOM
        const d = 1e-4;
        for (const p of [1 - ov, 1 - ov * 1.5, ov, ov * 1.5]) {
          const a = seamPoseAt(seam, p - d, vp, ov);
          const c = seamPoseAt(seam, p + d, vp, ov);
          expect(Math.abs(c.scale - a.scale) / (2 * d), `${b.id} @${vp.width} p=${p}`).toBeLessThan(0.02);
        }
      }
    }
  });

  test("terminal hold is static: identical pose from convergence end to the start of release, and start pose held until fully opaque", () => {
    for (const b of TRANSITION_REGISTRY) {
      const seam = TRANSITION_SEAMS[b.id];
      for (const vp of VIEWPORTS) {
        const ov = overlapFor(vp.height, b.trackVh);
        const convergeTo = Math.min(seam.converge[1], 1 - ov);
        const holdA = seamPoseAt(seam, convergeTo, vp, ov);
        const holdB = seamPoseAt(seam, 1 - ov, vp, ov);
        expect(holdB.scale).toBeCloseTo(holdA.scale, 9);
        expect(holdB.x).toBeCloseTo(holdA.x, 6);
        expect(holdB.y).toBeCloseTo(holdA.y, 6);
        const s0 = seamPoseAt(seam, 0, vp, ov);
        const sOpaque = seamPoseAt(seam, ov, vp, ov);
        expect(sOpaque.scale).toBeCloseTo(s0.scale, 9);
      }
    }
  });

  test("opacity: 0 at both ends, fully opaque between the overlaps (film covers the DOM swap), symmetric ramps", () => {
    for (const ov of [0.02, 0.028, 0.038]) {
      expect(seamOpacity(0, ov)).toBe(0);
      expect(seamOpacity(1, ov)).toBe(0);
      for (let p = ov; p <= 1 - ov + 1e-9; p += 0.001) expect(seamOpacity(p, ov)).toBeCloseTo(1, 9);
      for (let i = 0; i <= 20; i += 1) {
        const t = (i / 20) * ov;
        expect(seamOpacity(t, ov)).toBeCloseTo(seamOpacity(1 - t, ov), 9);
      }
      let prev = 0;
      for (let p = 0; p <= ov; p += ov / 50) {
        const v = seamOpacity(p, ov);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = v;
      }
    }
  });

  test("clip-path helper", () => {
    expect(insetToClipPath(null)).toBe("none");
    expect(insetToClipPath({ top: 11, right: 0, bottom: 7, left: 0 })).toBe("inset(11.000% 0.000% 7.000% 0.000%)");
  });
});

/* ------------------------------------------------------------ browser */
const DESKTOP = new Set(["1920x1080", "1440x900", "1366x768"]);

async function open(page: Page, query = "") {
  await page.goto(`/?intro=0&visualTest=1${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!(window as unknown as { __kpTransitionQuality?: unknown }).__kpTransitionQuality);
  await page.evaluate(() => document.fonts.ready);
}
async function go(page: Page, id: string, p: number) {
  await page.evaluate(
    ({ id, p }) => {
      const sp = document.querySelector<HTMLElement>(`[data-transition-track='${id}']`)!;
      const tr = (window as unknown as { ScrollTrigger: { getAll: () => Array<{ trigger?: Element; vars: { scrub?: unknown }; start: number; end: number }>; update: () => void } }).ScrollTrigger
        .getAll()
        .find((t) => t.trigger === sp && t.vars.scrub)!;
      window.scrollTo(0, Math.round(tr.start + (tr.end - tr.start) * p));
      (window as unknown as { ScrollTrigger: { update: () => void } }).ScrollTrigger.update();
    },
    { id, p },
  );
}
const overlapFrac = (page: Page, id: string) => page.evaluate((id) => 64 / (document.querySelector<HTMLElement>(`[data-transition-track='${id}']`)!.offsetHeight + 128), id);
const rects = (page: Page, id: string) => page.evaluate((id) => (window as unknown as { __kpTransitionQuality: { videoRects: (id: string) => { native: { width: number; height: number }; presented: { x: number; y: number; width: number; height: number } } | null } }).__kpTransitionQuality.videoRects(id), id);
const opacityOf = (page: Page, id: string) => page.evaluate((id) => parseFloat(getComputedStyle(document.querySelector(`[data-transition-video='${id}']`)!).opacity), id);

test.describe("Applied geometry in the real layer", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
  });

  for (const id of ["04-05", "05-06", "06-07"]) {
    test(`${id}: at the terminal hold the presented film has the modelled scale about the viewport centre`, async ({ page }) => {
      await open(page, "&transitionQuality=standard");
      const ov = await overlapFrac(page, id);
      await go(page, id, 0.5);
      await page.waitForFunction((id) => (document.querySelector<HTMLVideoElement>(`[data-transition-video='${id}']`)?.duration ?? 0) > 0, id);
      await go(page, id, 1 - ov * 1.5);
      await page.waitForTimeout(150);
      const pose = await page.evaluate(({ id, p }) => (window as unknown as { __kpTransitionQuality: { seamPose: (id: string, p: number) => { scale: number; x: number; y: number } } }).__kpTransitionQuality.seamPose(id, p), { id, p: 1 - ov * 1.5 });
      const r = await rects(page, id);
      const vw = page.viewportSize()!.width;
      const vh = page.viewportSize()!.height;
      expect(r!.presented.width).toBeCloseTo(vw * pose.scale, 0);
      expect(r!.presented.height).toBeCloseTo(vh * pose.scale, 0);
      expect(r!.presented.x + r!.presented.width / 2).toBeCloseTo(vw / 2 + pose.x, 0);
      expect(r!.presented.y + r!.presented.height / 2).toBeCloseTo(vh / 2 + pose.y, 0);
      expect(await opacityOf(page, id)).toBeGreaterThan(0.99); // opaque until the incoming DOM is under it
    });

    test(`${id}: forward and reverse give the identical presentation at the same progress (pure function of scroll)`, async ({ page }) => {
      await open(page, "&transitionQuality=standard");
      await go(page, id, 0.5);
      await page.waitForFunction((id) => (document.querySelector<HTMLVideoElement>(`[data-transition-video='${id}']`)?.duration ?? 0) > 0, id);
      const probe = [0.02, 0.08, 0.85, 0.9, 0.93];
      const forward: Array<unknown> = [];
      for (const p of probe) {
        await go(page, id, p);
        await page.waitForTimeout(40);
        forward.push(await rects(page, id));
      }
      const reverse: Array<unknown> = [];
      for (const p of [...probe].reverse()) {
        await go(page, id, p);
        await page.waitForTimeout(40);
        reverse.unshift(await rects(page, id));
      }
      expect(reverse).toEqual(forward);
    });
  }

  test("seam calibration can be switched off for BEFORE comparisons (dev only) and then presents native geometry", async ({ page }) => {
    await open(page, "&transitionQuality=standard&transitionSeam=off");
    await go(page, "06-07", 0.5);
    await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-transition-video='06-07']")?.duration ?? 0) > 0);
    const ov = await overlapFrac(page, "06-07");
    await go(page, "06-07", 1 - ov * 1.5);
    await page.waitForTimeout(120);
    const r = await rects(page, "06-07");
    expect(r!.presented.width).toBeCloseTo(page.viewportSize()!.width, 0);
  });

  test("the film's pose is identical for FALLBACK, STANDARD and HIGH (the source resolution never changes the landing geometry)", async ({ page }) => {
    const seen: Record<string, unknown> = {};
    for (const tier of ["fallback", "standard", "high"]) {
      await open(page, `&transitionQuality=${tier}`);
      await go(page, "05-06", 0.5);
      await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-transition-video='05-06']")?.duration ?? 0) > 0);
      const ov = await overlapFrac(page, "05-06");
      await go(page, "05-06", 1 - ov * 1.5);
      await page.waitForTimeout(150);
      seen[tier] = await rects(page, "05-06");
    }
    expect(seen.fallback).toEqual(seen.standard);
    expect(seen.high).toEqual(seen.standard);
  });

  test("mobile / reduced motion: no seam work, no film", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1440x900", "one desktop project is enough");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await go(page, "06-07", 0.95);
    await page.waitForTimeout(150);
    expect(await opacityOf(page, "06-07")).toBeLessThan(0.05);
  });
});
