import { test, expect } from "@playwright/test";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";
import { readOwnership } from "./helpers/ownership";

test.use({ viewport: { width: 1920, height: 1080 } });

/**
 * Isolated-scene invariant (Phase 1 motion reset): at every point on the
 * scroll track, exactly one scene root is visible -- never zero (a dead
 * gap between chapters), never two (a stacked/leaking carrier). No shared
 * boundary choreography exists any more, so ownership must switch cleanly
 * at each track edge with no intermediate state.
 */
test.describe("Scene ownership — exactly one visible root at every boundary", () => {
  const boundaries: Array<[string, string]> = [
    ["prologue", "mandate"],
    ["mandate", "decisions"],
    ["decisions", "delegation"],
    ["delegation", "step-up"],
    ["step-up", "revocation"],
    ["revocation", "split-defense"],
    ["split-defense", "concurrency"],
    ["concurrency", "causal-replay"],
  ];

  for (const [outgoing, incoming] of boundaries) {
    test(`${outgoing} -> ${incoming}: dense scrub never shows 0 or 2 visible roots`, async ({ page }) => {
      await prepareVisualPage(page);
      for (const p of [0.9, 0.94, 0.96, 0.98, 1.0]) {
        await seekSceneProgress(page, `[data-scene='${outgoing}']`, p);
        const o = await readOwnership(page);
        expect(o.visibleRootCount, `${outgoing}@${p}: ${JSON.stringify(o.roots)}`).toBe(1);
      }
      for (const p of [0.0, 0.02, 0.04, 0.06, 0.1]) {
        await seekSceneProgress(page, `[data-scene='${incoming}']`, p);
        const o = await readOwnership(page);
        expect(o.visibleRootCount, `${incoming}@${p}: ${JSON.stringify(o.roots)}`).toBe(1);
      }
      // Reverse direction across the same boundary.
      for (const p of [0.1, 0.06, 0.04, 0.02, 0.0]) {
        await seekSceneProgress(page, `[data-scene='${incoming}']`, p);
        const o = await readOwnership(page);
        expect(o.visibleRootCount, `${incoming}-rev@${p}: ${JSON.stringify(o.roots)}`).toBe(1);
      }
      for (const p of [1.0, 0.98, 0.96, 0.94, 0.9]) {
        await seekSceneProgress(page, `[data-scene='${outgoing}']`, p);
        const o = await readOwnership(page);
        expect(o.visibleRootCount, `${outgoing}-rev@${p}: ${JSON.stringify(o.roots)}`).toBe(1);
      }
    });
  }

  test("Decisions -> Delegation boundary: no duplicate decision register", async ({ page }) => {
    await prepareVisualPage(page);
    for (const p of [0.9, 0.94, 0.96, 0.98, 1.0]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      const o = await readOwnership(page);
      expect(o.decisionRegisterCount, `decisions@${p}`).toBeLessThanOrEqual(1);
    }
    for (const p of [0.0, 0.02, 0.04, 0.06, 0.1]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      const o = await readOwnership(page);
      expect(o.decisionRegisterCount, `delegation@${p}`).toBeLessThanOrEqual(1);
    }
  });
});
