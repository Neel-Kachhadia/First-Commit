import { expect, test, type Page } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

// Scene 02 — ALLOW / STEP-UP / DENY. SAME RULES. DIFFERENT OUTCOMES.
// Product contract (not choreography timing):
//   ALLOW   = continuity   : the request keeps moving; nothing gates or blocks it.
//   STEP-UP = interruption : the request is arrested at a gate and held for permission.
//   DENY    = termination  : the route itself ends; the request halts against a barrier.
// The detailed clearance (Travel document, CLEAR ONCE, DECLINE, ₹3,000 threshold)
// belongs to Scene 04 and must not appear here.

const SCENE = "[data-scene='decisions']";
const LANES = ["allow", "stepup", "deny"] as const;
type Lane = (typeof LANES)[number];

const opacity = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => Number(getComputedStyle(el).opacity));

async function state(page: Page) {
  const on = async (sel: string) => (await opacity(page, sel)) > 0.5;
  return {
    stamp: { allow: await on("[data-stamp='allow']"), stepup: await on("[data-stamp='stepup']"), deny: await on("[data-stamp='deny']") },
    gate: await on("[data-gate='stepup']"),
    barrier: await on("[data-barrier='deny']"),
    receipt: {
      allow: await on("[data-receipt-wrap='allow']"),
      stepup: await on("[data-receipt-wrap='stepup']"),
      deny: await on("[data-receipt-wrap='deny']"),
    },
  };
}

const centreX = async (page: Page, l: Lane) => {
  const b = (await page.locator(`[data-receipt-wrap='${l}']`).boundingBox())!;
  return b.x + b.width / 2;
};

test.describe("Scene 02 — Decisions product contract", () => {
  test.describe.configure({ mode: "serial" });

  test("three distinct outcomes with the canonical requests, stamps and descriptors", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 1.0);

    const scene = page.locator(SCENE);
    for (const [lane, label, descriptor, amount, stamp] of [
      ["allow", "ALLOW", "CONTINUITY", "1,249", "APPROVED"],
      ["stepup", "STEP-UP", "INTERRUPTION", "4,900", "STEP-UP REQUIRED"],
      ["deny", "DENY", "INCOMPLETION", "799", "DENIED"],
    ] as const) {
      const laneEl = scene.locator(`[data-lane='${lane}']`);
      await expect(laneEl.locator(`[data-lane-tag='${lane}']`)).toHaveText(label);
      await expect(laneEl.locator(`[data-lane-rule='${lane}']`)).toHaveText(descriptor);
      await expect(laneEl.locator(`[data-receipt-wrap='${lane}']`)).toContainText(amount);
      await expect(laneEl.locator(`[data-stamp='${lane}']`)).toContainText(stamp);
    }

    // Different mechanisms, not the same template three times: only STEP-UP has a gate,
    // only DENY has a barrier, ALLOW has neither.
    await expect(scene.locator("[data-lane='stepup'] [data-gate='stepup']")).toContainText("HOLD FOR CLEARANCE");
    await expect(scene.locator("[data-lane='deny'] [data-barrier='deny']")).toContainText("ROUTE TERMINATED");
    expect(await scene.locator("[data-lane='allow'] [data-gate], [data-lane='allow'] [data-barrier]").count()).toBe(0);
    expect(await scene.locator("[data-lane='deny'] [data-gate]").count()).toBe(0);
    expect(await scene.locator("[data-lane='stepup'] [data-barrier]").count()).toBe(0);

    // No Scene 04 duplication: Scene 02 only classifies STEP-UP, it does not run the clearance.
    const text = (await scene.textContent()) ?? "";
    for (const forbidden of ["CLEAR ONCE", "DECLINE", "CLEARANCE GRANTED", "TRAVEL AUTHORIZATION REQUEST", "₹3,000"]) {
      expect(text, `Scene 02 must not contain Scene 04 content: ${forbidden}`).not.toContain(forbidden);
    }
  });

  test("outcomes resolve one at a time and never mix, forward and reverse", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });

    const at = async (p: number) => {
      await seekSceneProgress(page, SCENE, p);
      return state(page);
    };
    const checkpoints = [0.03, 0.1, 0.3, 0.5, 0.68, 0.9, 1.0] as const;
    const forward = [];
    for (const p of checkpoints) forward.push(await at(p));

    // Established apparatus: nothing has been decided yet.
    expect(forward[0].stamp).toEqual({ allow: false, stepup: false, deny: false });
    expect(forward[0].receipt).toEqual({ allow: false, stepup: false, deny: false });
    // ALLOW alone.
    expect(forward[2].stamp).toEqual({ allow: true, stepup: false, deny: false });
    expect(forward[2].gate || forward[2].barrier).toBe(false);
    // STEP-UP resolved: its gate exists, DENY has not started, no barrier.
    expect(forward[4].stamp).toEqual({ allow: true, stepup: true, deny: false });
    expect(forward[4].gate).toBe(true);
    expect(forward[4].barrier).toBe(false);
    expect(forward[4].receipt.deny).toBe(false);
    // Comparative resolution: all three, each with its own mechanism.
    for (const i of [5, 6]) {
      expect(forward[i].stamp).toEqual({ allow: true, stepup: true, deny: true });
      expect(forward[i].gate).toBe(true);
      expect(forward[i].barrier).toBe(true);
    }
    // A stamp never exists without its mechanism (STEP-UP => gate, DENY => barrier).
    for (const s of forward) {
      if (s.stamp.stepup) expect(s.gate).toBe(true);
      if (s.stamp.deny) expect(s.barrier).toBe(true);
    }

    // Reverse retraces exactly the same states.
    const reverse = [];
    for (const p of [...checkpoints].reverse()) reverse.push(await at(p));
    expect(reverse.reverse()).toEqual(forward);
  });

  test("ALLOW is continuous, STEP-UP is arrested, DENY halts", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });

    const sample = async (lane: Lane, ps: number[]) => {
      const xs: number[] = [];
      for (const p of ps) {
        await seekSceneProgress(page, SCENE, p);
        xs.push(await centreX(page, lane));
      }
      return xs;
    };
    const steps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]);

    // ALLOW: while it is in flight it moves at every sample (no pause), and keeps moving
    // after its stamp has landed (stamp at ~0.28-0.33; flight ends ~0.37).
    const allow = await sample("allow", [0.18, 0.22, 0.26, 0.3, 0.34]);
    for (const d of steps(allow)) expect(d, "ALLOW never pauses mid-flight").toBeGreaterThan(2);

    // STEP-UP: it arrives, then is held — no further travel once the gate and stamp register.
    const held = await sample("stepup", [0.6, 0.63, 0.66]);
    for (const d of steps(held)) expect(Math.abs(d), "STEP-UP is arrested at the gate").toBeLessThan(1.5);
    const arriving = await sample("stepup", [0.44, 0.48, 0.52]);
    for (const d of steps(arriving)) expect(d, "STEP-UP advanced before being arrested").toBeGreaterThan(2);

    // DENY: halts against the barrier and stays put; it never advances past its stop.
    const halted = await sample("deny", [0.83, 0.86, 0.9, 1.0]);
    for (const d of steps(halted)) expect(Math.abs(d), "DENY does not continue").toBeLessThan(1.5);
    // ...and it stops short of ALLOW (termination happens before the lane could end).
    const finalAllow = await centreX(page, "allow");
    expect(halted[halted.length - 1]).toBeLessThan(finalAllow - 40);
  });

  test("terminal receipts sit on the 02->03 film's slots (desktop)", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) <= 768, "mobile bypasses the film");
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 0.97);

    // Film slots (video px, 1280x720): centres measured from the clip's first frame.
    const slots: Record<Lane, [number, number]> = {
      allow: [(639 + 876) / 2, (74 + 224) / 2],
      stepup: [(492 + 729) / 2, (292 + 443) / 2],
      deny: [(459 + 696) / 2, (509 + 659) / 2],
    };
    const film = await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('video[src*="02-03"]')!.getBoundingClientRect();
      const s = Math.max(r.width / 1280, r.height / 720);
      return { s, ox: r.left - (1280 * s - r.width) / 2, oy: r.top - (720 * s - r.height) / 2 };
    });
    for (const lane of LANES) {
      const b = (await page.locator(`[data-receipt-wrap='${lane}']`).boundingBox())!;
      const cx = film.ox + slots[lane][0] * film.s;
      const cy = film.oy + slots[lane][1] * film.s;
      expect(Math.abs(b.x + b.width / 2 - cx), `${lane} receipt x within 6px of film slot`).toBeLessThan(6);
      expect(Math.abs(b.y + b.height / 2 - cy), `${lane} receipt y within 10px of film slot`).toBeLessThan(10);
    }
  });

  test("direct navigation to #scene-02 initialises the established apparatus", async ({ page }) => {
    await page.goto("/?visualTest=1#scene-02", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector("[data-scene='decisions']")!).visibility === "visible",
      undefined,
      { timeout: 15_000 },
    );
    // Labels registered with their letters; nothing decided yet; no dependency on the 01->02 film.
    for (const lane of LANES) {
      expect(await opacity(page, `[data-lane-tag='${lane}']`)).toBeGreaterThan(0.95);
      expect(await opacity(page, `[data-lane-letter='${lane}']`)).toBeGreaterThan(0.9);
    }
    const s = await state(page);
    expect(s.stamp).toEqual({ allow: false, stepup: false, deny: false });
    expect(s.gate || s.barrier).toBe(false);
  });

  test("exactly one scene owns the stage at Decisions checkpoints", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    for (const p of [0.05, 0.3, 0.6, 0.85, 0.97]) {
      await seekSceneProgress(page, SCENE, p);
      const visible = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")).filter(
            (el) => getComputedStyle(el).visibility === "visible",
          ).length,
      );
      expect(visible, `visible scene roots at p=${p}`).toBe(1);
    }
  });
});
