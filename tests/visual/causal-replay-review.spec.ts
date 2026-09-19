import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  CAUSAL_REPLAY_STAGE_COUNT,
  CAUSAL_REPLAY_STAGE_WINDOWS,
  REPLAY_HOLD_FRACTION,
} from "../../src/lib/experience/causal-replay";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

const denseStepsDesktop = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  0.85, 0.9, 0.95, 1.0,
] as const;

const denseStepsStandard = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

test.describe("Scene 08 — Causal Replay / The Evidence Reel Visual & Semantic Verification", () => {
  test.describe.configure({ mode: "serial" });

  test("Evidence Reel: dense checkpoints, 8-stage forensic rewind, temporal budget state, and original intent origin", async ({
    page,
  }, testInfo) => {
    await prepareVisualPage(page);

    const scene = page.locator("[data-scene='causal-replay']");
    await scene.waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(
      process.cwd(),
      "output",
      "playwright",
      "checkpoints",
      testInfo.project.name,
      "causal-replay",
    );
    await mkdir(outputDir, { recursive: true });

    const isMasterViewport = testInfo.project.name === "1920x1080";
    const steps = isMasterViewport ? denseStepsDesktop : denseStepsStandard;

    for (const progress of steps) {
      await seekSceneProgress(page, "[data-scene='causal-replay']", progress);

      // Verify Archival Case Docket Carrier at boundary/early progress (TX-1081 Blinkit Grocery)
      if (progress <= 0.15) {
        const docket = page.locator("[data-replay-docket]");
        await expect(docket).toBeVisible();
        const docketText = await docket.textContent();
        expect(docketText).toContain("CASE DOCKET // TX–1081");
        expect(docketText).toContain("₹1,249");
        expect(docketText).toContain("BLINKIT");
      }

      // Verify Optical Gate Reticle becomes active as depth opens (0.12+)
      if (progress >= 0.15) {
        await expect(page.locator("[data-gate-reticle]")).toBeVisible();
      }

      // Terminal Full-Chain Spine (0.96+)
      if (progress >= 0.96) {
        await expect(page.locator("[data-full-chain]")).toBeVisible();
        const fullChainText = await page.locator("[data-full-chain]").textContent();
        expect(fullChainText).toContain("ONE OUTCOME. ONE UNBROKEN CAUSAL RECORD.");
        expect(fullChainText).toContain("08.01");
        expect(fullChainText).toContain("08.08");
      }

      // Capture screenshot checkpoint
      const padded = String(Math.round(progress * 100)).padStart(3, "0");
      const filename = `causal_replay_${padded}pct.png`;
      await page.screenshot({
        path: path.join(outputDir, filename),
      });
    }

    // Reverse Scrub Fidelity Test: rewinding back from terminal to origin and middle
    await seekSceneProgress(page, "[data-scene='causal-replay']", 1.0);
    await seekSceneProgress(page, "[data-scene='causal-replay']", 0.92);
    const revIntent = page.locator("[data-evidence-exposure='7']");
    await expect(revIntent).toBeVisible();

    await seekSceneProgress(page, "[data-scene='causal-replay']", 0.54);
    const revBudget = page.locator("[data-evidence-exposure='3']");
    await expect(revBudget).toBeVisible();

    await seekSceneProgress(page, "[data-scene='causal-replay']", 0.24);
    const revResult = page.locator("[data-evidence-exposure='0']");
    await expect(revResult).toBeVisible();
  });

  test("each authored window holds its own exposure on the gate with the full canonical evidence", async ({ page }) => {
    await prepareVisualPage(page);
    await page.locator("[data-scene='causal-replay']").waitFor({ state: "attached", timeout: 15_000 });
    // Expectations per exposure (RESULT -> ORIGIN rewind). Each is evaluated in the middle of its own hold:
    // the window boundaries are the shared schedule's, not hard-coded percentages.
    const expected: Record<number, string[]> = {
      0: ["08.01", "PROVIDER RESULT", "RCP-1081-ALLOW", "₹1,249"],
      1: ["08.02", "EXECUTION", "REQ-1081-01", "RAZORPAY"],
      2: ["08.03", "DECISION", "APPROVED // ALLOW", "AGENTCORE / CEDAR POLICY"],
      3: ["08.04", "BUDGET STATE", "BEFORE ATOMIC RESERVATION", "ATOMIC CAUSAL EVENT", "AFTER RESERVATION", "₹2,751", "₹0 PRIOR + ₹1,249 RESERVED + ₹2,751 REMAINING = ₹4,000"],
      4: ["08.05", "AGENT PATH", "Grocery Agent"],
      5: ["08.06", "AUTHORITY / DELEGATION", "AUTH–0302", "SHOPPING AUTHORITY (AUTH–0301)"],
      6: ["08.07", "MANDATE", "KP–1967–M", "₹4,000 / WEEK"],
      7: ["08.08", "ORIGINAL INTENT", "“Buy groceries for me this week.”", "HUMAN OWNER (YOU)", "100% AUDITABLE LINEAGE TO HUMAN ROOT"],
    };
    for (let i = 0; i < CAUSAL_REPLAY_STAGE_COUNT; i += 1) {
      const [a, b] = CAUSAL_REPLAY_STAGE_WINDOWS[i];
      await seekSceneProgress(page, "[data-scene='causal-replay']", a + (b - a) * REPLAY_HOLD_FRACTION * 0.5);
      const exposure = page.locator(`[data-evidence-exposure='${i}']`);
      await expect(exposure, `exposure ${i} on the gate`).toBeVisible();
      expect(Number(await exposure.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.99);
      const text = (await exposure.textContent()) ?? "";
      for (const needle of expected[i]) expect(text, `exposure ${i} must contain ${needle}`).toContain(needle);
    }
  });
});
