import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

// Scene 03 — Delegation. Product contract, not choreography timing:
//   SHOPPING (₹4,000/wk) is the single parent source.
//   GROCERY (₹1,500/wk) and DELIVERY (₹1,000/wk) derive DIRECTLY from SHOPPING and are siblings.
//   delegated + remaining === ₹4,000 at every instant; final remaining === ₹1,500.
//   The 2-level depth demonstration hangs beneath GROCERY and is sealed.

const SCENE = "[data-scene='delegation']";
const PARENT_REF = "SHOPPING (AUTH–0301)";
const GROCERY_REF = "GROCERY (AUTH–0302)";
const denseSteps = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

const rupees = (text: string | null) => Number((text ?? "").replace(/[^0-9]/g, ""));

async function accounting(page: Page) {
  const delegated = rupees(await page.locator("[data-accounting-allocated]").textContent());
  const remaining = rupees(await page.locator("[data-accounting-remaining]").textContent());
  return { delegated, remaining };
}

async function expectConserved(page: Page, at: string) {
  const state = await accounting(page);
  expect(state.delegated + state.remaining, `authority must be divided, never duplicated (${at})`).toBe(4000);
  expect(state.delegated, `delegated never exceeds Grocery+Delivery (${at})`).toBeLessThanOrEqual(2500);
  return state;
}

const opacityOf = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => Number(getComputedStyle(el).opacity));

test.describe("Scene 03 — Delegation product invariants", () => {
  test.describe.configure({ mode: "serial" });

  test("parent source, sibling derivation, amounts and depth seal are correct", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 1.0);

    // SHOPPING is the parent source authority.
    const parent = page.locator("[data-delegation-parent]");
    await expect(parent).toContainText("SHOPPING");
    await expect(parent).toContainText("4,000");
    await expect(parent).toContainText("PARENT AUTHORITY");

    // GROCERY / DELIVERY derive directly from SHOPPING, with their amounts.
    const grocery = page.locator("[data-delegation-grocery]");
    const delivery = page.locator("[data-delegation-delivery]");
    await expect(grocery).toContainText("GROCERY");
    await expect(grocery).toContainText("1,500");
    await expect(grocery).toContainText(PARENT_REF);
    await expect(delivery).toContainText("DELIVERY");
    await expect(delivery).toContainText("1,000");
    await expect(delivery).toContainText(PARENT_REF);

    // Grocery does NOT derive Delivery; they are siblings (same level, same parent).
    await expect(delivery).not.toContainText(GROCERY_REF);
    await expect(delivery).not.toContainText("AUTH–0302");
    await expect(grocery).not.toContainText("AUTH–0303");
    for (const el of [grocery, delivery]) {
      await expect(el).toContainText("LEVEL 1 OF 2");
    }

    // Final remaining authority = ₹1,500 (4,000 - 1,500 - 1,000).
    expect(await accounting(page)).toEqual({ delegated: 2500, remaining: 1500 });

    // Depth demonstration originates from GROCERY (never Delivery) and is sealed at 2 levels.
    const downstream = page.locator("[data-delegation-downstream]");
    await expect(downstream).toContainText(GROCERY_REF);
    await expect(downstream).not.toContainText("AUTH–0303");
    await expect(downstream).toContainText("LEVEL 2 OF 2");
    await expect(page.locator("[data-sealed-boundary]")).toBeVisible();
    const sealed = await page.locator("[data-sealed-boundary]").textContent();
    expect(sealed).toContain("2 LEVELS MAX");
    expect(sealed).toContain("NO FURTHER DELEGATION");

    // Desktop geometry: the depth pass sits beneath Grocery's column, clear of Delivery.
    // Mobile stacks everything in flow, so only provenance text is asserted there.
    const isDesktop = (page.viewportSize()?.width ?? 0) > 768;
    if (isDesktop) {
      const g = (await grocery.boundingBox())!;
      const d = (await delivery.boundingBox())!;
      const s = (await downstream.boundingBox())!;
      const p = (await parent.boundingBox())!;
      expect(s.y, "depth pass is below Grocery").toBeGreaterThan(g.y + g.height * 0.9);
      const overlapWithGrocery = Math.min(s.x + s.width, g.x + g.width) - Math.max(s.x, g.x);
      expect(overlapWithGrocery, "depth pass shares Grocery's column").toBeGreaterThan(s.width * 0.6);
      expect(s.x + s.width, "depth pass does not sit under Delivery").toBeLessThan(d.x);
      // Siblings flank the parent on opposite sides and do not overlap each other.
      expect(g.x + g.width).toBeLessThanOrEqual(p.x + 2);
      expect(d.x).toBeGreaterThanOrEqual(p.x + p.width - 2);
      expect(g.x + g.width).toBeLessThan(d.x);
    }
  });

  test("authority is conserved on every checkpoint, forward and reverse", async ({ page }, testInfo) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", testInfo.project.name, "delegation");
    await mkdir(outputDir, { recursive: true });

    const forward: number[] = [];
    for (const progress of denseSteps) {
      await seekSceneProgress(page, SCENE, progress);
      const { delegated } = await expectConserved(page, `forward p=${progress}`);
      forward.push(delegated);
      await page.screenshot({ path: path.join(outputDir, `${progress}.png`), animations: "allow", caret: "hide" });
    }
    // Delegated authority only ever grows going forward (never multiplies, never un-derives).
    for (let i = 1; i < forward.length; i++) expect(forward[i]).toBeGreaterThanOrEqual(forward[i - 1]);
    expect(forward[0]).toBe(0); // established SHOPPING, nothing derived
    expect(forward[denseSteps.indexOf(0.5)]).toBe(1500); // Grocery derived, Delivery not yet
    expect(forward[denseSteps.indexOf(1.0)]).toBe(2500); // both derived

    // Reverse must retrace exactly the same states, never an impossible one.
    const reverse: number[] = [];
    for (const progress of [...denseSteps].reverse()) {
      await seekSceneProgress(page, SCENE, progress);
      const { delegated } = await expectConserved(page, `reverse p=${progress}`);
      reverse.push(delegated);
    }
    expect(reverse.reverse()).toEqual(forward);
  });

  test("Delivery derives independently of Grocery: un-deriving Delivery leaves Grocery intact", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });

    await seekSceneProgress(page, SCENE, 0.9);
    expect(await accounting(page)).toEqual({ delegated: 2500, remaining: 1500 });

    // Back to between the derivations: Delivery un-derives, Grocery (₹1,500) stays.
    await seekSceneProgress(page, SCENE, 0.5);
    expect(await accounting(page)).toEqual({ delegated: 1500, remaining: 2500 });
    expect(await opacityOf(page, "[data-delegation-grocery]")).toBeGreaterThan(0.95);
    expect(await opacityOf(page, "[data-delegation-delivery]")).toBeLessThan(0.05);

    // And all the way back: nothing derived, no child visible.
    await seekSceneProgress(page, SCENE, 0.05);
    expect(await accounting(page)).toEqual({ delegated: 0, remaining: 4000 });
    for (const sel of ["[data-delegation-grocery]", "[data-delegation-delivery]"]) {
      expect(await opacityOf(page, sel), `${sel} must be gone at the established-parent state`).toBeLessThan(0.05);
    }
  });

  test("direct navigation to #scene-03 initialises a valid Delegation state", async ({ page }) => {
    await page.goto("/?visualTest=1#scene-03", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector("[data-scene='delegation']")!).visibility === "visible",
      undefined,
      { timeout: 15_000 },
    );
    // Parent established, nothing derived yet, no dependency on the 02->03 film having played.
    await expect(page.locator("[data-delegation-parent]")).toContainText("SHOPPING");
    expect(await expectConserved(page, "deep link")).toEqual({ delegated: 0, remaining: 4000 });
    expect(await opacityOf(page, "[data-delegation-delivery]")).toBeLessThan(0.05);
  });
});
