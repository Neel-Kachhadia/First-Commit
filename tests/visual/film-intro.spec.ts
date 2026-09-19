import { expect, test } from "@playwright/test";

const desktopOnly = new Set(["1440x900"]);
const mobileOnly = new Set(["390x844"]);

test.describe("FilmIntro — pre-film leader / slate / clap sequence", () => {
  test("fresh session plays leader countdown 3 -> 2 -> 1, then slate, then ACTION, then releases", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop intro gate.");
    // Record numeral text changes from first paint via MutationObserver — asserting
    // "3" synchronously after goto/networkidle is racy against real page-load latency,
    // since the GSAP timeline starts on mount regardless of how long the harness took to get here.
    await page.addInitScript(() => {
      const w = window as unknown as { __kpNumerals: string[] };
      w.__kpNumerals = [];
      const record = () => {
        const el = document.querySelector("[data-numeral]");
        const text = el?.textContent ?? "";
        if (text && w.__kpNumerals[w.__kpNumerals.length - 1] !== text) w.__kpNumerals.push(text);
      };
      const attach = () => {
        const el = document.querySelector("[data-numeral]");
        if (!el) {
          requestAnimationFrame(attach);
          return;
        }
        record();
        new MutationObserver(record).observe(el, { characterData: true, childList: true, subtree: true });
      };
      requestAnimationFrame(attach);
    });
    await page.goto("/?intro=1", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const intro = page.locator("[data-film-intro]");
    await expect(intro).toBeVisible();

    await expect(page.locator("[data-director-slate]")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("[data-clapper]")).toBeVisible();

    const underline = page.locator("[data-action-underline]");
    await expect
      .poll(
        async () =>
          underline.evaluate((el) => Number.parseFloat(el.getAttribute("stroke-dashoffset") ?? "1")),
        { timeout: 3000 },
      )
      .toBeLessThan(1);

    await expect(intro).toBeHidden({ timeout: 3000 });

    const numerals = await page.evaluate(() => (window as unknown as { __kpNumerals: string[] }).__kpNumerals);
    expect(numerals).toEqual(["3", "2", "1"]);
  });

  test("navbar and cinematic stage are withheld until the film releases, then establish", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop intro gate.");
    await page.goto("/?intro=1", { waitUntil: "networkidle" });

    const nav = page.locator("[data-global-navbar]");
    await expect(nav).toHaveAttribute("data-intro-hidden", "true");
    const stage = page.locator("[data-cinematic-stage]");
    await expect(stage).toHaveAttribute("aria-hidden", "true");

    await expect(page.locator("[data-film-intro]")).toBeHidden({ timeout: 5000 });
    await expect(nav).not.toHaveAttribute("data-intro-hidden", "true");
    await expect(stage).not.toHaveAttribute("aria-hidden", "true");
    await expect(nav).toHaveCSS("opacity", "1");
  });

  test("Escape completes the intro immediately", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop escape gate.");
    await page.goto("/?intro=1", { waitUntil: "networkidle" });
    await expect(page.locator("[data-film-intro]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-film-intro]")).toBeHidden({ timeout: 1000 });
    await expect(page.locator("[data-global-navbar]")).not.toHaveAttribute("data-intro-hidden", "true");
  });

  // ---- Intro lifecycle contract -------------------------------------------------------------------
  // A = should it play for THIS navigation (re-derived per mount), B = has THIS instance finished,
  // C = was it already played in THIS DOCUMENT (module state: survives SPA navigation, dies on any
  // real page load). sessionStorage must never suppress a refresh.
  const completeIntro = async (page: import("@playwright/test").Page) => {
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-film-intro]")).toHaveCount(0, { timeout: 3000 });
  };
  const introOnTop = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const intro = document.querySelector("[data-film-intro]");
      const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      const z = intro ? getComputedStyle(intro).zIndex : null;
      return { mounted: !!intro, coversCentre: !!intro && !!top && intro.contains(top), z };
    });

  test("root first load plays the intro, VISIBLY ON TOP of the stage (z-index token regression guard)", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop lifecycle gate.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(1); // exactly one instance
    await expect(page.locator("[data-numeral]")).toHaveText("3", { timeout: 3000 });
    const layer = await introOnTop(page);
    expect(layer.mounted).toBe(true);
    expect(layer.coversCentre).toBe(true); // nothing (stage z-index:3, grain, ...) paints over it
    expect(Number(layer.z)).toBeGreaterThan(100); // above navbar (100/110) and stage (3): NOT "auto"
    await expect(page.locator("[data-cinematic-stage]")).toHaveAttribute("aria-hidden", "true"); // no early scene ownership
    await completeIntro(page);
    await expect(page.locator("[data-cinematic-stage]")).not.toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("[data-scene='prologue']")).toHaveAttribute("aria-hidden", "false"); // Scene 00 owns the stage
  });

  test("reload and hard reload PLAY the intro again; nothing is stored that could suppress them", async ({ page, context }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop lifecycle gate.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(1);
    await completeIntro(page);
    expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);

    await page.reload({ waitUntil: "domcontentloaded" }); // F5 / Ctrl+R
    expect(await page.evaluate(() => performance.getEntriesByType("navigation")[0].type)).toBe("reload");
    await expect(page.locator("[data-film-intro]")).toHaveCount(1);
    expect((await introOnTop(page)).coversCentre).toBe(true);
    await completeIntro(page);

    const cdp = await context.newCDPSession(page); // Ctrl+Shift+R = reload ignoring cache
    await cdp.send("Page.reload", { ignoreCache: true });
    await expect(page.locator("[data-film-intro]")).toHaveCount(1, { timeout: 8000 });
    expect((await introOnTop(page)).coversCentre).toBe(true);
    expect(await page.evaluate(() => performance.getEntriesByType("navigation")[0].type)).toBe("reload");
  });

  test("a new full navigation to the root (fresh document) plays again", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop lifecycle gate.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await completeIntro(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(1);
  });

  test("SPA return to Scene 00 does NOT replay (same document), and the hero simply appears", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop lifecycle gate.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(1);
    await completeIntro(page);
    await page.evaluate(() => ((window as unknown as { __doc: number }).__doc = 42)); // survives only client-side navigation
    await page.getByRole("button", { name: "ENTER KAVACHPAY" }).first().click(); // router.push -> another route
    await expect(page).not.toHaveURL(/localhost:\d+\/$|127\.0\.0\.1:\d+\/$/, { timeout: 15000 });
    await page.goBack(); // client-side return to "/"
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    expect(await page.evaluate(() => (window as unknown as { __doc?: number }).__doc)).toBe(42); // same document => SPA
    await expect(page.locator("[data-scene='prologue']")).toBeAttached();
    await page.waitForTimeout(800);
    await expect(page.locator("[data-film-intro]")).toHaveCount(0);
    await expect(page.locator("[data-global-navbar]")).not.toHaveAttribute("data-intro-hidden", "true");
  });

  test("query overrides: ?intro=1 plays (also on reload), ?intro=0 and ?visualTest=1 bypass (also on reload)", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop lifecycle gate.");
    for (const [query, plays] of [["?intro=1", true], ["?intro=0", false], ["?visualTest=1", false]] as const) {
      await page.goto("/" + query, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      await expect(page.locator("[data-film-intro]")).toHaveCount(plays ? 1 : 0);
      if (plays) await completeIntro(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      await expect(page.locator("[data-film-intro]")).toHaveCount(plays ? 1 : 0);
    }
  });

  test("a deep link to another scene bypasses the intro; #scene-00 plays it (existing product rule)", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop lifecycle gate.");
    await page.goto("/#scene-03", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await expect(page.locator("[data-film-intro]")).toHaveCount(0);
    await page.goto("about:blank"); // #scene-03 -> #scene-00 alone is a hash change in the SAME document (no replay by contract)
    await page.goto("/#scene-00", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(1);
  });

  test("deep links bypass the intro entirely", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop deep-link gate.");
    await page.goto("/#scene-08", { waitUntil: "networkidle" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(0);
    await expect(page.locator("[data-global-navbar]")).not.toHaveAttribute("data-intro-hidden", "true");
  });

  test("reduced motion shows a restrained static card, not the countdown", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop reduced-motion gate.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?intro=1", { waitUntil: "networkidle" });
    await expect(page.locator("[data-film-leader]")).toHaveCount(0);
    await expect(page.locator("[data-director-slate]")).toHaveCount(0);
    await expect(page.locator("[data-film-intro]")).toBeHidden({ timeout: 1500 });
  });

  test("mobile: slate stays substantial, not scaled to a tiny corner", async ({ page }, testInfo) => {
    test.skip(!mobileOnly.has(testInfo.project.name), "Representative mobile intro gate.");
    await page.goto("/?intro=1", { waitUntil: "networkidle" });
    await expect(page.locator("[data-numeral]")).toHaveText("3", { timeout: 1000 });

    await expect(page.locator("[data-director-slate]")).toBeVisible({ timeout: 3000 });
    const board = page.locator("[data-board]");
    const box = await board.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.width / viewport.width).toBeGreaterThan(0.6);
    }

    await expect(page.locator("[data-film-intro]")).toBeHidden({ timeout: 5000 });
  });
});
