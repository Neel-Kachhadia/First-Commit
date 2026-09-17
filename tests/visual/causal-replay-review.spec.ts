import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
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

      // 08.01 PROVIDER RESULT in gate (0.20 - 0.29)
      if (progress >= 0.22 && progress <= 0.28) {
        const exposure0 = page.locator("[data-evidence-exposure='0']");
        await expect(exposure0).toBeVisible();
        const text = await exposure0.textContent();
        expect(text).toContain("08.01");
        expect(text).toContain("PROVIDER RESULT");
        expect(text).toContain("RCP-1081-ALLOW");
        expect(text).toContain("₹1,249");
      }

      // 08.02 EXECUTION in gate (0.29 - 0.37)
      if (progress >= 0.31 && progress <= 0.36) {
        const exposure1 = page.locator("[data-evidence-exposure='1']");
        await expect(exposure1).toBeVisible();
        const text = await exposure1.textContent();
        expect(text).toContain("08.02");
        expect(text).toContain("EXECUTION");
        expect(text).toContain("REQ-1081-01");
        expect(text).toContain("RAZORPAY");
      }

      // 08.03 DECISION in gate (0.37 - 0.48)
      if (progress >= 0.40 && progress <= 0.46) {
        const exposure2 = page.locator("[data-evidence-exposure='2']");
        await expect(exposure2).toBeVisible();
        const text = await exposure2.textContent();
        expect(text).toContain("08.03");
        expect(text).toContain("DECISION");
        expect(text).toContain("APPROVED // ALLOW");
        expect(text).toContain("AGENTCORE / CEDAR POLICY");
      }

      // 08.04 BUDGET STATE in gate with Temporal Three-Phase Proof (0.48 - 0.60)
      if (progress >= 0.50 && progress <= 0.58) {
        const exposure3 = page.locator("[data-evidence-exposure='3']");
        await expect(exposure3).toBeVisible();
        const text = await exposure3.textContent();
        expect(text).toContain("08.04");
        expect(text).toContain("BUDGET STATE");
        expect(text).toContain("BEFORE ATOMIC RESERVATION");
        expect(text).toContain("ATOMIC CAUSAL EVENT");
        expect(text).toContain("AFTER RESERVATION");
        expect(text).toContain("₹2,751");
        expect(text).toContain("₹0 PRIOR + ₹1,249 RESERVED + ₹2,751 REMAINING = ₹4,000");
      }

      // 08.05 AGENT PATH in gate (0.60 - 0.68)
      if (progress >= 0.62 && progress <= 0.67) {
        const exposure4 = page.locator("[data-evidence-exposure='4']");
        await expect(exposure4).toBeVisible();
        const text = await exposure4.textContent();
        expect(text).toContain("08.05");
        expect(text).toContain("AGENT PATH");
        expect(text).toContain("Grocery Agent");
      }

      // 08.06 AUTHORITY / DELEGATION in gate (0.68 - 0.77)
      if (progress >= 0.70 && progress <= 0.76) {
        const exposure5 = page.locator("[data-evidence-exposure='5']");
        await expect(exposure5).toBeVisible();
        const text = await exposure5.textContent();
        expect(text).toContain("08.06");
        expect(text).toContain("AUTHORITY / DELEGATION");
        expect(text).toContain("AUTH–0302");
        expect(text).toContain("SHOPPING AUTHORITY (AUTH–0301)");
      }

      // 08.07 MANDATE in gate (0.77 - 0.87)
      if (progress >= 0.79 && progress <= 0.85) {
        const exposure6 = page.locator("[data-evidence-exposure='6']");
        await expect(exposure6).toBeVisible();
        const text = await exposure6.textContent();
        expect(text).toContain("08.07");
        expect(text).toContain("MANDATE");
        expect(text).toContain("KP–1967–M");
        expect(text).toContain("₹4,000 / WEEK");
      }

      // 08.08 ORIGINAL INTENT in gate (Hero Origin Reveal, 0.87 - 0.96)
      if (progress >= 0.89 && progress <= 0.95) {
        const exposure7 = page.locator("[data-evidence-exposure='7']");
        await expect(exposure7).toBeVisible();
        const text = await exposure7.textContent();
        expect(text).toContain("08.08");
        expect(text).toContain("ORIGINAL INTENT");
        expect(text).toContain("“Buy groceries for me this week.”");
        expect(text).toContain("HUMAN OWNER (YOU)");
        expect(text).toContain("100% AUDITABLE LINEAGE TO HUMAN ROOT");
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
});
