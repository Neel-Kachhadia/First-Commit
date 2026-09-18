import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareVisualPage, seekSceneProgress } from "./helpers/scene-checkpoints";

test.use({
  viewport: { width: 1920, height: 1080 },
  video: {
    mode: "on",
    size: { width: 1920, height: 1080 },
  },
});

test.describe("Scene 01 to Scene 02 Editorial Splice Boundary Review", () => {
  test("Forward and reverse boundary scrub across Mandate (0.70 - 1.00) and Decisions (0.00 - 0.26)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='mandate']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "boundary");
    await mkdir(outputDir, { recursive: true });

    // =========================================================================
    // 1. FORWARD PROGRESSION ACROSS BOUNDARY
    // =========================================================================

    // Step A: Mandate 0.76 — Resting Completed-Authority Contract
    await seekSceneProgress(page, "[data-scene='mandate']", 0.76);
    await page.waitForTimeout(100);
    const sealVisible = await page.locator("[data-mandate-seal]").isVisible();
    const stampVisible = await page.locator("[data-mandate-stamp]").isVisible();
    const sheetVisible = await page.locator("[data-mandate-sheet]").isVisible();
    expect(sealVisible).toBe(true);
    expect(stampVisible).toBe(true);
    expect(sheetVisible).toBe(true);
    await page.screenshot({ path: path.join(outputDir, "01_mandate_0.76_completed_rest.png") });

    // Step B: Mandate 0.84 — Resting Hold sustained, prior to splice initiation
    await seekSceneProgress(page, "[data-scene='mandate']", 0.84);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, "02_mandate_0.84_resting_hold.png") });

    // Step C: Mandate 0.87 — Editorial Splice: Horizontal administrative rules extend across viewport
    await seekSceneProgress(page, "[data-scene='mandate']", 0.87);
    await page.waitForTimeout(80);
    const spliceGeomOpacity = await page.locator("[data-mandate-splice-geom]").evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(spliceGeomOpacity)).toBeGreaterThan(0.8);
    // Mandate document & intent ticket remain fully present during rule extension
    const intentDuringExtension = await page.locator("[data-mandate-intent]").isVisible();
    expect(intentDuringExtension).toBe(true);
    await page.screenshot({ path: path.join(outputDir, "03_mandate_0.87_rules_extended.png") });

    // Step D: Mandate 0.91 — Physical Paper Departure: Carrier advances & crops into registration shutter
    await seekSceneProgress(page, "[data-scene='mandate']", 0.91);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, "04_mandate_0.91_shutter_departure.png") });

    // Step E: Mandate 0.99 — Paper Cleared, Administrative rules establish framing structure.
    // Current implementation departs the carrier via physical y-translation + late opacity
    // fade over 0.87-0.99 (see MandateScene.tsx "No razor clipPath!" — clipPath was
    // intentionally removed in favor of physical displacement + power2.in easing), so the
    // invariant is that the carrier has physically cleared the viewport by the END of its
    // departure window, not a clipPath string. Empirically verified: at 0.96 the carrier is
    // only ~42% departed (bottom ~577px, still on-screen) because of the accelerating ease —
    // full clearance lands at 0.99 (bottom ~-108px). Checking at 0.96, as the original stale
    // assertion did, would fail even with a correct geometry check; this is a timing note for
    // Mandate's own (frozen, out-of-scope) interior, not an ownership bug.
    await seekSceneProgress(page, "[data-scene='mandate']", 0.99);
    await page.waitForTimeout(80);
    const carrierRect = await page.locator("[data-mandate-paper-carrier]").evaluate((el) => el.getBoundingClientRect());
    const viewportHeight = page.viewportSize()?.height ?? 1080;
    expect(carrierRect.bottom).toBeLessThan(viewportHeight * 0.1);
    await page.screenshot({ path: path.join(outputDir, "05_mandate_0.99_paper_cleared_rules_bridge.png") });

    // Step F: Mandate 1.00 — Ready for instantaneous cut to Decisions
    await seekSceneProgress(page, "[data-scene='mandate']", 1.00);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, "06_mandate_1.00_cut_point.png") });

    // Step G: Decisions 0.00 — Editorial Splice Cut Point: Rules continuous, Typography begins unrevealed at rule boundary
    await seekSceneProgress(page, "[data-scene='decisions']", 0.00);
    await page.waitForTimeout(100);
    const decisionsVisibleAt0 = await page.locator("[data-scene='decisions']").isVisible();
    expect(decisionsVisibleAt0).toBe(true);

    // Verify ALLOW / STEP-UP / DENY are primed at full scale without snapping into view (opacity 0, clip at top rule)
    const stateAt0 = await page.evaluate(() => {
      const getTransformScale = (el: HTMLElement) => {
        const st = window.getComputedStyle(el).transform;
        if (!st || st === "none") return 1;
        const matrix = st.match(/^matrix\((.+)\)$/);
        if (matrix) {
          const values = matrix[1].split(", ");
          return Math.sqrt(parseFloat(values[0]) ** 2 + parseFloat(values[1]) ** 2);
        }
        return 1;
      };
      const allow = document.querySelector<HTMLElement>("[data-lane-tag='allow']");
      const stepup = document.querySelector<HTMLElement>("[data-lane-tag='stepup']");
      const deny = document.querySelector<HTMLElement>("[data-lane-tag='deny']");
      return {
        allowScale: allow ? getTransformScale(allow) : 0,
        stepupScale: stepup ? getTransformScale(stepup) : 0,
        denyScale: deny ? getTransformScale(deny) : 0,
        allowOpacity: allow ? parseFloat(window.getComputedStyle(allow).opacity) : 1,
      };
    });
    expect(stateAt0.allowScale).toBeGreaterThan(2.0);
    expect(stateAt0.stepupScale).toBeGreaterThan(2.0);
    expect(stateAt0.denyScale).toBeGreaterThan(2.0);
    expect(stateAt0.allowOpacity).toBeLessThan(0.05);

    // Verify operational lanes NOT shown yet at 0.00 (letters and track lines hidden)
    const letterOpacityAt0 = await page.locator("[data-lane-letter='allow']").evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(letterOpacityAt0)).toBeLessThan(0.1);
    await page.screenshot({ path: path.join(outputDir, "07_decisions_0.00_threshold_registration_start.png") });

    // Step H: Decisions 0.018 — Registration Reveal in flight: Typography emerges vertically from rules
    await seekSceneProgress(page, "[data-scene='decisions']", 0.018);
    await page.waitForTimeout(80);
    const opacityAt018 = await page.locator("[data-lane-tag='allow']").evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
    expect(opacityAt018).toBeGreaterThan(0.2);
    expect(opacityAt018).toBeLessThan(0.95);
    await page.screenshot({ path: path.join(outputDir, "08_decisions_0.018_registration_in_flight.png") });

    // Step I: Decisions 0.045 — Full Threshold Family Registered & Sustained Hold
    await seekSceneProgress(page, "[data-scene='decisions']", 0.045);
    await page.waitForTimeout(80);
    const opacityAt045 = await page.locator("[data-lane-tag='allow']").evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
    expect(opacityAt045).toBeGreaterThan(0.95);
    await page.screenshot({ path: path.join(outputDir, "09_decisions_0.045_threshold_hold_sustained.png") });

    // Step J: Decisions 0.12 — Coordinated Contraction underway
    await seekSceneProgress(page, "[data-scene='decisions']", 0.12);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, "10_decisions_0.12_contraction.png") });

    // Step K: Decisions 0.22 — Operational Lanes Settled
    await seekSceneProgress(page, "[data-scene='decisions']", 0.22);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, "11_decisions_0.22_settled_lanes.png") });

    // Step L: Decisions 0.26 — Receipt Glides into Lane A
    await seekSceneProgress(page, "[data-scene='decisions']", 0.26);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, "12_decisions_0.26_receipt_enter.png") });

    // =========================================================================
    // 2. REVERSE SCRUB ACROSS BOUNDARY
    // =========================================================================

    // Scrub back through Decisions: 0.26 -> 0.12 -> 0.05 -> 0.018 -> 0.00
    for (const p of [0.22, 0.16, 0.10, 0.05, 0.018, 0.00]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      await page.waitForTimeout(50);
    }

    // Verify reverse threshold restoration at Decisions 0.00: scales restored, opacity smoothly retracted
    const stateAfterReverse = await page.evaluate(() => {
      const getTransformScale = (el: HTMLElement) => {
        const st = window.getComputedStyle(el).transform;
        if (!st || st === "none") return 1;
        const matrix = st.match(/^matrix\((.+)\)$/);
        if (matrix) {
          const values = matrix[1].split(", ");
          return Math.sqrt(parseFloat(values[0]) ** 2 + parseFloat(values[1]) ** 2);
        }
        return 1;
      };
      const allow = document.querySelector<HTMLElement>("[data-lane-tag='allow']");
      const stepup = document.querySelector<HTMLElement>("[data-lane-tag='stepup']");
      const deny = document.querySelector<HTMLElement>("[data-lane-tag='deny']");
      return {
        allowScale: allow ? getTransformScale(allow) : 0,
        stepupScale: stepup ? getTransformScale(stepup) : 0,
        denyScale: deny ? getTransformScale(deny) : 0,
        allowOpacity: allow ? parseFloat(window.getComputedStyle(allow).opacity) : 1,
      };
    });
    expect(stateAfterReverse.allowScale).toBeGreaterThan(2.0);
    expect(stateAfterReverse.stepupScale).toBeGreaterThan(2.0);
    expect(stateAfterReverse.denyScale).toBeGreaterThan(2.0);
    expect(stateAfterReverse.allowOpacity).toBeLessThan(0.05);

    // Cross boundary back into Mandate: 1.00 -> 0.96 -> 0.91 -> 0.86 -> 0.76
    for (const p of [1.00, 0.96, 0.91, 0.86, 0.80, 0.76]) {
      await seekSceneProgress(page, "[data-scene='mandate']", p);
      await page.waitForTimeout(60);
    }

    // Verify Mandate is 100% restored with settled seal and intact contract. The paper
    // carrier departs via y-translation + opacity (no clipPath — see "No razor clipPath!"
    // in MandateScene.tsx), so restoration is verified by opacity/visibility, not clipPath.
    await seekSceneProgress(page, "[data-scene='mandate']", 0.76);
    const restoredSeal = await page.locator("[data-mandate-seal]").isVisible();
    const restoredCarrierOpacity = await page.locator("[data-mandate-paper-carrier]").evaluate((el) => window.getComputedStyle(el).opacity);
    expect(restoredSeal).toBe(true);
    expect(parseFloat(restoredCarrierOpacity)).toBeGreaterThan(0.95);

    await page.screenshot({ path: path.join(outputDir, "13_mandate_0.76_restored_after_reverse.png") });

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_01_to_02_boundary_splice.webm");
    }
  });

  test("Dense Boundary QA: Sub-frame inspection across rule bridge, registration reveal, and threshold hold", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Dense boundary QA targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='mandate']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });

    const denseOutputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "dense_boundary");
    await mkdir(denseOutputDir, { recursive: true });

    // 1. Rule bridge frames in Mandate (0.96, 0.98, 1.00)
    for (const p of [0.96, 0.98, 1.00]) {
      await seekSceneProgress(page, "[data-scene='mandate']", p);
      await page.waitForTimeout(50);
      const filename = `mandate_${p.toFixed(2)}.png`;
      await page.screenshot({ path: path.join(denseOutputDir, filename) });
    }

    // 2. High temporal density through threshold registration reveal (0.000 to 0.050 in 0.005 steps)
    const samples: { progress: number; opacity: number; clip: string }[] = [];
    for (let p = 0.000; p <= 0.050; p += 0.005) {
      const roundedP = Math.round(p * 1000) / 1000;
      await seekSceneProgress(page, "[data-scene='decisions']", roundedP);
      await page.waitForTimeout(50);

      const data = await page.evaluate(() => {
        const allow = document.querySelector<HTMLElement>("[data-lane-tag='allow']");
        if (!allow) return { opacity: 0, clip: "" };
        const cs = window.getComputedStyle(allow);
        return {
          opacity: parseFloat(cs.opacity),
          clip: cs.clipPath || allow.style.clipPath,
        };
      });

      samples.push({ progress: roundedP, opacity: data.opacity, clip: data.clip });
      const filename = `decisions_${roundedP.toFixed(3)}.png`;
      await page.screenshot({ path: path.join(denseOutputDir, filename) });
    }

    // Assert visible interpolation: no single adjacent 0.005 step jumps by > 0.40 opacity
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const delta = Math.abs(curr.opacity - prev.opacity);
      expect(delta).toBeLessThanOrEqual(0.40);
    }

    // At 0.000: opacity is 0 (zero snap at boundary cut)
    expect(samples[0].opacity).toBeLessThan(0.05);

    // At 0.035+: opacity reaches full prominence (>= 0.90)
    const settled = samples.find((o) => o.progress >= 0.035);
    expect(settled?.opacity).toBeGreaterThan(0.90);
  });

  test("Mobile 430x932: Forward and reverse boundary scrub", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Runs once in master runner with mobile viewport");
    await page.setViewportSize({ width: 430, height: 932 });
    await prepareVisualPage(page);

    await page.locator("[data-scene='mandate']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "boundary_mobile");
    await mkdir(outputDir, { recursive: true });

    // Mandate 0.76: Resting sealed contract
    await seekSceneProgress(page, "[data-scene='mandate']", 0.76);
    expect(await page.locator("[data-mandate-seal]").isVisible()).toBe(true);
    await page.screenshot({ path: path.join(outputDir, "01_mandate_0.76_mobile.png") });

    // Mandate 0.87: Rule extension
    await seekSceneProgress(page, "[data-scene='mandate']", 0.87);
    await page.screenshot({ path: path.join(outputDir, "02_mandate_0.87_mobile.png") });

    // Mandate 0.96: Paper cleared, rules bridge
    await seekSceneProgress(page, "[data-scene='mandate']", 0.96);
    await page.screenshot({ path: path.join(outputDir, "03_mandate_0.96_mobile.png") });

    // Decisions 0.00: Large Threshold hold
    await seekSceneProgress(page, "[data-scene='decisions']", 0.00);
    expect(await page.locator("[data-scene='decisions']").isVisible()).toBe(true);
    await page.screenshot({ path: path.join(outputDir, "04_decisions_0.00_mobile.png") });

    // Decisions 0.12: Contraction underway
    await seekSceneProgress(page, "[data-scene='decisions']", 0.12);
    await page.screenshot({ path: path.join(outputDir, "05_decisions_0.12_mobile.png") });

    // Decisions 0.22: Settled lanes
    await seekSceneProgress(page, "[data-scene='decisions']", 0.22);
    await page.screenshot({ path: path.join(outputDir, "06_decisions_0.22_mobile.png") });

    // Reverse scrub back to Decisions 0.00 then Mandate 0.76
    for (const p of [0.12, 0.00]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      await page.waitForTimeout(40);
    }
    for (const p of [1.00, 0.95, 0.87, 0.76]) {
      await seekSceneProgress(page, "[data-scene='mandate']", p);
      await page.waitForTimeout(40);
    }

    // Verify restored state on mobile. Carrier departs via y-translation + opacity, not
    // clipPath (see MandateScene.tsx "No razor clipPath!"), so restoration is opacity-based.
    await seekSceneProgress(page, "[data-scene='mandate']", 0.76);
    expect(await page.locator("[data-mandate-seal]").isVisible()).toBe(true);
    const restoredOpacity = await page.locator("[data-mandate-paper-carrier]").evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(restoredOpacity)).toBeGreaterThan(0.95);
    await page.screenshot({ path: path.join(outputDir, "07_mandate_0.76_restored_mobile.png") });

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_01_to_02_boundary_splice_mobile.webm");
    }
  });
});

test.describe("Scene 03 to Scene 04 Editorial Splice Boundary Review", () => {
  test("Forward and reverse boundary scrub across Delegation (0.90 - 1.00) and Step-Up (0.00 - 0.20)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='delegation']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='step-up']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "boundary_03_04");
    await mkdir(outputDir, { recursive: true });

    // =========================================================================
    // 1. FORWARD PROGRESSION ACROSS SCENE 03 -> 04 BOUNDARY
    // =========================================================================

    // Step A: Scene 03 (Delegation) terminal states
    const s03Steps = [0.90, 0.95, 1.00];
    for (const p of s03Steps) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      await page.waitForTimeout(60);

      // Verify Scene 03 sealed boundary and authority passes are present
      expect(await page.locator("[data-sealed-boundary]").isVisible()).toBe(true);
      expect(await page.locator("[data-delegation-parent]").isVisible()).toBe(true);

      // Verify no white background. Scene stages are intentionally transparent
      // (position:absolute overlays sharing one black plane) — the authoritative
      // "no white gap" source is the persistent cinematic stage underneath.
      const stageBg = await page.locator("[data-cinematic-stage]").evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(stageBg).toBe("rgb(9, 10, 8)");

      await page.screenshot({ path: path.join(outputDir, `01_delegation_${p.toFixed(2)}.png`) });
    }

    // Step B: Scene 04 (Step-Up) handoff dense steps
    const s04HandoffSteps = [0.00, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20];
    for (const p of s04HandoffSteps) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      await page.waitForTimeout(60);

      // Step-Up scene must be visible and owning the stage
      expect(await page.locator("[data-scene='step-up']").isVisible()).toBe(true);

      // Verify Authority Folio, Header, Rails, and Datum bar are active
      expect(await page.locator("[data-authority-folio]").isVisible()).toBe(true);
      expect(await page.locator("[data-stepup-header]").isVisible()).toBe(true);
      expect(await page.locator("[data-execution-route]").isVisible()).toBe(true);
      expect(await page.locator("[data-registration-bar]").isVisible()).toBe(true);

      // Authority folio must carry Scene 03 context
      const folioText = await page.locator("[data-authority-folio]").textContent();
      expect(folioText).toContain("03 // AUTHORITY FOLIO:");
      expect(folioText).toContain("SHOPPING / GROCERY / DELIVERY");

      // Verify background is strictly near-black (no white gap). Scene sections are
      // intentionally transparent overlays; the shared cinematic stage owns the fill.
      const sceneBg = await page.locator("[data-cinematic-stage]").evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(sceneBg).toBe("rgb(9, 10, 8)");

      await page.screenshot({ path: path.join(outputDir, `02_stepup_${p.toFixed(2)}.png`) });
    }

    // =========================================================================
    // 2. REVERSE SCRUB ACROSS BOUNDARY
    // =========================================================================

    // Scrub back through Step-Up: 0.20 -> 0.15 -> 0.10 -> 0.06 -> 0.02 -> 0.00
    for (const p of [0.15, 0.10, 0.06, 0.02, 0.00]) {
      await seekSceneProgress(page, "[data-scene='step-up']", p);
      await page.waitForTimeout(40);
    }

    // Cross boundary back into Delegation: 1.00 -> 0.95 -> 0.90
    for (const p of [1.00, 0.95, 0.90]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      await page.waitForTimeout(40);
      expect(await page.locator("[data-sealed-boundary]").isVisible()).toBe(true);
    }

    // Verify terminal restoration in Scene 03 after reverse scrub
    await seekSceneProgress(page, "[data-scene='delegation']", 1.00);
    expect(await page.locator("[data-sealed-boundary]").isVisible()).toBe(true);
    expect(await page.locator("[data-accounting-remaining]").textContent()).toBe("₹1,500");
    expect(await page.locator("[data-accounting-allocated]").textContent()).toBe("₹2,500");
    await page.screenshot({ path: path.join(outputDir, "03_delegation_1.00_restored_after_reverse.png") });

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_03_to_04_boundary_splice.webm");
    }
  });
});

test.describe("Scene 02 to Scene 03 Editorial Splice Boundary Review", () => {
  test("Forward and reverse boundary scrub across Decisions (0.90 - 1.00) and Delegation (0.00 - 0.20)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "1920x1080", "Boundary video recording targeted to 1920x1080 master viewport");
    await prepareVisualPage(page);

    await page.locator("[data-scene='decisions']").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator("[data-scene='delegation']").waitFor({ state: "attached", timeout: 15_000 });

    const outputDir = path.join(process.cwd(), "output", "playwright", "checkpoints", "boundary_02_03");
    await mkdir(outputDir, { recursive: true });

    // =========================================================================
    // 1. FORWARD PROGRESSION ACROSS SCENE 02 -> 03 BOUNDARY
    // =========================================================================

    // Step A: Decisions terminal states (0.90, 0.95, 1.00)
    for (const p of [0.90, 0.95, 1.00]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      await page.waitForTimeout(60);

      // Verify Decisions stage is visible and background is strictly near-black.
      // Scene stages are intentionally transparent overlays; the shared cinematic
      // stage underneath owns the actual black fill.
      expect(await page.locator("[data-scene='decisions']").isVisible()).toBe(true);
      const stageBg = await page.locator("[data-cinematic-stage]").evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(stageBg).toBe("rgb(9, 10, 8)");

      // At 1.00, verify outgoing Decision Register is resolved for handoff
      if (p === 1.00) {
        expect(await page.locator("[data-decision-register-outgoing]").isVisible()).toBe(true);
      }

      await page.screenshot({ path: path.join(outputDir, `01_decisions_${p.toFixed(2)}.png`) });
    }

    // Step B: Delegation handoff dense steps (0.00, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20)
    const s03HandoffSteps = [0.00, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20];
    for (const p of s03HandoffSteps) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      await page.waitForTimeout(60);

      // Delegation must be visible and owning the stage
      expect(await page.locator("[data-scene='delegation']").isVisible()).toBe(true);

      // Decision register must carry the filed evidence across the boundary
      expect(await page.locator("[data-decision-register]").isVisible()).toBe(true);
      const regText = await page.locator("[data-decision-register]").textContent();
      expect(regText).toContain("02 // ARCHIVE:");
      expect(regText).toContain("DECISION REGISTER");

      // Shopping parent pass must be present and visible (ZERO dead stage!)
      expect(await page.locator("[data-delegation-parent]").isVisible()).toBe(true);

      // Verify stage background is near-black (no white gap). Scene stages are
      // intentionally transparent overlays; the shared cinematic stage owns the fill.
      const stageBg = await page.locator("[data-cinematic-stage]").evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(stageBg).toBe("rgb(9, 10, 8)");

      await page.screenshot({ path: path.join(outputDir, `02_delegation_${p.toFixed(2)}.png`) });
    }

    // =========================================================================
    // 2. REVERSE SCRUB ACROSS BOUNDARY
    // =========================================================================
    for (const p of [0.15, 0.10, 0.06, 0.02, 0.00]) {
      await seekSceneProgress(page, "[data-scene='delegation']", p);
      await page.waitForTimeout(40);
    }

    for (const p of [1.00, 0.95, 0.90]) {
      await seekSceneProgress(page, "[data-scene='decisions']", p);
      await page.waitForTimeout(40);
      expect(await page.locator("[data-lane='allow']").isVisible()).toBe(true);
      expect(await page.locator("[data-lane='stepup']").isVisible()).toBe(true);
      expect(await page.locator("[data-lane='deny']").isVisible()).toBe(true);
    }

    await page.screenshot({ path: path.join(outputDir, "03_decisions_1.00_restored_after_reverse.png") });

    await page.waitForTimeout(300);

    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs("output/playwright/motion-video/scene_02_to_03_boundary_splice.webm");
    }
  });
});

test.describe("Global Scene Boundary Geometry & Invariant Assertions", () => {
  test("Assert mathematical boundary handoffs and visibility ownership across all 5 viewports", async ({ page }) => {
    await prepareVisualPage(page);

    const boundaryData = await page.evaluate(() => {
      // Persistent-stage architecture pins each scene's timeline to its own
      // `[data-track='...']` segment in the invisible scroll track, NOT to the
      // `[data-scene='...']` section itself — the section is a fixed-position
      // overlay with no scroll height of its own. Matching against `[data-scene]`
      // here always returned undefined (this lookup was stale against that
      // architecture), making invariants 0-3 vacuously true (0 - 0 <= 2) and
      // invariant 4 scroll to y=0 for every scene. Fixed to match the real trigger.
      const getST = (trackId: string) => {
        const el = document.querySelector(`[data-track='${trackId}']`);
        const all = (window as unknown as { ScrollTrigger?: { getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }> } }).ScrollTrigger?.getAll?.() ?? [];
        return all.find((t) => t.trigger === el);
      };

      const getTransitionHeight = (id: string) => {
        const el = document.querySelector(`[data-transition-track='${id}']`);
        return el ? el.getBoundingClientRect().height : 0;
      };

      const prologue = getST("prologue");
      const mandate = getST("mandate");
      const decisions = getST("decisions");
      const delegation = getST("delegation");
      const stepUp = getST("step-up");

      return {
        prologueEnd: prologue?.end ?? 0,
        mandateStart: mandate?.start ?? 0,
        mandateEnd: mandate?.end ?? 0,
        decisionsStart: decisions?.start ?? 0,
        decisionsEnd: decisions?.end ?? 0,
        delegationStart: delegation?.start ?? 0,
        delegationEnd: delegation?.end ?? 0,
        stepUpStart: stepUp?.start ?? 0,
        stepUpEnd: stepUp?.end ?? 0,
        t0001: getTransitionHeight("00-01"),
        t0102: getTransitionHeight("01-02"),
        t0203: getTransitionHeight("02-03"),
        t0304: getTransitionHeight("03-04"),
      };
    });

    // Invariants 0-3: each pair of consecutive scene tracks is separated by
    // exactly its dedicated cinematic-transition scroll spacer (the video
    // transition layer's own scroll distance) — no unexplained gap, and no
    // longer flush against each other now that boundary videos own that space.
    expect(
      Math.abs(boundaryData.mandateStart - boundaryData.prologueEnd - boundaryData.t0001),
    ).toBeLessThanOrEqual(2);

    expect(
      Math.abs(boundaryData.decisionsStart - boundaryData.mandateEnd - boundaryData.t0102),
    ).toBeLessThanOrEqual(2);

    expect(
      Math.abs(boundaryData.delegationStart - boundaryData.decisionsEnd - boundaryData.t0203),
    ).toBeLessThanOrEqual(2);

    expect(
      Math.abs(boundaryData.stepUpStart - boundaryData.delegationEnd - boundaryData.t0304),
    ).toBeLessThanOrEqual(2);

    // Invariant 4: Incoming sections are visible when scroll reaches their start
    for (const [sceneSel, startVal] of [
      ["[data-scene='mandate']", boundaryData.mandateStart],
      ["[data-scene='decisions']", boundaryData.decisionsStart],
      ["[data-scene='delegation']", boundaryData.delegationStart],
      ["[data-scene='step-up']", boundaryData.stepUpStart],
    ] as const) {
      await page.evaluate((y) => {
        window.scrollTo(0, y);
        window.dispatchEvent(new Event("scroll"));
        (window as unknown as { ScrollTrigger?: { update?: () => void } }).ScrollTrigger?.update?.();
      }, startVal);
      await page.waitForTimeout(50);

      const isVis = await page.locator(sceneSel).evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return cs.visibility === "visible" && cs.display !== "none";
      });
      expect(isVis).toBe(true);
    }
  });
});


