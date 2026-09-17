import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { seekSceneProgress } from "./helpers/scene-checkpoints";

const supportedProjects = new Set(["1440x900", "390x844"]);

test("reduced-motion keeps the art direction and product record intact", async ({ page }, testInfo) => {
  test.skip(!supportedProjects.has(testInfo.project.name), "Reduced-motion visual gate runs at representative desktop and mobile sizes.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?visualTest=1", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const seekReducedScene = async (selector: string, progress = 0.72) => {
    await seekSceneProgress(page, selector, progress);
    const ownership = await page.evaluate(() => {
      const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
      return {
        visible: roots.filter((root) => getComputedStyle(root).visibility === "visible").map((root) => root.dataset.scene),
        semantic: roots.filter((root) => root.getAttribute("aria-hidden") === "false").map((root) => root.dataset.scene),
      };
    });
    expect(ownership.visible).toHaveLength(1);
    expect(ownership.semantic).toHaveLength(1);
  };

  const output = path.join(process.cwd(), "output", "playwright", "reduced-motion", testInfo.project.name);
  await mkdir(output, { recursive: true });

  await expect(page.locator("[data-opening-window]")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.screenshot({ path: path.join(output, "prologue.png"), animations: "disabled" });

  const mandateScene = page.locator("[data-scene='mandate']");
  await seekReducedScene("[data-scene='mandate']");
  await expect(mandateScene.getByRole("heading", { name: "GROCERY" })).toBeVisible();
  await expect(mandateScene.getByText("₹4,000 / WEEK")).toBeVisible();
  await page.screenshot({ path: path.join(output, "mandate.png"), animations: "disabled" });

  const decisionsScene = page.locator("[data-scene='decisions']");
  await seekReducedScene("[data-scene='decisions']");
  await expect(decisionsScene.getByRole("heading", { name: "ALLOW / STEP-UP / DENY" })).toBeVisible();
  await expect(decisionsScene.getByText("1,249", { exact: true })).toBeVisible();
  await expect(decisionsScene.getByText("4,900", { exact: true })).toBeVisible();
  await expect(decisionsScene.getByText("799", { exact: true })).toBeVisible();
  await expect(decisionsScene.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect(decisionsScene.getByText("STEP-UP REQUIRED", { exact: true })).toBeVisible();
  await expect(decisionsScene.getByText("DENIED", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, "decisions.png"), animations: "disabled" });

  const delegationScene = page.locator("[data-scene='delegation']");
  await seekReducedScene("[data-scene='delegation']");
  await expect(delegationScene.getByRole("heading", { name: "DELEGATION" })).toBeVisible();
  await expect(delegationScene.getByRole("heading", { name: "SHOPPING" })).toBeVisible();
  await expect(delegationScene.getByRole("heading", { name: "GROCERY" })).toBeVisible();
  await expect(delegationScene.getByRole("heading", { name: "DELIVERY" })).toBeVisible();
  await expect(delegationScene.getByText("2 LEVELS MAX // NO FURTHER DELEGATION")).toBeVisible();
  await expect(delegationScene.locator("[data-accounting-allocated]")).toHaveText("₹2,500");
  await expect(delegationScene.locator("[data-accounting-remaining]")).toHaveText("₹1,500");
  await page.screenshot({ path: path.join(output, "delegation.png"), animations: "disabled" });

  const stepUpScene = page.locator("[data-scene='step-up']");
  await seekReducedScene("[data-scene='step-up']");
  await expect(stepUpScene.getByRole("heading", { name: "STEP-UP" })).toBeVisible();
  await expect(stepUpScene.getByRole("heading", { name: "TRAVEL AUTHORIZATION REQUEST" })).toBeVisible();
  await expect(stepUpScene.locator("[data-clearance-document]").getByText("TRAVEL AGENT")).toBeVisible();
  await expect(stepUpScene.locator("[data-doc-amount-section]").getByText("4,900")).toBeVisible();
  await expect(stepUpScene.getByText("AUTOMATIC LIMIT ₹3,000")).toBeVisible();
  await expect(stepUpScene.getByText("HOLD FOR CLEARANCE")).toBeVisible();
  await expect(stepUpScene.getByText("REFER FOR APPROVAL")).toBeVisible();
  await expect(stepUpScene.getByText("CLEAR ONCE")).toBeVisible();
  await expect(stepUpScene.getByText("DECLINE")).toBeVisible();
  await page.screenshot({ path: path.join(output, "step-up.png"), animations: "disabled" });

  const revocationScene = page.locator("[data-scene='revocation']");
  await seekReducedScene("[data-scene='revocation']");
  await expect(revocationScene.getByRole("heading", { name: "REVOCATION" })).toBeVisible();
  await expect(revocationScene.locator("[data-record='AUTH-0301']")).toBeVisible();
  await expect(revocationScene.locator("[data-record='AUTH-0302']")).toBeVisible();
  await expect(revocationScene.locator("[data-record='AUTH-0303']")).toBeVisible();
  await expect(revocationScene.locator("[data-record='TX-1082']")).toBeVisible();
  await expect(revocationScene.locator("[data-stamp-revoked]")).toBeVisible();
  await expect(revocationScene.locator("[data-stamp-withdrawn='AUTH-0302']")).toBeVisible();
  await expect(revocationScene.locator("[data-stamp-withdrawn='AUTH-0303']")).toBeVisible();
  await expect(revocationScene.locator("[data-state-value='AUTH-0301']")).toHaveText("REVOKED");
  await expect(revocationScene.locator("[data-state-value='AUTH-0302']")).toHaveText("WITHDRAWN");
  await expect(revocationScene.locator("[data-state-value='AUTH-0303']")).toHaveText("WITHDRAWN");
  await expect(revocationScene.locator("[data-state-value='TX-1082']")).toHaveText("ACTIVE");
  await page.screenshot({ path: path.join(output, "revocation.png"), animations: "disabled" });

  const splitScene = page.locator("[data-scene='split-defense']");
  await seekReducedScene("[data-scene='split-defense']");
  await expect(splitScene.getByRole("heading", { name: "SPLIT-PAYMENT DEFENSE" })).toBeVisible();
  await expect(splitScene.locator("[data-split-receipt='TX-1091']")).toBeVisible();
  await expect(splitScene.locator("[data-split-receipt='TX-1092']")).toBeVisible();
  await expect(splitScene.locator("[data-split-receipt='TX-1093']")).toBeVisible();
  await expect(splitScene.locator("[data-stamp-economic-action]")).toBeVisible();
  await expect(splitScene.locator("[data-stamp-blocked]")).toBeVisible();
  await page.screenshot({ path: path.join(output, "split-defense.png"), animations: "disabled" });

  const concurrencyScene = page.locator("[data-scene='concurrency']");
  await seekReducedScene("[data-scene='concurrency']");
  await expect(concurrencyScene.getByRole("heading", { name: "BUDGET / CONCURRENCY" })).toBeVisible();
  await expect(concurrencyScene.locator("[data-concurrency-slip='TX-1094']")).toBeVisible();
  await expect(concurrencyScene.locator("[data-concurrency-slip='TX-1095']")).toBeVisible();
  await expect(concurrencyScene.locator("[data-balance-final]")).toBeVisible();
  await expect(concurrencyScene.locator("[data-stamp-reserved]")).toBeVisible();
  await expect(concurrencyScene.locator("[data-stamp-unavailable]")).toBeVisible();
  await expect(concurrencyScene.locator("[data-conservation-proof]")).toBeVisible();
  await page.screenshot({ path: path.join(output, "concurrency.png"), animations: "disabled" });

  const replayScene = page.locator("[data-scene='causal-replay']");
  await seekReducedScene("[data-scene='causal-replay']", 0.92);
  await expect(replayScene.getByRole("heading", { name: "CAUSAL REPLAY" })).toBeVisible();
  await expect(replayScene.locator("[data-replay-docket]")).toBeVisible();
  await expect(replayScene.locator("[data-evidence-exposure='0']")).toBeHidden();
  await expect(replayScene.locator("[data-evidence-exposure='7']")).toBeVisible();
  await expect(replayScene.locator("[data-full-chain]")).toBeVisible();
  await page.screenshot({ path: path.join(output, "causal-replay.png"), animations: "disabled" });
});
