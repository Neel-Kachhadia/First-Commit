import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_TRANSPORT_PARAMS } from "../../src/lib/experience/transition-transport";

/**
 * Cinematic transition transport wired to REAL Lenis wheel input, through the dev-only hook
 * `window.__kpMotion`. Pure controller logic lives in scroll-transport.spec.ts.
 */

const P = DEFAULT_TRANSPORT_PARAMS;
const MAX_ACCEL = Math.max(P.accel, P.decel, P.stopDecel ?? P.decel, P.reverseDecel ?? P.decel);
const DESKTOP = new Set(["1920x1080", "1440x900", "1366x768"]);
const MOBILE = new Set(["430x932", "390x844"]);

type Snap = {
  id: string;
  engaged: boolean;
  presented: number;
  target: number;
  velocity: number;
  settled: boolean;
  desiredTime: number;
  requestedTime: number | null;
  currentTime: number | null;
  writes: number;
};
type MotionHook = {
  enabled: () => boolean;
  snapshot: () => Snap[];
  record: (on: boolean) => void;
  frames: () => Array<Record<string, number | string | null>>;
};

async function openLive(page: Page, query = "?intro=0") {
  await page.goto(`/${query}`, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as { __kpMotion?: unknown }).__kpMotion) && document.querySelectorAll("[data-transition-track]").length === 7,
  );
  await page.waitForTimeout(600);
}
const snap = (page: Page) => page.evaluate(() => (window as unknown as { __kpMotion: MotionHook }).__kpMotion.snapshot());

async function jumpInto(page: Page, index: number, progress: number) {
  await page.evaluate(
    ({ index, progress }) => {
      const el = document.querySelectorAll("[data-transition-track]")[index];
      const st = (window as unknown as { ScrollTrigger: { getAll: () => Array<{ trigger: Element; start: number; end: number }> } }).ScrollTrigger.getAll().find((t) => t.trigger === el)!;
      window.scrollTo(0, st.start + (st.end - st.start) * progress);
    },
    { index, progress },
  );
  await page.waitForTimeout(500);
}

async function waitFilmReady(page: Page, index: number) {
  await page.waitForFunction(
    (i) => {
      const v = document.querySelectorAll<HTMLVideoElement>("[data-transition-video]")[i];
      return !!v && v.duration > 0 && v.buffered.length > 0 && v.buffered.end(v.buffered.length - 1) >= v.duration - 0.2;
    },
    index,
    { timeout: 30_000 },
  );
}

async function wheelThrough(page: Page, deltas: number[], gapMs: number) {
  await page.mouse.move(400, 300);
  await page.evaluate(() => (window as unknown as { __kpMotion: MotionHook }).__kpMotion.record(true));
  for (const dy of deltas) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(gapMs);
  }
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const m = (window as unknown as { __kpMotion: MotionHook }).__kpMotion;
    m.record(false);
    return m.frames();
  });
}

test.describe("Browser: engagement matrix", () => {
  test("desktop with Lenis: transport engaged; ?visualTest=1 and ?transport=off: passthrough", async ({ page }, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
    await openLive(page);
    expect(await page.evaluate(() => (window as unknown as { __kpMotion: MotionHook }).__kpMotion.enabled())).toBe(true);
    await openLive(page, "?intro=0&visualTest=1");
    expect(await page.evaluate(() => (window as unknown as { __kpMotion: MotionHook }).__kpMotion.enabled())).toBe(false);
    await openLive(page, "?intro=0&transport=off");
    expect(await page.evaluate(() => (window as unknown as { __kpMotion: MotionHook }).__kpMotion.enabled())).toBe(false);
  });

  test("mobile: no boundary is ever engaged and nothing is fetched (bypass unchanged)", async ({ page }, testInfo) => {
    test.skip(!MOBILE.has(testInfo.project.name), "mobile projects only");
    const requests: string[] = [];
    page.on("request", (r) => {
      if (/transitions\/.*\.mp4/.test(r.url())) requests.push(r.url());
    });
    await openLive(page);
    await jumpInto(page, 1, 0.5);
    expect((await snap(page)).every((s) => !s.engaged)).toBe(true);
    expect(requests).toHaveLength(0);
  });

  test("prefers-reduced-motion: no boundary engaged, no media fetched", async ({ page }, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests: string[] = [];
    page.on("request", (r) => {
      if (/transitions\/.*\.mp4/.test(r.url())) requests.push(r.url());
    });
    await openLive(page);
    await jumpInto(page, 1, 0.5);
    expect((await snap(page)).every((s) => !s.engaged)).toBe(true);
    expect(requests).toHaveLength(0);
  });
});

test.describe("Browser: wheel through a boundary (real Lenis input)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
  });

  test("a violent flick never exceeds vMax / accel / gap, never plays the video, and the film lands home", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __plays: number }).__plays = 0;
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        (window as unknown as { __plays: number }).__plays += 1;
        return orig.apply(this, args);
      };
    });
    await openLive(page);
    await jumpInto(page, 1, 0.0);
    await waitFilmReady(page, 1);
    const frames = await wheelThrough(page, Array.from({ length: 16 }, () => 400), 25);
    const f = frames.filter((x) => x.id === "01-02");
    expect(f.length).toBeGreaterThan(10);
    const maxV = Math.max(...f.map((x) => Math.abs(x.velocity as number)));
    const maxA = Math.max(...f.map((x) => Math.abs(x.acceleration as number)));
    const maxGap = Math.max(...f.map((x) => Math.abs(x.gap as number)));
    expect(maxV).toBeLessThanOrEqual(P.vMax + 1e-6);
    expect(maxA).toBeLessThanOrEqual(MAX_ACCEL * 1.001 + 1e-6);
    expect(maxGap).toBeLessThanOrEqual(P.gapMax + 0.01);
    expect(await page.evaluate(() => (window as unknown as { __plays: number }).__plays)).toBe(0);
    expect(await page.evaluate(() => document.querySelector<HTMLVideoElement>("[data-transition-video='01-02']")!.paused)).toBe(true);
    expect((await snap(page)).find((s) => s.id === "01-02")!.settled).toBe(true);
  });

  test("stopping mid-transition: the playhead becomes exactly still on the target (no autoplay)", async ({ page }) => {
    await openLive(page);
    await jumpInto(page, 1, 0.1);
    await waitFilmReady(page, 1);
    await wheelThrough(page, [100, 100, 100, 100, 100], 60);
    const a = (await snap(page)).find((s) => s.id === "01-02")!;
    await page.waitForTimeout(500);
    const b = (await snap(page)).find((s) => s.id === "01-02")!;
    expect(a.settled).toBe(true);
    expect(b.presented).toBe(a.presented);
    expect(b.currentTime).toBe(a.currentTime);
    expect(a.presented).toBe(a.target);
  });

  test("forward then reverse: velocity passes through zero, no sign snap", async ({ page }) => {
    await openLive(page);
    await jumpInto(page, 1, 0.2);
    await waitFilmReady(page, 1);
    const frames = await wheelThrough(page, [...Array.from({ length: 7 }, () => 100), ...Array.from({ length: 9 }, () => -100)], 70);
    const rows = frames.filter((x) => x.id === "01-02");
    const v = rows.map((x) => x.velocity as number);
    const t = rows.map((x) => x.t as number);
    const landed = rows.map((x) => x.presented === x.target); // a frame that lands on its target ends the motion in one step (no-overshoot rule)
    expect(Math.max(...v)).toBeGreaterThan(0.1);
    expect(Math.min(...v)).toBeLessThan(-0.1);
    for (let i = 1; i < v.length; i += 1) {
      const dt = (t[i] - t[i - 1]) / 1000;
      if (dt <= 0 || landed[i]) continue;
      expect(Math.abs(v[i] - v[i - 1])).toBeLessThanOrEqual(MAX_ACCEL * Math.min(dt, P.maxDt) * 1.001 + 1e-6);
    }
  });

  test("oscillating around the start and end lines never reloads the source or changes the tier", async ({ page }) => {
    await openLive(page);
    await jumpInto(page, 1, 0.03);
    await waitFilmReady(page, 1);
    const read = () =>
      page.evaluate(() => {
        const v = document.querySelector<HTMLVideoElement>("[data-transition-video='01-02']")!;
        return { src: v.currentSrc, tier: v.dataset.transitionTier };
      });
    const before = await read();
    await wheelThrough(page, Array.from({ length: 24 }, (_, i) => (i % 2 ? -60 : 60)), 70);
    await jumpInto(page, 1, 0.97);
    await wheelThrough(page, Array.from({ length: 24 }, (_, i) => (i % 2 ? -60 : 60)), 70);
    expect(await read()).toEqual(before);
  });
});
