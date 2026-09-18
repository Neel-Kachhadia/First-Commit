import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";
import { readOwnership } from "./helpers/ownership";

type Boundary = {
  slug: string;
  outgoing: string;
  incoming: string;
  outgoingSelector: string;
  incomingSelector: string;
  carrierKey: "decisionRegisterCount" | "authorityFolioCount";
};

const BOUNDARIES: Boundary[] = [
  {
    slug: "02_to_03",
    outgoing: "decisions",
    incoming: "delegation",
    outgoingSelector: "[data-scene='decisions']",
    incomingSelector: "[data-scene='delegation']",
    carrierKey: "decisionRegisterCount",
  },
  {
    slug: "03_to_04",
    outgoing: "delegation",
    incoming: "step-up",
    outgoingSelector: "[data-scene='delegation']",
    incomingSelector: "[data-scene='step-up']",
    carrierKey: "authorityFolioCount",
  },
  {
    slug: "04_to_05",
    outgoing: "step-up",
    incoming: "revocation",
    outgoingSelector: "[data-scene='step-up']",
    incomingSelector: "[data-scene='revocation']",
    carrierKey: "authorityFolioCount",
  },
];

const VIEWPORTS = ["1920x1080", "430x932", "390x844"] as const;

test.use({ video: { mode: "on" } });

for (const vpName of VIEWPORTS) {
  test.describe(`Boundary videos @ ${vpName}`, () => {
    for (const b of BOUNDARIES) {
      test(`${b.slug} ownership-final: forward, slow scrub, reverse`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== vpName, `Recorded once per intended viewport (${vpName})`);
        await prepareVisualPage(page);

        await page.locator(b.outgoingSelector).waitFor({ state: "attached", timeout: 15_000 });
        await page.locator(b.incomingSelector).waitFor({ state: "attached", timeout: 15_000 });

        const stillsDir = path.join(process.cwd(), "output", "playwright", "checkpoints", `videos_${b.slug}_${vpName}`);
        await mkdir(stillsDir, { recursive: true });

        // Outgoing complete resting state.
        await seekSceneProgress(page, b.outgoingSelector, 0.90);
        await page.waitForTimeout(80);
        let o = await readOwnership(page);
        expect(o.visibleRootIds, `${b.slug}@${vpName} outgoing 0.90`).toEqual([b.outgoing]);
        await page.screenshot({ path: path.join(stillsDir, "01_outgoing_complete.png") });

        // Slow dense scrub through the outgoing tail into the handoff.
        for (const p of [0.92, 0.94, 0.96, 0.98, 1.0]) {
          await seekSceneProgress(page, b.outgoingSelector, p);
          await page.waitForTimeout(60);
          o = await readOwnership(page);
          expect(o.visibleRootCount, `${b.slug}@${vpName} outgoing@${p}`).toBeLessThanOrEqual(1);
          expect(o[b.carrierKey], `${b.slug}@${vpName} carrier@outgoing ${p}`).toBeLessThanOrEqual(1);
        }
        await page.screenshot({ path: path.join(stillsDir, "02_handoff_midpoint.png") });

        // Slow dense scrub establishing the incoming scene.
        for (const p of [0.0, 0.02, 0.04, 0.06, 0.08, 0.10]) {
          await seekSceneProgress(page, b.incomingSelector, p);
          await page.waitForTimeout(60);
          o = await readOwnership(page);
          expect(o.visibleRootCount, `${b.slug}@${vpName} incoming@${p}`).toBeLessThanOrEqual(1);
          expect(o[b.carrierKey], `${b.slug}@${vpName} carrier@incoming ${p}`).toBeLessThanOrEqual(1);
        }
        o = await readOwnership(page);
        expect(o.visibleRootIds, `${b.slug}@${vpName} incoming established`).toEqual([b.incoming]);
        await page.screenshot({ path: path.join(stillsDir, "03_incoming_established.png") });

        // Reverse scrub back across the same boundary.
        for (const p of [0.08, 0.04, 0.0]) {
          await seekSceneProgress(page, b.incomingSelector, p);
          await page.waitForTimeout(50);
        }
        for (const p of [1.0, 0.96, 0.92, 0.90]) {
          await seekSceneProgress(page, b.outgoingSelector, p);
          await page.waitForTimeout(50);
          o = await readOwnership(page);
          expect(o.visibleRootCount, `${b.slug}@${vpName} reverse@${p}`).toBeLessThanOrEqual(1);
        }
        o = await readOwnership(page);
        expect(o.visibleRootIds, `${b.slug}@${vpName} restored after reverse`).toEqual([b.outgoing]);
        await page.screenshot({ path: path.join(stillsDir, "04_restored_after_reverse.png") });

        await page.waitForTimeout(300);

        const video = page.video();
        if (video) {
          await page.close();
          const outDir = path.join(process.cwd(), "output", "playwright", "motion-video");
          await mkdir(outDir, { recursive: true });
          const suffix = vpName === "1920x1080" ? "" : `_${vpName}`;
          await video.saveAs(path.join(outDir, `scene_${b.slug}_ownership_final${suffix}.webm`));
        }
      });
    }
  });
}
