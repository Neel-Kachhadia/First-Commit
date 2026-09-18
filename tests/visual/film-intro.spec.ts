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

  test("sessionStorage bypasses replay on a second load; ?intro=0 also bypasses", async ({ page }, testInfo) => {
    test.skip(!desktopOnly.has(testInfo.project.name), "Representative desktop session gate.");
    await page.goto("/?intro=1", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-film-intro]")).toBeHidden({ timeout: 1000 });

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(0);
    await expect(page.locator("[data-global-navbar]")).not.toHaveAttribute("data-intro-hidden", "true");

    await page.goto("/?intro=0", { waitUntil: "networkidle" });
    await expect(page.locator("[data-film-intro]")).toHaveCount(0);
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
