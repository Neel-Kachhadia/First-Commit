import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareVisualPage, getTrackBounds } from "./helpers/scene-checkpoints";
import { readOwnership } from "./helpers/ownership";

test.use({ viewport: { width: 1920, height: 1080 } });

const BOUNDARIES = [
  { name: "02-03", outgoing: "decisions", incoming: "delegation" },
  { name: "03-04", outgoing: "delegation", incoming: "step-up" },
  { name: "04-05", outgoing: "step-up", incoming: "revocation" },
  { name: "05-06", outgoing: "revocation", incoming: "split-defense" },
  { name: "06-07", outgoing: "split-defense", incoming: "concurrency" },
  { name: "07-08", outgoing: "concurrency", incoming: "causal-replay" },
] as const;

async function scrollToAbsolute(page: import("@playwright/test").Page, y: number) {
  await page.evaluate((target) => {
    window.scrollTo(0, target);
    window.dispatchEvent(new Event("scroll"));
    (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
  }, y);
  await page.waitForFunction((target) => Math.abs(window.scrollY - target) < 2, y);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

function assertSingleOwner(o: Awaited<ReturnType<typeof readOwnership>>, label: string) {
  expect(o.visibleRootCount, `${label}: visible roots ${JSON.stringify(o.visibleRootIds)}`).toBeLessThanOrEqual(1);
  expect(o.decisionRegisterCount, `${label}: decision register dominant count`).toBeLessThanOrEqual(1);
  expect(o.authorityFolioCount, `${label}: authority folio dominant count`).toBeLessThanOrEqual(1);
  expect(o.authorityRegisterCount, `${label}: authority register dominant count`).toBeLessThanOrEqual(1);
  // Catches the case a naive count would miss: two copies both at ~70% at once.
  expect(o.decisionRegisterOpacitySum, `${label}: decision register opacity sum`).toBeLessThanOrEqual(1.15);
  expect(o.authorityFolioOpacitySum, `${label}: authority folio opacity sum`).toBeLessThanOrEqual(1.15);
  expect(o.authorityRegisterOpacitySum, `${label}: authority register opacity sum`).toBeLessThanOrEqual(1.15);
}

test.describe("Refresh-at-boundary ownership", () => {
  for (const { name, outgoing } of BOUNDARIES) {
    for (const frac of [0.25, 0.5, 0.75]) {
      test(`${name}: reload at ${frac * 100}% into handoff reconstructs correct ownership`, async ({ page }) => {
        await prepareVisualPage(page);
        const outBounds = await getTrackBounds(page, outgoing);
        // "Handoff" window: the shared boundary pixel is outgoing.end === incoming.start.
        // 0% = deep in outgoing's own territory just before the boundary carrier bridge
        // starts, 100% = comfortably inside incoming. Sample across that span.
        const span = 200; // px on each side of the boundary — covers both bridge windows
        const boundaryPx = outBounds.end;
        const target = Math.round(boundaryPx - span + frac * span * 2);

        await scrollToAbsolute(page, target);
        const before = await readOwnership(page);
        assertSingleOwner(before, `${name}@${frac} before reload`);

        // Reload the page (normal production lifecycle — no manual style patching).
        await page.reload({ waitUntil: "networkidle" });
        await page.evaluate(async () => {
          await document.fonts.ready;
        });

        const after = await readOwnership(page);
        assertSingleOwner(after, `${name}@${frac} after reload`);
        expect(Math.abs((await page.evaluate(() => window.scrollY)) - target), `${name}@${frac} restored scroll`).toBeLessThanOrEqual(2);

        const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "refresh-boundary");
        await mkdir(outputDir, { recursive: true });
        await page.screenshot({ path: path.join(outputDir, `${name}_${Math.round(frac * 100)}pct_after_reload.png`) });
      });
    }
  }
});

test.describe("Resize-at-boundary ownership", () => {
  for (const { name, outgoing } of BOUNDARIES) {
    test(`${name}: sequential viewport resize at 50% handoff holds ownership`, async ({ page }) => {
      await prepareVisualPage(page);
      const outBounds = await getTrackBounds(page, outgoing);
      const boundaryPx = outBounds.end;
      const target = boundaryPx; // midpoint of the shared carrier-bridge window

      await scrollToAbsolute(page, target);

      const sizes = [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 430, height: 932 },
        { width: 932, height: 430 },
        { width: 390, height: 844 },
        { width: 1920, height: 1080 },
      ];

      const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "resize-boundary");
      await mkdir(outputDir, { recursive: true });

      for (const size of sizes) {
        await page.setViewportSize(size);
        // Recompute the boundary pixel for the new viewport (track heights are
        // vh-based, so absolute px targets shift with viewport height). GSAP's
        // own resize listener debounces its refresh, so stale start/end values
        // can outlive a short fixed wait and exceed the new document height —
        // force the recalculation synchronously instead of guessing a delay.
        await page.evaluate(() => (window as unknown as { ScrollTrigger?: { refresh?: () => void } }).ScrollTrigger?.refresh?.());
        await page.waitForTimeout(150);
        const freshBounds = await getTrackBounds(page, outgoing);
        await scrollToAbsolute(page, freshBounds.end);

        const o = await readOwnership(page);
        assertSingleOwner(o, `${name}@${size.width}x${size.height}`);

        await page.screenshot({
          path: path.join(outputDir, `${name}_${size.width}x${size.height}.png`),
        });
      }
    });
  }
});

test.describe("Explicit ScrollTrigger.refresh() at boundary midpoint", () => {
  for (const { name, outgoing } of BOUNDARIES) {
    test(`${name}: ScrollTrigger.refresh() preserves ownership and progress`, async ({ page }) => {
      await prepareVisualPage(page);
      const outBounds = await getTrackBounds(page, outgoing);
      await scrollToAbsolute(page, outBounds.end);

      const before = await readOwnership(page);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      assertSingleOwner(before, `${name} before refresh()`);

      await page.evaluate(() => {
        (window as unknown as { ScrollTrigger?: { refresh?: () => void } }).ScrollTrigger?.refresh?.();
      });
      await page.waitForTimeout(100);

      const after = await readOwnership(page);
      const scrollAfter = await page.evaluate(() => window.scrollY);
      assertSingleOwner(after, `${name} after refresh()`);
      // refresh() must not silently relocate the scroll position or duplicate carriers.
      expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(2);
      expect(after.visibleRootIds).toEqual(before.visibleRootIds);
    });
  }
});

test.describe("Fast / orientation-like resize torture", () => {
  test("430x932 -> 932x430 -> 390x844 never shows 2 full scenes or a blank stage", async ({ page }) => {
    await prepareVisualPage(page);
    const bounds = await getTrackBounds(page, "delegation");
    await scrollToAbsolute(page, Math.round((bounds.start + bounds.end) / 2));

    for (const size of [
      { width: 430, height: 932 },
      { width: 932, height: 430 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(150);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `${size.width}x${size.height}: ${JSON.stringify(o.visibleRootIds)}`).toBeGreaterThanOrEqual(1);
      expect(o.visibleRootCount, `${size.width}x${size.height}`).toBeLessThanOrEqual(2);
    }
  });
});

test.describe("Deep-scroll initialization", () => {
  for (const sceneId of ["delegation", "step-up", "revocation", "split-defense", "concurrency", "causal-replay"] as const) {
    test(`Direct load then jump straight into ${sceneId} initializes correct single-owner state`, async ({ page }) => {
      await prepareVisualPage(page);
      const bounds = await getTrackBounds(page, sceneId);
      const deepTarget = Math.round(bounds.start + (bounds.end - bounds.start) * 0.5);

      await scrollToAbsolute(page, deepTarget);

      const o = await readOwnership(page);
      expect(o.visibleRootIds, `deep load into ${sceneId}`).toEqual([sceneId]);
      assertSingleOwner(o, `deep load into ${sceneId}`);

      // No previous scene should require having been scrolled through first.
      const staleVisible = o.staleInlineStyles.filter((s) => s.id !== sceneId && s.inlineVisibility === "visible");
      expect(staleVisible, `stale visible inline styles: ${JSON.stringify(staleVisible)}`).toEqual([]);
    });
  }
});

test.describe("Fast-scroll ownership torture", () => {
  test("Large scroll deltas landing inside every deep scene settle to single ownership", async ({ page }) => {
    await prepareVisualPage(page);
    for (const sceneId of ["delegation", "step-up", "revocation", "split-defense", "concurrency", "causal-replay"] as const) {
      const bounds = await getTrackBounds(page, sceneId);
      const target = Math.round(bounds.start + (bounds.end - bounds.start) * 0.6);

      // Simulate a large, discontinuous scroll delta (fast wheel flick) rather than
      // a smooth incremental scrub.
      await scrollToAbsolute(page, 0);
      await scrollToAbsolute(page, target);

      const o = await readOwnership(page);
      assertSingleOwner(o, `fast-scroll settle at ${sceneId}`);
      expect(o.visibleRootIds, `fast-scroll settle at ${sceneId}`).toEqual([sceneId]);
    }
  });
});

test.describe("Reverse torture", () => {
  test("Aggressive reverse from Revocation through Decisions, then forward again, stays single-owner", async ({ page }) => {
    await prepareVisualPage(page);
    const revocation = await getTrackBounds(page, "revocation");

    await scrollToAbsolute(page, revocation.end - 10);
    let o = await readOwnership(page);
    assertSingleOwner(o, "reverse-start at revocation end");

    const stepUp = await getTrackBounds(page, "step-up");
    const delegation = await getTrackBounds(page, "delegation");
    const decisions = await getTrackBounds(page, "decisions");

    const reversePath = [
      revocation.start + 10,
      stepUp.end - 10,
      stepUp.start + 10,
      delegation.end - 10,
      delegation.start + 10,
      decisions.end - 10,
    ];
    for (const y of reversePath) {
      await scrollToAbsolute(page, y);
      o = await readOwnership(page);
      assertSingleOwner(o, `reverse torture @${y}`);
    }

    // Now forward again, slowly, back up to Revocation.
    const forwardPath = [
      decisions.end - 10,
      delegation.start + 10,
      delegation.end - 10,
      stepUp.start + 10,
      stepUp.end - 10,
      revocation.start + 10,
    ];
    for (const y of forwardPath) {
      await scrollToAbsolute(page, y);
      o = await readOwnership(page);
      assertSingleOwner(o, `forward-after-reverse-torture @${y}`);
    }
  });
});
