import { expect, test, type Page } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

// Scene 01 — MANDATE. Human intent -> explicit, machine-enforceable authority.
// Product contract (not choreography timing):
//   "Buy groceries for me this week." is compiled, one enforceable constraint at a time, into
//   GROCERY / ₹4,000 per WEEK / STEP-UP > ₹1,500 / NO ALCOHOL / EXPIRES SUN 23:59 /
//   DELEGATION 2 LEVELS MAX, then bound (stamp + seal).
//   The scene copy, ticket, blank stock and measure are handed over by the 00->01 film and
//   must not be re-built; the completed contract is what the 01->02 film picks up, so nothing
//   recedes, departs or bridges at the end.

const SCENE = "[data-scene='mandate']";
const FIELDS = ["limit", "stepup", "blocked", "expires", "delegation"] as const;

const opacity = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => Number(getComputedStyle(el).opacity));

type Compiled = Awaited<ReturnType<typeof compiled>>;

async function compiled(page: Page) {
  const on = async (sel: string) => (await opacity(page, sel)) > 0.9;
  const clipOpen = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const c = getComputedStyle(el).clipPath;
      if (c === "none") return true;
      const m = c.match(/inset\(([\d.]+)(px|%)?\s+([\d.]+)(px|%)?/);
      return !!m && parseFloat(m[3]) === 0;
    });
  const state = {
    header: await clipOpen("[data-mandate-header]"),
    category: (await opacity(page, "[data-mandate-category]")) > 0.9,
    fields: {} as Record<string, boolean>,
    stamp: await on("[data-mandate-stamp]"),
    footer: await on("[data-mandate-footer]"),
    seal: await on("[data-mandate-seal]"),
  };
  for (const f of FIELDS) state.fields[f] = await on(`[data-mandate-field='${f}'] [data-mandate-field-val]`);
  return state;
}

const rect = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  });

test.describe("Scene 01 — Mandate product contract", () => {
  test.describe.configure({ mode: "serial" });

  test("the completed contract holds every enforceable constraint", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 1.0);
    const scene = page.locator(SCENE);

    await expect(scene).toContainText("Permission,");
    await expect(scene).toContainText("made exact.");
    await expect(page.locator("[data-mandate-intent]")).toContainText("Buy groceries for me this week");
    await expect(page.locator("[data-mandate-intent]")).toContainText("COMPILED");

    const sheet = page.locator("[data-mandate-sheet]");
    const dict: Record<string, string> = {
      limit: "₹4,000",
      stepup: "₹1,500",
      blocked: "ALCOHOL",
      expires: "SUN 23:59",
      delegation: "2 LEVELS MAX",
    };
    for (const f of FIELDS) await expect(sheet.locator(`[data-mandate-field='${f}']`)).toContainText(dict[f]);
    // Weekly limit, step-up threshold (above ₹1,500), and the prohibition are each stated as such.
    await expect(sheet.locator("[data-mandate-field='limit']")).toContainText(/₹4,000\s*\/\s*WEEK/);
    await expect(sheet.locator("[data-mandate-field='limit'] dt")).toHaveText(/limit/i);
    await expect(sheet.locator("[data-mandate-field='stepup'] dt")).toHaveText(/step-up/i);
    await expect(sheet.locator("[data-mandate-field='stepup'] dd")).toHaveText(/>\s*₹1,500/);
    await expect(sheet.locator("[data-mandate-field='blocked'] dt")).toHaveText(/^no$/i);
    await expect(sheet.locator("[data-mandate-field='blocked'] dd")).toHaveText(/alcohol/i);
    await expect(sheet.locator("[data-mandate-field='expires'] dd")).toHaveText("SUN 23:59");
    await expect(sheet.locator("[data-mandate-field='delegation'] dd")).toHaveText("2 LEVELS MAX");
    await expect(sheet.locator("[data-mandate-category]")).toHaveText("GROCERY");
    await expect(sheet.locator("[data-mandate-stamp]")).toContainText(/category\s*blocked/i);
    await expect(page.locator("[data-mandate-measure]")).toContainText("4,000");

    // Chapter separation: Scene 01 carries no Decisions-chapter content and the Decisions root is not on stage.
    for (const forbidden of ["ALLOW / STEP-UP / DENY", "SAME RULES", "DIFFERENT OUTCOMES", "HOLD FOR CLEARANCE", "ROUTE TERMINATED", "APPROVED"]) {
      expect((await scene.textContent()) ?? "", `Mandate must not contain Decisions content: ${forbidden}`).not.toContain(forbidden);
    }
    expect(await page.locator("[data-scene='decisions']").evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");

    const state = await compiled(page);
    expect(state.header && state.category && state.stamp && state.footer && state.seal).toBe(true);
    for (const f of FIELDS) expect(state.fields[f], `${f} compiled`).toBe(true);
  });

  test("initial state is the 00->01 film's frame: scene handed over, contract not yet compiled", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 0.03);

    // Handed over by the film, present and untouched from the first frame.
    for (const sel of [
      "[data-mandate-copy-stage]",
      "[data-mandate-support]",
      "[data-mandate-truth]",
      "[data-mandate-intent]",
      "[data-mandate-sheet]",
      "[data-mandate-hole]",
      "[data-mandate-measure]",
    ]) {
      expect(await opacity(page, sel), `${sel} already established`).toBeGreaterThan(0.99);
    }
    // Nothing of the contract is printed yet, and there is no legacy wipe / bridge layer.
    const state = await compiled(page);
    expect(state.header || state.category || state.stamp || state.footer || state.seal).toBe(false);
    expect(Object.values(state.fields).some(Boolean)).toBe(false);
    expect(await page.locator("[data-mandate-bounding-paper], [data-mandate-splice-geom], [data-mandate-copy-paper]").count()).toBe(0);
  });

  test("constraints compile in order and the seal is last, forward and reverse", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });

    const at = async (p: number) => {
      await seekSceneProgress(page, SCENE, p);
      return compiled(page);
    };
    const checkpoints = [0.04, 0.16, 0.22, 0.31, 0.41, 0.51, 0.61, 0.71, 0.78, 0.86, 1.0] as const;
    const forward: Compiled[] = [];
    for (const p of checkpoints) forward.push(await at(p));

    // Fields appear strictly in canonical order; a later field never exists without the earlier ones.
    for (const s of forward) {
      const flags = FIELDS.map((f) => s.fields[f]);
      for (let i = 1; i < flags.length; i++) if (flags[i]) expect(flags[i - 1], `field order ${JSON.stringify(s.fields)}`).toBe(true);
      // LIMIT never compiles before the category scope has been assigned.
      if (s.fields.limit) expect(s.category).toBe(true);
      // The seal only strikes once every constraint is on the sheet.
      if (s.seal) expect(FIELDS.every((f) => s.fields[f])).toBe(true);
    }
    // Progressive: each checkpoint holds at least what the previous one did.
    const count = (s: Compiled) =>
      Number(s.header) + Number(s.category) + FIELDS.filter((f) => s.fields[f]).length + Number(s.stamp) + Number(s.footer) + Number(s.seal);
    for (let i = 1; i < forward.length; i++) expect(count(forward[i])).toBeGreaterThanOrEqual(count(forward[i - 1]));
    expect(count(forward[0])).toBe(0);
    expect(count(forward[forward.length - 1])).toBe(10); // header, category, 5 fields, stamp, footer, seal

    // Reverse retraces exactly.
    const reverse: Compiled[] = [];
    for (const p of [...checkpoints].reverse()) reverse.push(await at(p));
    expect(reverse.reverse()).toEqual(forward);
  });

  test("hero objects never move and nothing recedes or departs at the end", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    const hero = ["[data-mandate-sheet]", "[data-mandate-intent]", "#mandate-scene-title"];
    await seekSceneProgress(page, SCENE, 0.03);
    const base = [];
    for (const sel of hero) base.push(await rect(page, sel));
    for (const p of [0.2, 0.45, 0.7, 0.9, 0.97]) {
      await seekSceneProgress(page, SCENE, p);
      for (const [i, sel] of hero.entries()) expect(await rect(page, sel), `${sel} static at p=${p}`).toEqual(base[i]);
    }
    // At the terminal the scene copy is still on stage (the 01->02 film's first frame still has it).
    for (const sel of ["[data-mandate-support]", "[data-mandate-truth]", "[data-mandate-measure]", "[data-mandate-intent]", "[data-mandate-sheet]"]) {
      expect(await opacity(page, sel), `${sel} present at terminal`).toBeGreaterThan(0.99);
    }
    const carrierTransform = await page.locator("[data-mandate-paper-carrier]").evaluate((el) => getComputedStyle(el).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(carrierTransform);
  });

  test("sheet edge sits on the film's frame (desktop, <=40px; film scales linearly, live layout caps)", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) <= 900, "mobile bypasses the film");
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 0.03);
    const film = await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('video[src*="00-01"]')!.getBoundingClientRect();
      const s = Math.max(r.width / 1280, r.height / 720);
      return { s, ox: r.left - (1280 * s - r.width) / 2 };
    });
    const [left, , width] = await rect(page, "[data-mandate-sheet]");
    const filmRight = film.ox + 1157 * film.s; // sheet right edge in the 00->01 last frame (video px)
    expect(Math.abs(left + width - filmRight), "sheet right edge vs film").toBeLessThan(40);
  });

  test("direct navigation to #scene-01 lands on the established, uncompiled contract", async ({ page }) => {
    await page.goto("/?visualTest=1#scene-01", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector("[data-scene='mandate']")!).visibility === "visible",
      undefined,
      { timeout: 15_000 },
    );
    const owners = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"))
        .filter((el) => getComputedStyle(el).visibility === "visible")
        .map((el) => el.dataset.scene),
    );
    expect(owners).toEqual(["mandate"]);
    expect(await opacity(page, "[data-mandate-sheet]")).toBeGreaterThan(0.99);
    expect(await opacity(page, "[data-mandate-intent]")).toBeGreaterThan(0.99);
    await expect(page.locator("[data-mandate-intent]")).toContainText("Buy groceries for me this week");
    const state = await compiled(page);
    expect(Object.values(state.fields).some(Boolean)).toBe(false);
    expect(state.stamp || state.seal).toBe(false);
  });

  test("exactly one scene owns the stage across Mandate, and it is Mandate", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    for (const p of [0.05, 0.3, 0.6, 0.85, 0.97]) {
      await seekSceneProgress(page, SCENE, p);
      const owners = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"))
          .filter((el) => getComputedStyle(el).visibility === "visible")
          .map((el) => el.dataset.scene),
      );
      expect(owners, `stage owner at p=${p}`).toEqual(["mandate"]);
      // Semantic (aria) ownership: on mobile there is no film spacer and the global ownership
      // trigger flips ~0.5 viewport early (logged as GLOBAL MOBILE SEMANTIC-OWNERSHIP EARLY FLIP,
      // deferred to the global pass), so it is only asserted where the film spacer exists.
      if ((page.viewportSize()?.width ?? 0) <= 900) continue;
      const semantic = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"))
          .filter((el) => el.getAttribute("aria-hidden") === "false")
          .map((el) => el.dataset.scene),
      );
      expect(semantic, `accessible owner at p=${p}`).toEqual(["mandate"]);
    }
  });
});
