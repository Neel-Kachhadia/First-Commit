import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "@playwright/test";
import {
  checkpointProgress,
  checkpointScenes,
  prepareVisualPage,
  seekSceneProgress,
} from "./helpers/scene-checkpoints";

test.describe("Opening + Mandate visual checkpoints", () => {
  test.describe.configure({ mode: "serial" });

  for (const scene of checkpointScenes) {
    test(`${scene.name}: 0/25/50/75/100`, async ({ page }, testInfo) => {
      await prepareVisualPage(page);
      await page
        .locator(scene.selector)
        .waitFor({ state: "attached", timeout: 15_000 });

      const sceneOutput = path.join(
        process.cwd(),
        "output",
        "playwright",
        "checkpoints",
        testInfo.project.name,
        scene.name,
      );
      await mkdir(sceneOutput, { recursive: true });

      for (const progress of checkpointProgress) {
        await seekSceneProgress(page, scene.selector, progress);
        await page.screenshot({
          path: path.join(sceneOutput, `${progress}.png`),
          animations: "allow",
          caret: "hide",
          fullPage: false,
        });
      }
    });
  }
});
