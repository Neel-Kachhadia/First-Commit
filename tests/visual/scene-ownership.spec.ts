import { test, expect } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";
import { readOwnership, readCarrierGeometry } from "./helpers/ownership";

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe("Carrier physical congruence — outgoing and incoming copies must occupy the same rect", () => {
  test("Decision Register (02->03): outgoing/incoming rects match within 1px whenever both are visible", async ({ page }) => {
    await prepareVisualPage(page);
    const steps = [0.955, 0.958, 0.96, 0.965, 0.97, 0.975, 0.98, 0.985, 0.99, 0.995, 1.0];
    for (const p of steps) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const g = await readCarrierGeometry(page, "[data-decision-register-outgoing]", "[data-decision-register]");
      if (!g) continue;
      // Only assert congruence once the incoming copy has actually begun to
      // appear — before that it's legitimately at its own natural (different)
      // resting position, just invisible, which is correct and not a bug.
      if (g.incOpacity <= 0.05) continue;
      expect(g.deltaX, `register deltaX @${p}`).toBeLessThanOrEqual(1);
      expect(g.deltaY, `register deltaY @${p}`).toBeLessThanOrEqual(1);
      expect(g.deltaWidth, `register deltaWidth @${p}`).toBeLessThanOrEqual(1);
      expect(g.deltaHeight, `register deltaHeight @${p}`).toBeLessThanOrEqual(1);
    }
    // Reverse direction — same invariant must hold scrubbing backward.
    for (const p of [...steps].reverse()) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const g = await readCarrierGeometry(page, "[data-decision-register-outgoing]", "[data-decision-register]");
      if (!g || g.incOpacity <= 0.05) continue;
      expect(g.deltaY, `register reverse deltaY @${p}`).toBeLessThanOrEqual(1);
      expect(g.deltaHeight, `register reverse deltaHeight @${p}`).toBeLessThanOrEqual(1);
    }
  });

  test("Decision Register (02->03): congruence holds at mobile viewports too", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await prepareVisualPage(page);
    for (const p of [0.96, 0.975, 0.99, 1.0]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const g = await readCarrierGeometry(page, "[data-decision-register-outgoing]", "[data-decision-register]");
      if (!g || g.incOpacity <= 0.05) continue;
      expect(g.deltaY, `mobile register deltaY @${p}`).toBeLessThanOrEqual(1);
      expect(g.deltaHeight, `mobile register deltaHeight @${p}`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Scene ownership — no stacked complete scenes, no duplicate carriers", () => {
  test("Decisions -> Delegation boundary: dense scrub never shows 2 full bodies or duplicate register", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.90, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `decisions@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
      expect(o.decisionRegisterCount, `decisions@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.0, 0.02, 0.04, 0.06, 0.10]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `delegation@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
      expect(o.decisionRegisterCount, `delegation@${p}`).toBeLessThanOrEqual(1);
    }
  });

  test("Delegation -> Step-Up boundary: dense scrub never shows 2 full bodies or duplicate folio", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.90, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `delegation@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
      expect(o.authorityFolioCount, `delegation@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.0, 0.02, 0.04, 0.06, 0.10]) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `step-up@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
      expect(o.authorityFolioCount, `step-up@${p}`).toBeLessThanOrEqual(1);
    }
  });

  test("Step-Up -> Revocation boundary: dense scrub never shows 2 full bodies or duplicate folio/register", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.90, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `step-up@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
      expect(o.authorityFolioCount, `step-up@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.0, 0.02, 0.04, 0.06, 0.10]) {
      await seekSceneProgress(page, "[data-scene='revocation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `revocation@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
      expect(o.authorityFolioCount, `revocation@${p}`).toBeLessThanOrEqual(1);
    }
  });

  test("Revocation -> Split-Defense boundary: dense scrub never shows 2 full bodies or duplicate folio", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.90, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='revocation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `revocation@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.0, 0.02, 0.04, 0.06, 0.10]) {
      await seekSceneProgress(page, "[data-scene='split-defense']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `split-defense@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
    }
  });

  test("Split-Defense -> Concurrency boundary: dense scrub never shows 2 full bodies or duplicate folio", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.90, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='split-defense']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `split-defense@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.0, 0.02, 0.04, 0.06, 0.10]) {
      await seekSceneProgress(page, "[data-scene='concurrency']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `concurrency@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
    }
  });

  test("Concurrency -> Causal Replay boundary: dense forward and reverse scrub stays single-owner", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.90, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='concurrency']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `concurrency@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0, 0.02, 0.04, 0.06, 0.1]) {
      await seekSceneProgress(page, "[data-scene='causal-replay']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `causal-replay@${p}: ${JSON.stringify(o.roots)}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.1, 0.06, 0.02, 0]) {
      await seekSceneProgress(page, "[data-scene='causal-replay']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `causal-replay-reverse@${p}`).toBeLessThanOrEqual(1);
    }
  });

  test("Reverse scrub across all boundaries stays single-owner", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.10, 0.06, 0.02, 0.0]) {
      await seekSceneProgress(page, "[data-scene='concurrency']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `concurrency-rev@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [1.0, 0.98, 0.94, 0.90]) {
      await seekSceneProgress(page, "[data-scene='split-defense']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `split-defense-rev2@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.10, 0.06, 0.02, 0.0]) {
      await seekSceneProgress(page, "[data-scene='split-defense']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `split-defense-rev@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [1.0, 0.98, 0.94, 0.90]) {
      await seekSceneProgress(page, "[data-scene='revocation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `revocation-rev@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.10, 0.06, 0.02, 0.0]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `delegation-rev@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [1.0, 0.98, 0.94, 0.90]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `decisions-rev@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.10, 0.06, 0.02, 0.0]) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `stepup-rev@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [1.0, 0.98, 0.94, 0.90]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      const o = await readOwnership(page);
      expect(o.visibleRootCount, `delegation-rev2@${p}`).toBeLessThanOrEqual(1);
    }
  });
});
