import { expect, test, type Page } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

// Scene 00 — OPENING / HERO. The first fully exposed frame of the film.
// Product/visual contract (not choreography timing):
//   The monumental KavachPay wordmark, its red grease-pencil residue stroke, the left film-strip edge,
//   crop/registration geometry, production notations, and the thesis (CONTROL / TRAVELS / FURTHER,
//   SAME MONEY. A SAFER TOMORROW.) are present and STATIC from the first frame. Only the thesis bar,
//   registration rule and mark resolve (scroll-derived) into the frame the 00->01 film begins on.
//   Nothing of Scene 01 is built or previewed here, and nothing departs at the end (desktop).

const SCENE = "[data-scene='prologue']";
const HERO = [
  "[data-hero-title]",
  "[data-action-residue]",
  "[data-film-strip]",
  "[data-opening-meta]",
];

const opacity = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => Number(getComputedStyle(el).opacity));
const rect = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  });
const ruleScale = (page: Page) =>
  page.locator("[data-opening-rule]").evaluate((el) => {
    const m = getComputedStyle(el).transform;
    if (m === "none") return 1;
    return Number(m.match(/matrix\(([^,]+),/)?.[1] ?? 1);
  });
const owners = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"))
      .filter((el) => getComputedStyle(el).visibility === "visible")
      .map((el) => el.dataset.scene),
  );

test.describe("Scene 00 — Opening hero contract", () => {
  test.describe.configure({ mode: "serial" });

  test("the approved hero composition is present: wordmark, red residue, film strip, geometry, notations, thesis", async ({ page }) => {
    await prepareVisualPage(page);
    const scene = page.locator(SCENE);
    await scene.waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 0.02);

    await expect(page.getByRole("heading", { level: 1, name: "KavachPay" })).toBeVisible();
    await expect(page.locator("[data-action-residue] path")).toHaveCount(2); // pressure undertone + primary stroke
    await expect(page.locator("[data-film-strip]")).toBeAttached();
    expect(await scene.locator("[class*='cropMark']").count()).toBe(4);
    await expect(scene).toContainText("PICTURE 01");
    await expect(scene).toContainText("AUTHORITY");
    await expect(scene).toContainText("BOUND CONTRACT");
    await expect(scene).toContainText("TAKE 01");
    await expect(scene).toContainText("ROLL KP-01");
    for (const word of ["CONTROL", "TRAVELS", "FURTHER"]) await expect(scene.locator("[class*='thesisControl']")).toContainText(word);
    await expect(scene.locator("[data-opening-meta]")).toContainText("SAME MONEY.");
    await expect(scene.locator("[data-opening-meta]")).toContainText("A SAFER TOMORROW.");
    await expect(scene).toContainText("00 : 00 : 01 : 00");
    await expect(scene).toContainText("KAVACHPAY // 2026");
  });

  test("hero is exposed and static from the first frame; only the thesis bar, rule and mark resolve", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 0.02);

    for (const sel of HERO) expect(await opacity(page, sel), `${sel} exposed at first frame`).toBeGreaterThan(0.99);
    // Not yet resolved.
    expect(await opacity(page, "[data-opening-window]")).toBeLessThan(0.05);
    expect(await ruleScale(page)).toBeLessThan(0.05);
    expect(await opacity(page, "[data-opening-reg]")).toBeLessThan(0.05);

    const base: number[][] = [];
    for (const sel of HERO) base.push(await rect(page, sel));
    for (const p of [0.2, 0.45, 0.7, 0.9]) {
      await seekSceneProgress(page, SCENE, p);
      for (const [i, sel] of HERO.entries()) {
        const r = await rect(page, sel);
        // Ambient gate weave is < 1px; nothing else may move.
        for (let k = 0; k < 4; k++) expect(Math.abs(r[k] - base[i][k]), `${sel} static at p=${p}`).toBeLessThanOrEqual(1);
        expect(await opacity(page, sel), `${sel} stays exposed at p=${p}`).toBeGreaterThan(0.99);
      }
    }
    // Terminal: the thesis has resolved into the film's first frame.
    expect(await opacity(page, "[data-opening-window]")).toBeGreaterThan(0.6);
    expect(await ruleScale(page)).toBeGreaterThan(0.99);
    expect(await opacity(page, "[data-opening-reg]")).toBeGreaterThan(0.95);
  });

  test("resolution is monotone forward and reverses exactly; no Mandate preview exists in Scene 00", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });

    const at = async (p: number) => {
      await seekSceneProgress(page, SCENE, p);
      return {
        window: Math.round((await opacity(page, "[data-opening-window]")) * 20),
        rule: Math.round((await ruleScale(page)) * 20),
        reg: Math.round((await opacity(page, "[data-opening-reg]")) * 20),
      };
    };
    const checkpoints = [0.02, 0.1, 0.25, 0.35, 0.45, 0.55, 0.7, 0.9] as const;
    const forward = [];
    for (const p of checkpoints) forward.push(await at(p));
    for (const key of ["window", "rule", "reg"] as const) {
      for (let i = 1; i < forward.length; i++) expect(forward[i][key], `${key} never regresses going forward`).toBeGreaterThanOrEqual(forward[i - 1][key]);
    }
    const reverse = [];
    for (const p of [...checkpoints].reverse()) reverse.push(await at(p));
    expect(reverse.reverse()).toEqual(forward);

    // Legacy Mandate preview / paper takeover is gone for good.
    const scene = page.locator(SCENE);
    expect(await page.locator("[data-opening-paper], [data-opening-bridge]").count()).toBe(0);
    const text = (await scene.textContent()) ?? "";
    for (const forbidden of ["01 / MANDATE", "Permission,", "made exact.", "INTENT → BOUND AUTHORITY"]) {
      expect(text, `Scene 00 must not preview Mandate: ${forbidden}`).not.toContain(forbidden);
    }
  });

  test("nothing departs on desktop at the terminal; mobile dips to black (no film there)", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    await seekSceneProgress(page, SCENE, 1.0);
    const frame = await opacity(page, "[data-opening-frame]");
    if ((page.viewportSize()?.width ?? 0) <= 768) {
      expect(frame, "mobile has no 00->01 film: frame dips to black").toBeLessThan(0.1);
      await seekSceneProgress(page, SCENE, 0.9);
      expect(await opacity(page, "[data-opening-frame]"), "dip only at the very end").toBeGreaterThan(0.99);
    } else {
      expect(frame, "the 00->01 film owns departure").toBeGreaterThan(0.99);
      for (const sel of HERO) expect(await opacity(page, sel)).toBeGreaterThan(0.99);
    }
  });

  test("ambient motion is restrained: gate weave under 1px, exposure drift under 5%", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    const anim = await page.evaluate(() => {
      const frame = document.querySelector("[data-opening-frame]")!;
      const light = document.querySelector("[data-opening-light]")!;
      const cs = getComputedStyle(frame);
      const weave = Array.from(document.getAnimations()).find((a) => (a as CSSAnimation).animationName?.includes("gateWeave"));
      const keyframes = weave ? (weave.effect as KeyframeEffect).getKeyframes() : [];
      const offsets = keyframes.map((k) => String(k.transform)).map((t) => t.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/)).filter(Boolean).map((m) => [Number(m![1]), Number(m![2])]);
      const drift = Array.from(document.getAnimations()).find((a) => (a as CSSAnimation).animationName?.includes("exposureDrift"));
      const dk = drift ? (drift.effect as KeyframeEffect).getKeyframes().map((k) => Number(k.opacity)) : [];
      return { name: cs.animationName, lightName: getComputedStyle(light).animationName, offsets, dk };
    });
    expect(anim.name).toContain("gateWeave");
    const maxOffset = Math.max(...anim.offsets.flat().map(Math.abs));
    expect(maxOffset, "gate weave amplitude (px)").toBeLessThanOrEqual(1);
    expect(Math.max(...anim.dk) - Math.min(...anim.dk), "exposure drift range").toBeLessThanOrEqual(0.05);
  });

  test("reduced motion renders the complete static hero with no ambient weave", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
    await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-scene='prologue']")!).visibility === "visible");
    const names = await page.evaluate(() => ({
      frame: getComputedStyle(document.querySelector("[data-opening-frame]")!).animationName,
      light: getComputedStyle(document.querySelector("[data-opening-light]")!).animationName,
    }));
    expect(names).toEqual({ frame: "none", light: "none" });
    await expect(page.getByRole("heading", { level: 1, name: "KavachPay" })).toBeVisible();
    await expect(page.locator("[data-action-residue]")).toBeAttached();
    expect(await opacity(page, "[data-opening-window]")).toBeGreaterThan(0.6);
    expect(await ruleScale(page)).toBeGreaterThan(0.99);
  });

  test("direct load and intro rules: visualTest / intro=0 bypass, intro=1 forces then hands off", async ({ page }) => {
    for (const q of ["/?visualTest=1", "/?intro=0"]) {
      await page.goto(q, { waitUntil: "networkidle" });
      await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-scene='prologue']")!).visibility === "visible", undefined, { timeout: 15_000 });
      expect(await page.locator("[data-film-intro]").count(), `${q} bypasses the intro`).toBe(0);
      await expect(page.getByRole("heading", { level: 1, name: "KavachPay" })).toBeVisible();
      expect(await owners(page)).toEqual(["prologue"]);
      await expect(page.locator("[data-action-residue]")).toBeAttached();
    }
    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-film-intro]", { timeout: 15_000 });
    await page.waitForFunction(() => !document.querySelector("[data-film-intro]"), undefined, { timeout: 30_000 });
    expect(await owners(page)).toEqual(["prologue"]);
    await expect(page.getByRole("heading", { level: 1, name: "KavachPay" })).toBeVisible();
    expect(await opacity(page, "[data-hero-title]")).toBeGreaterThan(0.99);
  });

  test("exactly one scene owns the stage across Opening, and it is Opening", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator(SCENE).waitFor({ state: "attached", timeout: 15_000 });
    for (const p of [0.02, 0.3, 0.6, 0.9]) {
      await seekSceneProgress(page, SCENE, p);
      expect(await owners(page), `stage owner at p=${p}`).toEqual(["prologue"]);
    }
  });
});
