import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "@playwright/test";
import {
  prepareVisualPage,
  seekSceneProgress,
} from "./helpers/scene-checkpoints";

const standardDenseProgress = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
] as const;

const decisionsDenseProgress = [
  0, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175, 0.20, 0.225, 0.25,
  0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.0,
] as const;

const scenes = [
  { name: "prologue", selector: "[data-scene='prologue']" },
  { name: "mandate", selector: "[data-scene='mandate']" },
  { name: "decisions", selector: "[data-scene='decisions']" },
] as const;

test.describe("Dense transition checkpoints (0% to 100% by 10%)", () => {
  test.describe.configure({ mode: "serial" });

  for (const scene of scenes) {
    test(`${scene.name}: dense steps`, async ({ page }, testInfo) => {
      page.on("console", (msg) => console.log(msg.text()));
      await prepareVisualPage(page);
      await page
        .locator(scene.selector)
        .waitFor({ state: "attached", timeout: 15_000 });

      const sceneOutput = path.join(
        process.cwd(),
        "output",
        "playwright",
        "dense",
        testInfo.project.name,
        scene.name,
      );
      await mkdir(sceneOutput, { recursive: true });

      const progressList =
        scene.name === "decisions"
          ? decisionsDenseProgress
          : standardDenseProgress;

      for (const progress of progressList) {
        await seekSceneProgress(page, scene.selector, progress);
        const filename = `${(progress * 100).toFixed(1).replace(/\.0$/, "")}.png`;
        await page.screenshot({
          path: path.join(sceneOutput, filename),
          animations: "allow",
          caret: "hide",
          fullPage: false,
        });
      }
    });
  }
});
