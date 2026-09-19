import { expect, test, type Page } from "@playwright/test";
import {
  QUALITY_THRESHOLDS,
  TransitionQualityController,
  classifySamples,
  coverWidthInDevicePixels,
  decideFromCapabilities,
  parseQualityOverride,
  parseAutoHighOverride,
  AUTO_PROMOTE_TO_HIGH,
  viewportBenefitsFromHigh,
  type CapabilityReport,
} from "../../src/lib/experience/transition-quality";
import { TRANSITION_REGISTRY, TRANSITION_TIER_SPECS } from "../../src/lib/experience/transition-registry";

/**
 * Adaptive transition quality (BYPASS / FALLBACK 1080p60 / STANDARD 1080p120 / HIGH 1440p120).
 * Part 1: pure policy (no browser, no GPU dependence). Part 2: browser behaviour with
 * MediaCapabilities mocked so results never depend on the machine running the test.
 */

const FULL = { supported: true, smooth: true, powerEfficient: true };
const dense = { width: 1440, height: 900, dpr: 2 };
const ordinary = { width: 1920, height: 1080, dpr: 1 };

/* ------------------------------------------------------------------ registry */
test.describe("Tiered registry", () => {
  test("every boundary owns exactly one file per tier, following the tier spec suffix", () => {
    expect(TRANSITION_REGISTRY).toHaveLength(7);
    for (const b of TRANSITION_REGISTRY) {
      expect(Object.keys(b.sources).sort()).toEqual(["fallback", "high", "standard"]);
      expect(b.sources.fallback.endsWith(`.${TRANSITION_TIER_SPECS.fallback.suffix}.mp4`)).toBe(true);
      expect(b.sources.standard.endsWith(`.${TRANSITION_TIER_SPECS.standard.suffix}.mp4`)).toBe(true);
      expect(b.sources.high.endsWith(`.${TRANSITION_TIER_SPECS.high.suffix}.mp4`)).toBe(true);
      // never a master
      for (const src of Object.values(b.sources)) expect(src).not.toMatch(/upscaled|master|300|2160/);
    }
  });
});

/* ------------------------------------------------- capability decision (pure) */
test.describe("MediaCapabilities decision", () => {
  const report = (high: Partial<typeof FULL> | null, std: Partial<typeof FULL> = {}, fb: Partial<typeof FULL> = {}): CapabilityReport => ({
    fallback: { ...FULL, ...fb },
    standard: { ...FULL, ...std },
    ...(high ? { high: { ...FULL, ...high } } : {}),
  });

  test("unsupported HIGH -> ceiling STANDARD", () => {
    expect(decideFromCapabilities(report({ supported: false, smooth: false, powerEfficient: false }), dense)).toMatchObject({ start: "standard", ceiling: "standard" });
  });
  test("supported but not smooth HIGH -> ceiling STANDARD", () => {
    expect(decideFromCapabilities(report({ smooth: false }), dense).ceiling).toBe("standard");
  });
  test("smooth but not power-efficient (software) HIGH -> ceiling STANDARD", () => {
    expect(decideFromCapabilities(report({ powerEfficient: false }), dense).ceiling).toBe("standard");
  });
  test("fully capable HIGH + dense viewport -> ceiling HIGH (when auto-HIGH allowed), but still START at STANDARD", () => {
    expect(decideFromCapabilities(report({}), dense, true)).toMatchObject({ start: "standard", ceiling: "high" });
  });
  test("measured decision: automatic HIGH promotion is OFF by default (imperceptible gain)", () => {
    expect(AUTO_PROMOTE_TO_HIGH).toBe(false);
    expect(decideFromCapabilities(report({}), dense)).toMatchObject({ start: "standard", ceiling: "standard", reason: "high-auto-promotion-disabled" });
  });
  test("fully capable HIGH but a viewport that cannot show the extra pixels -> ceiling STANDARD", () => {
    expect(decideFromCapabilities(report({}), ordinary, true).ceiling).toBe("standard");
    expect(decideFromCapabilities(report({}), { width: 1440, height: 900, dpr: 1 }, true).ceiling).toBe("standard");
  });
  test("STANDARD not smooth / unsupported but FALLBACK supported -> start and ceiling FALLBACK", () => {
    expect(decideFromCapabilities(report({}, { smooth: false }), dense)).toMatchObject({ start: "fallback", ceiling: "fallback" });
    expect(decideFromCapabilities(report({}, { supported: false, smooth: false }), dense).start).toBe("fallback");
  });
  test("missing / throwing / timed-out probe -> deterministic STANDARD, never HIGH", () => {
    expect(decideFromCapabilities(null, dense)).toMatchObject({ start: "standard", ceiling: "standard" });
    expect(decideFromCapabilities({}, dense).ceiling).toBe("standard");
  });
  test("viewport benefit is a device-pixel rule, not a fixed CSS width", () => {
    expect(viewportBenefitsFromHigh({ width: 1920, height: 1080, dpr: 1 })).toBe(false);
    expect(viewportBenefitsFromHigh({ width: 1920, height: 1080, dpr: 1.25 })).toBe(true);
    expect(viewportBenefitsFromHigh({ width: 1707, height: 1067, dpr: 1.5 })).toBe(true); // 2560x1600 laptop panel
    expect(viewportBenefitsFromHigh({ width: 1366, height: 768, dpr: 1 })).toBe(false);
    expect(viewportBenefitsFromHigh({ width: 2560, height: 1440, dpr: 1 })).toBe(true);
    expect(coverWidthInDevicePixels({ width: 1440, height: 900, dpr: 1 })).toBeCloseTo(1600, 0);
  });
});

test.describe("Test override parsing", () => {
  test("valid tiers only, dev/test only", () => {
    expect(parseQualityOverride("?transitionQuality=high", true)).toBe("high");
    expect(parseQualityOverride("?transitionQuality=fallback", true)).toBe("fallback");
    expect(parseQualityOverride("?transitionQuality=standard", true)).toBe("standard");
    expect(parseQualityOverride("?transitionQuality=ultra", true)).toBeNull();
    expect(parseQualityOverride("?transitionQuality=bypass", true)).toBeNull();
    expect(parseQualityOverride("", true)).toBeNull();
    expect(parseQualityOverride("?transitionQuality=high", false)).toBeNull(); // production build
    expect(parseAutoHighOverride("?transitionAutoHigh=1", true)).toBe(true);
    expect(parseAutoHighOverride("?transitionAutoHigh=1", false)).toBe(false); // production build
    expect(parseAutoHighOverride("", true)).toBe(false);
  });
});

/* ------------------------------------------------------- controller (pure) */
const feed = (c: TransitionQualityController, ms: number, count: number) => {
  for (let i = 0; i < count; i += 1) c.record(ms);
};

test.describe("Adaptive controller", () => {
  test("starts at STANDARD; capabilities alone never promote", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "standard" });
    c.applyCapabilityDecision({ start: "standard", ceiling: "high", reason: "test" });
    expect(c.tier).toBe("standard");
    expect(c.cap).toBe("high");
    expect(c.tierForNextStage()).toBe("standard"); // no evidence yet
  });

  test("promotion needs sustained EXCELLENT evidence (two spaced evaluations), not one good seek", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 5, QUALITY_THRESHOLDS.promoteMinSamples - 5);
    expect(c.evaluate()).toBe(false); // < promoteMinSamples
    feed(c, 5, QUALITY_THRESHOLDS.evalStride); // now above the minimum
    expect(c.evaluate()).toBe(false); // first excellent window: streak 1
    expect(c.tier).toBe("standard");
    feed(c, 5, QUALITY_THRESHOLDS.evalStride);
    expect(c.evaluate()).toBe(true); // second excellent window
    expect(c.tier).toBe("high");
    expect(c.events.map((e) => e.type)).toEqual(["promote"]);
  });

  test("never promotes past the capability ceiling", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "standard" });
    for (let i = 0; i < 6; i += 1) {
      feed(c, 4, 60);
      c.evaluate();
    }
    expect(c.tier).toBe("standard");
  });

  test("one merely-healthy window resets the promotion streak", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 5, 90);
    c.evaluate(); // excellent #1
    feed(c, 25, 100); // window is now dominated by healthy-band (25 ms) samples
    c.evaluate();
    expect(c.tier).toBe("standard");
    feed(c, 5, 120);
    c.evaluate(); // excellent #1 again
    expect(c.tier).toBe("standard");
  });

  test("a single outlier / brief hiccup does NOT demote", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 8, 90);
    c.record(900);
    c.record(700);
    c.evaluate();
    expect(c.tier).toBe("standard");
    expect(c.events).toHaveLength(0);
  });

  test("sustained DEGRADED performance demotes STANDARD -> FALLBACK after two evaluations", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 70, 45); // p50 70 ms: degraded but not severe
    expect(c.evaluate()).toBe(false); // streak 1
    feed(c, 70, QUALITY_THRESHOLDS.evalStride);
    expect(c.evaluate()).toBe(true);
    expect(c.tier).toBe("fallback");
    expect(c.cap).toBe("fallback");
  });

  test("severe stalls (hundreds of ms) demote after a single window", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 400, QUALITY_THRESHOLDS.demoteMinSamples + 5);
    expect(c.evaluate()).toBe(true);
    expect(c.tier).toBe("fallback");
  });

  test("hysteresis: after a demotion the tier is capped for the session and never flaps back up", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 5, 90);
    c.evaluate();
    feed(c, 5, 30);
    c.evaluate();
    expect(c.tier).toBe("high");
    // HIGH turns out to be bad: severe demotion needs the stronger post-promotion streak only when not severe.
    feed(c, 300, 45);
    expect(c.evaluate()).toBe(true);
    expect(c.tier).toBe("standard");
    expect(c.cap).toBe("standard");
    // Superb performance afterwards must NOT re-promote to HIGH.
    for (let i = 0; i < 8; i += 1) {
      feed(c, 3, 60);
      c.evaluate();
    }
    expect(c.tier).toBe("standard");
    expect(c.events.filter((e) => e.type === "promote")).toHaveLength(1);
  });

  test("demoting a tier earned by promotion needs a longer degraded streak (non-severe)", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "high" });
    feed(c, 5, 90);
    c.evaluate();
    feed(c, 5, 30);
    c.evaluate();
    expect(c.tier).toBe("high");
    for (let i = 0; i < 2; i += 1) {
      feed(c, 60, 45);
      c.evaluate();
      expect(c.tier).toBe("high");
    }
    feed(c, 60, 45);
    c.evaluate();
    expect(c.tier).toBe("standard");
  });

  test("load failure caps the ladder: HIGH -> STANDARD -> FALLBACK", () => {
    const c = new TransitionQualityController({ start: "high", ceiling: "high", adaptive: false });
    expect(c.noteLoadFailure("high")).toBe("standard");
    expect(c.cap).toBe("standard");
    expect(c.noteLoadFailure("standard")).toBe("fallback");
    expect(c.noteLoadFailure("fallback")).toBe("fallback"); // nothing lower: caller falls back to the scene hand-off
  });

  test("a late MediaCapabilities answer cannot lift a ceiling lowered by failures", () => {
    const c = new TransitionQualityController({ start: "standard", ceiling: "standard" });
    c.noteLoadFailure("high"); // cap high (no-op above standard)
    c.noteLoadFailure("standard");
    c.applyCapabilityDecision({ start: "standard", ceiling: "high", reason: "late" });
    expect(c.cap).toBe("fallback");
    expect(c.tier).toBe("fallback");
  });

  test("forced / non-adaptive controller ignores samples", () => {
    const c = new TransitionQualityController({ start: "high", ceiling: "high", adaptive: false });
    feed(c, 900, 200);
    expect(c.evaluate()).toBe(false);
    expect(c.tier).toBe("high");
  });

  test("classification bands", () => {
    expect(classifySamples(Array(100).fill(4), 40).verdict).toBe("excellent");
    expect(classifySamples(Array(100).fill(25), 40).verdict).toBe("healthy");
    expect(classifySamples(Array(100).fill(90), 40).verdict).toBe("degraded");
    expect(classifySamples(Array(10).fill(4), 40).verdict).toBe("insufficient");
    expect(classifySamples([...Array(88).fill(5), ...Array(12).fill(400)], 40).verdict).toBe("degraded"); // 12% stale
  });
});

/* ---------------------------------------------------------- browser helpers */
const DESKTOP = new Set(["1920x1080", "1440x900"]);
const MOBILE = new Set(["430x932", "390x844"]);

type McTable = Record<string, { supported: boolean; smooth: boolean; powerEfficient: boolean }>;

async function mockMediaCapabilities(page: Page, table: McTable = {}) {
  await page.addInitScript((tbl) => {
    const w = window as unknown as { __mcCalls: Array<{ height: number; framerate: number }> };
    w.__mcCalls = [];
    Object.defineProperty(navigator, "mediaCapabilities", {
      configurable: true,
      value: {
        decodingInfo: async (cfg: { video: { height: number; framerate: number } }) => {
          w.__mcCalls.push({ height: cfg.video.height, framerate: cfg.video.framerate });
          const key = `${cfg.video.height}p${cfg.video.framerate}`;
          return (tbl as Record<string, unknown>)[key] ?? { supported: true, smooth: true, powerEfficient: true };
        },
      },
    });
  }, table);
}

const transitionRequests = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (/kavachpay\/transitions\/.*\.mp4/.test(r.url())) urls.push(r.url().split("/").pop() as string);
  });
  return urls;
};

async function open(page: Page, query = "") {
  await page.goto(`/?intro=0&visualTest=1${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!(window as unknown as { __kpTransitionQuality?: unknown }).__kpTransitionQuality);
  await page.evaluate(() => document.fonts.ready);
}

async function scrollToBoundary(page: Page, id: string, progress: number) {
  await page.evaluate(
    ({ id, progress }) => {
      const el = document.querySelector<HTMLElement>(`[data-transition-track='${id}']`);
      if (!el) throw new Error(`no track ${id}`);
      const top = el.getBoundingClientRect().top + window.scrollY;
      const start = top - 64;
      const end = top + el.getBoundingClientRect().height + 64;
      window.scrollTo(0, start + progress * (end - start));
      (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
    },
    { id, progress },
  );
}

type QState = {
  quality: string;
  tier: string | null;
  cap: string | null;
  forced: string | null;
  adaptive: boolean | null;
  samples: number;
  events: Array<{ type: string; from: string; to: string; reason: string }>;
  staged: Array<{ id: string; tier: string | null; progress: number }>;
};
const qstate = (page: Page) => page.evaluate(() => (window as unknown as { __kpTransitionQuality: { state: () => QState } }).__kpTransitionQuality.state());
const inject = (page: Page, ms: number, n: number) =>
  page.evaluate(({ ms, n }) => (window as unknown as { __kpTransitionQuality: { inject: (l: number[]) => void } }).__kpTransitionQuality.inject(Array(n).fill(ms)), { ms, n });
const videoSrc = (page: Page, id: string) => page.evaluate((id) => document.querySelector<HTMLVideoElement>(`[data-transition-video='${id}']`)?.getAttribute("src") ?? null, id);
const mcCalls = (page: Page) => page.evaluate(() => (window as unknown as { __mcCalls?: unknown[] }).__mcCalls?.length ?? 0);
const stagedCount = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll("[data-transition-video]")).filter((v) => v.getAttribute("src")).length);

/* ------------------------------------------------------------- BYPASS tiers */
test.describe("BYPASS", () => {
  test("mobile -> BYPASS: no probe, no transition media, whole page scrolled", async ({ page }, testInfo) => {
    test.skip(!MOBILE.has(testInfo.project.name), "mobile projects only");
    await mockMediaCapabilities(page);
    const urls = transitionRequests(page);
    await open(page);
    for (const b of TRANSITION_REGISTRY) {
      await scrollToBoundary(page, b.id, 0.5);
      await page.waitForTimeout(150);
    }
    expect((await qstate(page)).quality).toBe("bypass");
    await expect(page.locator("[data-cinematic-transition-layer]")).toHaveAttribute("data-transition-quality", "bypass");
    expect(urls).toEqual([]);
    expect(await mcCalls(page)).toBe(0);
    expect(await stagedCount(page)).toBe(0);
  });

  test("prefers-reduced-motion -> BYPASS: no probe, no transition media", async ({ page }, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockMediaCapabilities(page);
    const urls = transitionRequests(page);
    await open(page);
    for (const b of TRANSITION_REGISTRY) {
      await scrollToBoundary(page, b.id, 0.5);
      await page.waitForTimeout(150);
    }
    expect((await qstate(page)).quality).toBe("bypass");
    expect(urls).toEqual([]);
    expect(await mcCalls(page)).toBe(0);
    expect(await stagedCount(page)).toBe(0);
  });
});

/* ---------------------------------------------- desktop default / overrides */
test.describe("Desktop tier selection", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
  });

  test("normal desktop starts at STANDARD (1080p120) and loads exactly that variant", async ({ page }) => {
    await mockMediaCapabilities(page);
    const urls = transitionRequests(page);
    await open(page);
    await expect.poll(async () => (await qstate(page)).staged[0].tier).toBe("standard");
    expect((await qstate(page)).quality).toBe("standard");
    expect(await videoSrc(page, "00-01")).toMatch(/00-01-opening-mandate\.rt-1080p120\.mp4$/);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/rt-1080p120\.mp4$/);
    // the probe ran on desktop, for exactly the three ladder configurations
    await expect.poll(() => mcCalls(page)).toBe(3);
  });

  for (const tier of ["fallback", "standard", "high"] as const) {
    test(`?transitionQuality=${tier} loads ONLY ${TRANSITION_TIER_SPECS[tier].suffix} across the first boundaries`, async ({ page }) => {
      await mockMediaCapabilities(page);
      const urls = transitionRequests(page);
      await open(page, `&transitionQuality=${tier}`);
      for (const id of ["00-01", "01-02", "02-03"]) {
        await scrollToBoundary(page, id, 0.5);
        await page.waitForFunction((id) => (document.querySelector<HTMLVideoElement>(`[data-transition-video='${id}']`)?.readyState ?? 0) >= 1, id);
      }
      const s = await qstate(page);
      expect(s.forced).toBe(tier);
      expect(s.quality).toBe(tier);
      expect(s.staged.filter((x) => x.tier).every((x) => x.tier === tier)).toBe(true);
      expect(urls.length).toBeGreaterThanOrEqual(3);
      for (const u of urls) expect(u).toContain(`.${TRANSITION_TIER_SPECS[tier].suffix}.mp4`);
      expect(await mcCalls(page)).toBe(0); // forced: no probe
    });
  }

  test("invalid override is ignored (falls back to the normal adaptive start)", async ({ page }) => {
    await mockMediaCapabilities(page);
    await open(page, "&transitionQuality=ultra");
    await expect.poll(async () => (await qstate(page)).staged[0].tier).toBe("standard");
    expect((await qstate(page)).forced).toBeNull();
  });

  test("staging stays bounded and holds exactly one variant per boundary through a full walk", async ({ page }) => {
    await mockMediaCapabilities(page);
    await open(page);
    let maxStaged = 0;
    for (const b of TRANSITION_REGISTRY) {
      for (const p of [0, 0.5, 1]) {
        await scrollToBoundary(page, b.id, p);
        await page.waitForTimeout(120);
        maxStaged = Math.max(maxStaged, await stagedCount(page));
        const s = await qstate(page);
        // one tier per staged boundary, and the attached file matches the recorded tier
        for (const st of s.staged.filter((x) => x.tier)) {
          const src = await videoSrc(page, st.id);
          const reg = TRANSITION_REGISTRY.find((x) => x.id === st.id)!;
          expect(src).toBe(reg.sources[st.tier as "fallback" | "standard" | "high"]);
        }
      }
    }
    expect(maxStaged).toBeLessThanOrEqual(3);
    expect(maxStaged).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------ load failures */
test.describe("Resource failure fallback", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
  });

  test("HIGH load failure -> STANDARD, no blank, scrubbing works", async ({ page }) => {
    await mockMediaCapabilities(page);
    await page.route("**/*rt-1440p120.mp4", (route) => route.fulfill({ status: 404 }));
    const urls = transitionRequests(page);
    await open(page, "&transitionQuality=high");
    await scrollToBoundary(page, "00-01", 0.5);
    await page.waitForFunction(() => {
      const v = document.querySelector<HTMLVideoElement>("[data-transition-video='00-01']");
      return !!v && v.duration > 0 && /1080p120/.test(v.currentSrc);
    });
    expect(urls.some((u) => u.includes("rt-1440p120"))).toBe(true);
    expect(urls.some((u) => u.includes("rt-1080p120"))).toBe(true);
    const s = await qstate(page);
    expect(s.tier).toBe("standard");
    expect(s.staged[0].tier).toBe("standard");
    expect(s.events.some((e) => e.reason.startsWith("load-failure:high"))).toBe(true);
    await page.waitForTimeout(150);
    const opacity = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-transition-video='00-01']")!).opacity));
    expect(opacity).toBeGreaterThan(0.9); // film is actually showing, not blank
  });

  test("STANDARD load failure -> FALLBACK", async ({ page }) => {
    await mockMediaCapabilities(page);
    await page.route("**/*rt-1080p120.mp4", (route) => route.fulfill({ status: 404 }));
    await open(page, "&transitionQuality=standard");
    await scrollToBoundary(page, "00-01", 0.5);
    await page.waitForFunction(() => {
      const v = document.querySelector<HTMLVideoElement>("[data-transition-video='00-01']");
      return !!v && v.duration > 0 && /1080p60/.test(v.currentSrc);
    });
    expect((await qstate(page)).tier).toBe("fallback");
  });

  test("HIGH + STANDARD failing chains down to FALLBACK; a later boundary starts on the surviving tier", async ({ page }) => {
    await mockMediaCapabilities(page);
    await page.route("**/*rt-1440p120.mp4", (route) => route.fulfill({ status: 404 }));
    await page.route("**/*rt-1080p120.mp4", (route) => route.fulfill({ status: 404 }));
    await open(page, "&transitionQuality=high");
    await scrollToBoundary(page, "00-01", 0.5);
    await page.waitForFunction(() => /1080p60/.test(document.querySelector<HTMLVideoElement>("[data-transition-video='00-01']")?.currentSrc ?? ""));
    await scrollToBoundary(page, "01-02", 0.5);
    await page.waitForFunction(() => /1080p60/.test(document.querySelector<HTMLVideoElement>("[data-transition-video='01-02']")?.currentSrc ?? ""));
    expect((await qstate(page)).cap).toBe("fallback");
  });
});

/* ------------------------------- MediaCapabilities -> cap, in the real layer */
test.describe("Capability ceiling in the browser (mocked MediaCapabilities)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
  });

  const cases: Array<[string, McTable, string]> = [
    ["HIGH unsupported", { "1440p120": { supported: false, smooth: false, powerEfficient: false } }, "standard"],
    ["HIGH supported but not smooth", { "1440p120": { supported: true, smooth: false, powerEfficient: true } }, "standard"],
    ["HIGH smooth but not power-efficient", { "1440p120": { supported: true, smooth: true, powerEfficient: false } }, "standard"],
    ["HIGH fully capable", {}, "high"],
  ];
  for (const [name, table, ceiling] of cases) {
    test.describe(name, () => {
      test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      test(`dense display -> ceiling ${ceiling}, start STANDARD`, async ({ page }) => {
        await mockMediaCapabilities(page, table);
        await open(page, "&transitionAutoHigh=1");
        await expect.poll(async () => (await qstate(page)).cap).toBe(ceiling);
        expect((await qstate(page)).tier).toBe("standard");
      });
    });
  }

  test.describe("fully capable but ordinary display", () => {
    test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    test("1920x1080 @1x -> HIGH not worth it, ceiling STANDARD", async ({ page }) => {
      await mockMediaCapabilities(page);
      await open(page, "&transitionAutoHigh=1");
      await expect.poll(() => mcCalls(page)).toBe(3);
      await expect.poll(async () => (await qstate(page)).cap).toBe("standard");
    });
  });

  test.describe("STANDARD not smooth", () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    test("start FALLBACK when the browser says 1080p120 will not play smoothly", async ({ page }) => {
      await mockMediaCapabilities(page, { "1080p120": { supported: true, smooth: false, powerEfficient: false } });
      await open(page);
      await expect.poll(async () => (await qstate(page)).tier).toBe("fallback");
    });
  });

  test.describe("probe throws", () => {
    test("uncertain capability -> STANDARD, no HIGH", async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "mediaCapabilities", { configurable: true, value: { decodingInfo: () => Promise.reject(new Error("nope")) } });
      });
      await open(page);
      await expect.poll(async () => (await qstate(page)).staged[0].tier).toBe("standard");
      expect((await qstate(page)).cap).toBe("standard");
    });
  });
});

/* ------------------------------------- promotion / demotion never mid-transition */
test.describe("Adaptive promotion / demotion (live layer)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!DESKTOP.has(testInfo.project.name), "desktop projects only");
  });
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  test("default policy: even fully capable + dense + excellent samples never promotes to HIGH", async ({ page }) => {
    await mockMediaCapabilities(page);
    await page.goto("/?intro=0&visualTest=1", { waitUntil: "load" });
    await page.waitForFunction(() => !!(window as unknown as { __kpTransitionQuality?: unknown }).__kpTransitionQuality);
    await expect.poll(() => mcCalls(page)).toBe(3);
    await expect.poll(async () => (await qstate(page)).cap).toBe("standard");
    for (let i = 0; i < 4; i += 1) await inject(page, 3, 60);
    const s = await qstate(page);
    expect(s.tier).toBe("standard");
    expect(s.events.filter((e) => e.type === "promote")).toHaveLength(0);
    expect(await videoSrc(page, "00-01")).toMatch(/rt-1080p120/);
  });

  test("promotion changes only FUTURE boundaries; the running transition keeps its source", async ({ page }) => {
    await mockMediaCapabilities(page);
    const urls = transitionRequests(page);
    await open(page, "&transitionAutoHigh=1");
    await expect.poll(async () => (await qstate(page)).cap).toBe("high");

    // Enter 00-01 (now active), load it, remember its exact source.
    await scrollToBoundary(page, "00-01", 0.5);
    await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-transition-video='00-01']")?.duration ?? 0) > 0);
    const activeSrcBefore = await videoSrc(page, "00-01");
    expect(activeSrcBefore).toMatch(/rt-1080p120/);

    // Excellent evidence arrives mid-transition -> promotion is decided...
    await inject(page, 4, 100);
    await inject(page, 4, QUALITY_THRESHOLDS.evalStride + 5);
    expect((await qstate(page)).tier).toBe("high");
    // ...but the active boundary must not change source, currentSrc or reset.
    expect(await videoSrc(page, "00-01")).toBe(activeSrcBefore);
    expect((await qstate(page)).staged[0].tier).toBe("standard");

    // The next not-yet-reached boundary uses HIGH.
    await scrollToBoundary(page, "01-02", 0.5);
    await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-transition-video='01-02']")?.duration ?? 0) > 0);
    expect(await videoSrc(page, "01-02")).toMatch(/rt-1440p120/);
    expect(urls.filter((u) => u.startsWith("01-02")).every((u) => u.includes("rt-1440p120"))).toBe(true);
  });

  test("a staged-but-unreached boundary is re-staged (old variant released) when quality changes", async ({ page }) => {
    await mockMediaCapabilities(page);
    await open(page, "&transitionAutoHigh=1");
    await expect.poll(async () => (await qstate(page)).staged[0].tier).toBe("standard");
    await expect.poll(async () => (await qstate(page)).cap).toBe("high");
    expect((await qstate(page)).staged[0].progress).toBe(0);
    await inject(page, 4, 100);
    await inject(page, 4, QUALITY_THRESHOLDS.evalStride + 5);
    await expect.poll(async () => (await qstate(page)).staged[0].tier).toBe("high");
    expect(await videoSrc(page, "00-01")).toMatch(/rt-1440p120/);
    expect(await stagedCount(page)).toBeLessThanOrEqual(2);
  });

  test("demotion changes only FUTURE boundaries and sticks for the session", async ({ page }) => {
    await mockMediaCapabilities(page);
    await open(page, "&transitionAutoHigh=1");
    await expect.poll(async () => (await qstate(page)).cap).toBe("high");
    await scrollToBoundary(page, "00-01", 0.5);
    await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-transition-video='00-01']")?.duration ?? 0) > 0);
    const srcBefore = await videoSrc(page, "00-01");

    await inject(page, 400, 60); // hundreds-of-ms seeks
    const s = await qstate(page);
    expect(s.tier).toBe("fallback");
    expect(s.cap).toBe("fallback");
    expect(await videoSrc(page, "00-01")).toBe(srcBefore); // running boundary untouched

    await scrollToBoundary(page, "01-02", 0.5);
    await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-transition-video='01-02']")?.duration ?? 0) > 0);
    expect(await videoSrc(page, "01-02")).toMatch(/rt-1080p60/);

    // Great samples afterwards do not bring HIGH back (hysteresis).
    await inject(page, 3, 300);
    expect((await qstate(page)).tier).toBe("fallback");
  });
});
