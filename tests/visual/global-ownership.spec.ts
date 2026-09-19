import { expect, test, type Page } from "@playwright/test";
import { resolveOwnerIndex } from "../../src/lib/experience/scene-ownership";
import { SCENE_REGISTRY } from "../../src/lib/experience/scene-registry";

/**
 * ONE global semantic scene owner: aria-hidden / inert / pointer-events of every scene root, the
 * navbar chapter, reduced-motion visibility and deep links all follow a single value. Two scenes may
 * be VISUALLY present together (film blend); only one is ever semantically active.
 */

/* ------------------------------------------------------------------ pure */
test.describe("Owner resolver (pure)", () => {
  const tops = [0, 1000, 2500, 4000];
  test("top probe: owner changes exactly when the next track top reaches the viewport top", () => {
    expect(resolveOwnerIndex(tops, 0, 900, "top")).toBe(0);
    expect(resolveOwnerIndex(tops, 998, 900, "top")).toBe(0);
    expect(resolveOwnerIndex(tops, 999, 900, "top")).toBe(1); // 1px probe
    expect(resolveOwnerIndex(tops, 2498, 900, "top")).toBe(1);
    expect(resolveOwnerIndex(tops, 2499, 900, "top")).toBe(2);
    expect(resolveOwnerIndex(tops, 2500, 900, "top")).toBe(2);
  });
  test("centre probe flips half a viewport earlier (used only while a film covers the swap)", () => {
    expect(resolveOwnerIndex(tops, 550, 900, "center")).toBe(1);
    expect(resolveOwnerIndex(tops, 549, 900, "center")).toBe(0);
  });
  test("gaps (film spacers) keep the previous owner and the result is monotone in scroll", () => {
    let prev = 0;
    for (let y = 0; y <= 6000; y += 7) {
      const idx = resolveOwnerIndex(tops, y, 900, "top");
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
    expect(resolveOwnerIndex([0, 500, Number.POSITIVE_INFINITY], 3000, 900, "top")).toBe(1); // missing track never owns
  });
});

/* --------------------------------------------------------------- browser */
const MOBILE = new Set(["430x932", "390x844"]);
const DESKTOP = new Set(["1920x1080", "1440x900", "1366x768"]);

async function open(page: Page, query = "") {
  await page.goto(`/?intro=0&visualTest=1${query}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")).map((r) => {
      const cs = getComputedStyle(r);
      return { id: r.dataset.scene!, aria: r.getAttribute("aria-hidden"), inert: r.inert, pointer: cs.pointerEvents, visible: cs.visibility === "visible" && cs.display !== "none" };
    });
    const nav = document.querySelector<HTMLElement>("[data-global-navbar] [aria-current='page']")?.getAttribute("aria-label") ?? "";
    return { roots, nav, stage: document.querySelector<HTMLElement>("[data-cinematic-stage]")?.dataset.activeScene ?? null, y: window.scrollY, vh: window.innerHeight };
  });
}

/** Scene whose track top is the last one at/above scrollY + probe. */
async function trackOwner(page: Page, probe: "top" | "center") {
  return page.evaluate((probe) => {
    const y = window.scrollY + (probe === "center" ? window.innerHeight / 2 : 1);
    let owner = "prologue";
    document.querySelectorAll<HTMLElement>("[data-track]").forEach((t) => {
      if (t.getBoundingClientRect().top + window.scrollY <= y) owner = t.dataset.track!;
    });
    return owner;
  }, probe);
}

const chapterNumber = (slug: string) => SCENE_REGISTRY.find((s) => s.slug === slug)!.number;

function expectSingleSemanticOwner(s: Awaited<ReturnType<typeof snapshot>>, ownerSlug: string, ctx: string) {
  const live = s.roots.filter((r) => r.aria === "false").map((r) => r.id);
  expect(live, `${ctx}: aria-hidden=false roots`).toEqual([ownerSlug]);
  expect(s.roots.filter((r) => !r.inert).map((r) => r.id), `${ctx}: non-inert roots`).toEqual([ownerSlug]);
  expect(s.roots.filter((r) => r.pointer !== "none").map((r) => r.id), `${ctx}: pointer-events roots`).toEqual([ownerSlug]);
  expect(s.stage, `${ctx}: stage owner`).toBe(SCENE_REGISTRY.find((x) => x.slug === ownerSlug)!.key);
  expect(s.nav, `${ctx}: navbar chapter`).toMatch(new RegExp(`^${chapterNumber(ownerSlug)} `));
}

test.describe("Desktop: one semantic owner across the whole page (film blends allowed visually)", () => {
  test.beforeEach(({}, testInfo) => test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects"));

  test("dense sweep: exactly one aria/inert/pointer owner and the navbar follows it", async ({ page }) => {
    await open(page);
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= total; y += 173) {
      await page.evaluate((y) => { window.scrollTo(0, y); (window as unknown as { ScrollTrigger: { update: () => void } }).ScrollTrigger.update(); }, y);
      const s = await snapshot(page);
      expectSingleSemanticOwner(s, await trackOwner(page, "center"), `y=${y}`);
    }
  });
});

test.describe("Mobile: no early ownership flip, no double roots", () => {
  test.beforeEach(({}, testInfo) => test.skip(!MOBILE.has(testInfo.project.name), "mobile projects"));

  test("owner (aria, pointer, navbar) changes exactly at the hand-off, never half a viewport early", async ({ page }) => {
    await open(page);
    const boundaries = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("[data-track]")).map((t) => ({ slug: t.dataset.track!, top: t.getBoundingClientRect().top + window.scrollY })));
    for (let i = 1; i < boundaries.length; i += 1) {
      const prev = boundaries[i - 1];
      const next = boundaries[i];
      for (const dy of [-0.5, -0.25, -60, -2]) {
        const y = next.top + (Math.abs(dy) < 1 ? dy * (await page.evaluate(() => innerHeight)) : dy);
        await page.evaluate((y) => { window.scrollTo(0, y); (window as unknown as { ScrollTrigger: { update: () => void } }).ScrollTrigger.update(); }, y);
        expectSingleSemanticOwner(await snapshot(page), prev.slug, `before ${next.slug} @${dy}`);
      }
      await page.evaluate((y) => { window.scrollTo(0, y); (window as unknown as { ScrollTrigger: { update: () => void } }).ScrollTrigger.update(); }, next.top + 3);
      expectSingleSemanticOwner(await snapshot(page), next.slug, `at ${next.slug}`);
    }
  });

  test("dense sweep: one semantic owner everywhere and at most one visible root at any mobile checkpoint", async ({ page }) => {
    await open(page);
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= total; y += 211) {
      await page.evaluate((y) => { window.scrollTo(0, y); (window as unknown as { ScrollTrigger: { update: () => void } }).ScrollTrigger.update(); }, y);
      const s = await snapshot(page);
      expectSingleSemanticOwner(s, await trackOwner(page, "top"), `y=${y}`);
    }
  });
});

test.describe("Reduced motion: one owner, one visible root, no film media, everywhere", () => {
  test("dense sweep", async ({ page }, testInfo) => {
    test.skip(!(DESKTOP.has(testInfo.project.name) || MOBILE.has(testInfo.project.name)) || testInfo.project.name === "1366x768", "representative sizes");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const media: string[] = [];
    page.on("request", (r) => { if (/kavachpay\/transitions\/.*\.mp4/.test(r.url())) media.push(r.url()); });
    await open(page);
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= total; y += 197) {
      await page.evaluate((y) => { window.scrollTo(0, y); (window as unknown as { ScrollTrigger: { update: () => void } }).ScrollTrigger.update(); }, y);
      const s = await snapshot(page);
      const owner = await trackOwner(page, "top");
      expectSingleSemanticOwner(s, owner, `reduced y=${y}`);
      expect(s.roots.filter((r) => r.visible).map((r) => r.id), `reduced y=${y}: visible roots`).toEqual([owner]);
    }
    expect(media).toEqual([]);
  });
});

test.describe("Direct navigation: every deep link initialises its own owner without history", () => {
  for (const scene of SCENE_REGISTRY) {
    test(`#scene-${scene.number} -> ${scene.slug}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "1366x768", "representative sizes");
      await page.goto(`/?intro=0&visualTest=1#scene-${scene.number}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction((slug) => document.querySelector<HTMLElement>(`[data-scene='${slug}']`)?.getAttribute("aria-hidden") === "false", scene.slug);
      const s = await snapshot(page);
      expectSingleSemanticOwner(s, scene.slug, `deep link ${scene.number}`);
    });
  }
});
