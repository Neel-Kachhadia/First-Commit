import { expect, test, type Page } from "@playwright/test";
import {
  CAUSAL_REPLAY_STAGE_COUNT,
  CAUSAL_REPLAY_STAGE_WINDOWS,
  REPLAY_HOLD_FRACTION,
  REPLAY_UV_PER_WORLD_UNIT,
  exposureState,
  filmShiftRepeats,
  replayFrame,
  transportDistanceAt,
} from "../../src/lib/experience/causal-replay";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

// Scene 08 — Causal Replay. ONE authoritative progress value (scroll) drives the DOM evidence and the
// WebGL film transport through the same schedule (`replayFrame`), so they can never disagree:
//   hold  -> a physical frame sits in the gate, reels/rollers/film are stationary, one exposure is on the gate;
//   advance -> film, reels and rollers move together by one frame and the card hands over at the half-way point.

const SCENE = "[data-scene='causal-replay']";
const SUPPLY_R = 1.32;
const TAKEUP_R = 0.75;
const windows = CAUSAL_REPLAY_STAGE_WINDOWS;
const holdEnd = (i: number) => windows[i][0] + (windows[i][1] - windows[i][0]) * REPLAY_HOLD_FRACTION;
const midHold = (i: number) => windows[i][0] + (holdEnd(i) - windows[i][0]) * 0.5;
const midAdvance = (i: number) => holdEnd(i) + (windows[i][1] - holdEnd(i)) * 0.35;

type Diag = {
  p: number;
  frame: number;
  shiftRepeats: number;
  supplyRot: number;
  takeupRot: number;
  rollerRot: number[];
  filmOffset: number;
  reveal: number;
  visible: boolean;
};
const diag = (page: Page) => page.evaluate(() => (window as unknown as { __kpReplay?: Diag }).__kpReplay ?? null);

async function exposureWeights(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-evidence-exposure]")).map((el) => {
      const cs = getComputedStyle(el);
      return cs.visibility === "hidden" ? 0 : Number(cs.opacity);
    }),
  );
}
const owners = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"))
      .filter((el) => getComputedStyle(el).visibility === "visible")
      .map((el) => el.dataset.scene),
  );
// Seek, then let the scrub + on-demand WebGL render settle (a fresh page can lag its first frame).
const seek = async (page: Page, p: number) => {
  await seekSceneProgress(page, SCENE, p);
  await page.waitForTimeout(150);
};
// Desktop only: wait until the WebGL transport has been created and has applied a frame.
const webglReady = async (page: Page) => {
  await seek(page, 0.2);
  await expect.poll(async () => (await diag(page)) !== null, { timeout: 30_000 }).toBe(true);
};
// Fresh pages can still be re-measuring layout: refresh triggers once so seeks land where computed.
const prepare = async (page: Page) => {
  await prepareVisualPage(page);
  await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { ScrollTrigger: { refresh: () => void } }).ScrollTrigger.refresh());
  await page.waitForTimeout(250);
};
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) <= 768;

test.describe("Scene 08 — schedule (pure)", () => {
  test("holds are stationary, advances are monotone, one exposure at a time, film lands a frame per step", () => {
    for (let i = 0; i < CAUSAL_REPLAY_STAGE_COUNT; i += 1) {
      const a = windows[i][0];
      const h = holdEnd(i);
      const shifts = [a, (a + h) / 2, h].map((p) => filmShiftRepeats(replayFrame(p)));
      expect(new Set(shifts.map((v) => v.toFixed(9))).size, `window ${i}: film stationary through the hold`).toBe(1);
      expect(replayFrame(midHold(i))).toBe(i);
      if (i < CAUSAL_REPLAY_STAGE_COUNT - 1) {
        let prev = replayFrame(h);
        for (let k = 1; k <= 20; k += 1) {
          const p = h + ((windows[i][1] - h) * k) / 20;
          const f = replayFrame(p);
          expect(f, `window ${i}: film only ever advances`).toBeGreaterThanOrEqual(prev);
          prev = f;
        }
        expect(replayFrame(windows[i][1])).toBeCloseTo(i + 1, 9);
      }
    }
    // Every exposure is reachable, and at most one is visible at any instant (no ghosting).
    for (let k = 0; k <= 4000; k += 1) {
      const f = replayFrame(k / 4000);
      const w = Array.from({ length: CAUSAL_REPLAY_STAGE_COUNT }, (_, i) => exposureState(i, f).weight);
      expect(w.filter((v) => v > 0).length, `f=${f}`).toBeLessThanOrEqual(1);
    }
    // Film travel is derived from real frame pitch: 7 advances, alternating pitches.
    const total = filmShiftRepeats(CAUSAL_REPLAY_STAGE_COUNT - 1);
    expect(total).toBeGreaterThan(3.3);
    expect(total).toBeLessThan(3.5);
    // Transport stops entirely at the terminal.
    expect(transportDistanceAt(0.97)).toBe(transportDistanceAt(1));
    expect(transportDistanceAt(0)).toBe(0);
  });
});

test.describe("Scene 08 — DOM and WebGL move as one mechanism", () => {
  // Software-GL contexts contend when several projects run at once; retries absorb context-creation flakes.
  test.describe.configure({ mode: "serial", retries: 2 });

  test("at every hold: the right exposure is on the gate and reels, rollers and film are exactly where the schedule says", async ({ page }) => {
    test.skip(isMobile(page), "the WebGL replay apparatus is not rendered on mobile");
    await prepare(page);
    await webglReady(page);

    let firstOffset: number | null = null;
    for (let i = 0; i < CAUSAL_REPLAY_STAGE_COUNT; i += 1) {
      await seek(page, midHold(i));
      const d = await diag(page);
      expect(d, `WebGL transport diagnostics at hold ${i}`).not.toBeNull();
      const w = await exposureWeights(page);
      expect(w[i], `exposure ${i} seated on the gate`).toBeGreaterThan(0.99);
      expect(w.filter((v) => v > 0.01).length, "exactly one exposure on the gate").toBe(1);
      expect(d!.frame).toBeCloseTo(i, 6);
      expect(d!.shiftRepeats).toBeCloseTo(filmShiftRepeats(i), 6);
      const dist = filmShiftRepeats(i) / REPLAY_UV_PER_WORLD_UNIT;
      expect(d!.supplyRot).toBeCloseTo(-dist / SUPPLY_R, 5);
      expect(d!.takeupRot).toBeCloseTo(-dist / TAKEUP_R, 5);
      d!.rollerRot.forEach((r, idx) => expect(Math.abs(r)).toBeCloseTo((dist / 0.065) * 1, 3 + 0 * idx));
      if (firstOffset === null) firstOffset = d!.filmOffset;
      // Film offset (texture travel) equals the frame-0 offset minus the schedule's travel.
      expect(d!.filmOffset).toBeCloseTo(firstOffset - filmShiftRepeats(i), 6);
    }
  });

  test("no transport during a hold; reels, rollers and film all move together during an advance", async ({ page }) => {
    test.skip(isMobile(page), "the WebGL replay apparatus is not rendered on mobile");
    await prepare(page);
    await webglReady(page);

    for (const i of [0, 3, 6]) {
      const holdA = windows[i][0] + (holdEnd(i) - windows[i][0]) * 0.15;
      const holdB = windows[i][0] + (holdEnd(i) - windows[i][0]) * 0.85;
      await seek(page, holdA);
      const a = (await diag(page))!;
      await seek(page, holdB);
      const b = (await diag(page))!;
      expect(b.supplyRot, `supply reel still during hold ${i}`).toBe(a.supplyRot);
      expect(b.takeupRot, `take-up reel still during hold ${i}`).toBe(a.takeupRot);
      expect(b.filmOffset, `film still during hold ${i}`).toBe(a.filmOffset);
      expect(b.rollerRot, `rollers still during hold ${i}`).toEqual(a.rollerRot);

      await seek(page, midAdvance(i));
      const c = (await diag(page))!;
      expect(c.supplyRot, `supply reel turns during advance ${i}`).toBeLessThan(b.supplyRot);
      expect(c.takeupRot).toBeLessThan(b.takeupRot);
      expect(c.filmOffset).toBeLessThan(b.filmOffset);
      expect(Math.abs(c.rollerRot[0])).toBeGreaterThan(Math.abs(b.rollerRot[0]));
      // Reels turn in the same direction and by amounts proportional to their radii.
      const dSupply = c.supplyRot - b.supplyRot;
      const dTakeup = c.takeupRot - b.takeupRot;
      expect(dTakeup / dSupply).toBeCloseTo(SUPPLY_R / TAKEUP_R, 4);
      // Mid-advance the evidence card is handing over: at most one exposure is showing.
      const w = await exposureWeights(page);
      expect(w.filter((v) => v > 0.01).length).toBeLessThanOrEqual(1);
    }
  });

  test("reverse retraces DOM + WebGL state exactly", async ({ page }) => {
    test.skip(isMobile(page), "the WebGL replay apparatus is not rendered on mobile");
    await prepare(page);
    await webglReady(page);

    const stops = [0.05, 0.12, 0.19, midHold(0), midAdvance(0), midHold(2), midAdvance(3), midHold(5), midAdvance(6), midHold(7), 0.99];
    const snap = async (p: number) => {
      await seek(page, p);
      const d = (await diag(page))!;
      return { w: (await exposureWeights(page)).map((v) => Number(v.toFixed(3))), s: d.supplyRot, t: d.takeupRot, o: d.filmOffset, r: d.rollerRot };
    };
    const forward = [];
    for (const p of stops) forward.push(await snap(p));
    const reverse = [];
    for (const p of [...stops].reverse()) reverse.push(await snap(p));
    expect(reverse.reverse()).toEqual(forward);
  });

  test("no autonomous progression: state is frozen while scroll is still", async ({ page }) => {
    await prepare(page);
    for (const p of [0.1, 0.25, midAdvance(2), 0.5, 0.75, 0.9]) {
      await seek(page, p);
      const read = async () => ({ w: await exposureWeights(page), d: isMobile(page) ? null : await diag(page) });
      const before = await read();
      await page.waitForTimeout(1200);
      const after = await read();
      expect(after, `state stays put at p=${p}`).toEqual(before);
    }
  });

  test("terminal state is stable and complete", async ({ page }) => {
    await prepare(page);
    const sigs = [];
    for (const p of [0.97, 0.985, 1.0]) {
      await seek(page, p);
      const w = await exposureWeights(page);
      expect(w[CAUSAL_REPLAY_STAGE_COUNT - 1]).toBeGreaterThan(0.99);
      expect(w.filter((v) => v > 0.01).length).toBe(1);
      await expect(page.locator("[data-full-chain]")).toContainText("ONE OUTCOME. ONE UNBROKEN CAUSAL RECORD.");
      sigs.push(isMobile(page) ? null : (await diag(page))!.filmOffset);
    }
    expect(new Set(sigs).size, "transport does not move in the terminal hold").toBe(1);
  });
});

test.describe("Scene 08 — ownership, entrance, direct navigation, reduced motion", () => {
  test.describe.configure({ mode: "serial" });

  test("07 -> 08 is a clean ownership hand-off: no Scene 07 content leaks and Scene 08 establishes in order", async ({ page }) => {
    await prepare(page);
    for (const p of [0.01, 0.06, 0.2, 0.5, 0.97]) {
      await seek(page, p);
      expect(await owners(page), `stage owner at p=${p}`).toEqual(["causal-replay"]);
      const leaked = await page.evaluate(() =>
        ["concurrency"].flatMap((id) => {
          const el = document.querySelector<HTMLElement>(`[data-scene='${id}']`);
          return el && getComputedStyle(el).visibility !== "hidden" ? [id] : [];
        }),
      );
      expect(leaked, `Scene 07 must be gone at p=${p}`).toEqual([]);
    }
    // Entrance order: before the apparatus is up there is no evidence claim; the first exposure
    // seats only after the gate is registered.
    await seek(page, 0.02);
    expect((await exposureWeights(page)).every((v) => v === 0)).toBe(true);
    if (!isMobile(page)) {
      await seek(page, 0.09);
      const d = (await diag(page))!;
      expect(d.reveal).toBeGreaterThan(0.1);
      expect(d.reveal).toBeLessThan(0.95);
      await seek(page, 0.16);
      expect((await exposureWeights(page)).every((v) => v < 0.05), "no evidence before the aperture is established").toBe(true);
    }
    await seek(page, 0.21);
    expect((await exposureWeights(page))[0]).toBeGreaterThan(0.99);
  });

  test("direct navigation to #scene-08 initialises a valid Scene 08 (no Scene 07 anywhere)", async ({ page }) => {
    await page.goto("/?visualTest=1#scene-08", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector("[data-scene='causal-replay']")!).visibility === "visible",
      undefined,
      { timeout: 15_000 },
    );
    expect(await owners(page)).toEqual(["causal-replay"]);
    const w = await exposureWeights(page);
    expect(w.filter((v) => v > 0.01).length).toBe(1);
    await expect(page.locator("[data-replay-docket]")).toContainText("TX–1081");
    if (!isMobile(page)) expect((await diag(page))!.visible).toBe(true);
  });

  test("reduced motion: static apparatus, no WebGL transport, complete causal record", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?visualTest=1#scene-08", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector("[data-scene='causal-replay']")!).visibility === "visible",
      undefined,
      { timeout: 15_000 },
    );
    expect(await page.locator("[data-kavach-stage] canvas").count(), "no film/reels rendered under reduced motion").toBe(0);
    expect(await diag(page)).toBeNull();
    const w = await exposureWeights(page);
    expect(w[CAUSAL_REPLAY_STAGE_COUNT - 1]).toBeGreaterThan(0.99);
    expect(w.filter((v) => v > 0.01).length).toBe(1);
    await expect(page.locator("[data-full-chain]")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await exposureWeights(page)).toEqual(w);
  });
});
