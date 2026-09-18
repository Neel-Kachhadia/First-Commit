import { expect, test, type Page } from "@playwright/test";
import { prepareVisualPage } from "./helpers/scene-checkpoints";

test.use({
  viewport: { width: 1440, height: 900 },
  video: { mode: "on", size: { width: 1440, height: 900 } },
});

type PrototypeState = {
  boundary: string | null;
  progress: number;
  owner: string | null;
  visibleRoots: string[];
  semanticRoots: string[];
  decisionsSupport: number;
  delegationParent: number;
  outgoingCarrier: number;
  incomingCarrier: number;
};

async function readState(page: Page) {
  return page.evaluate<PrototypeState>(() => {
    const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
    const opacity = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element ? Number.parseFloat(getComputedStyle(element).opacity) : 0;
    };
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
    return {
      boundary: stage?.dataset.activeBoundary ?? null,
      progress: Number(stage?.dataset.boundaryProgress ?? 0),
      owner: stage?.dataset.activeScene ?? null,
      visibleRoots: roots
        .filter((root) => getComputedStyle(root).visibility === "visible")
        .map((root) => root.dataset.scene ?? ""),
      semanticRoots: roots
        .filter((root) => root.getAttribute("aria-hidden") === "false" && !root.inert)
        .map((root) => root.dataset.scene ?? ""),
      decisionsSupport: opacity("[data-lanes-board]"),
      delegationParent: opacity("[data-delegation-parent]"),
      outgoingCarrier: opacity("[data-decision-evidence-outgoing]"),
      incomingCarrier: opacity("[data-decision-evidence-incoming]"),
    };
  });
}

async function seekBoundary(page: Page, progress: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>("[data-track='decisions']");
    if (!track) throw new Error("Missing Decisions track");
    const center = track.offsetTop + track.offsetHeight;
    const distance = Math.min(720, Math.max(480, window.innerHeight * 0.6));
    window.scrollTo(0, center - distance / 2 + distance * p);
    window.ScrollTrigger?.update();
  }, progress);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

test("02→03 shared-boundary migration remains continuous forward, reverse, stopped and oscillated", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "1440x900", "One deterministic migration recording.");
  await prepareVisualPage(page);
  await page.locator("[data-scene='delegation']").waitFor({ state: "attached" });

  const states: PrototypeState[] = [];
  for (const p of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.56, 0.6, 0.7, 0.8, 0.9, 1]) {
    await seekBoundary(page, p);
    const state = await readState(page);
    if (!state.boundary) {
      console.log("0203-debug", p, state, await page.evaluate(() => ({
        y: window.scrollY,
        h: window.innerHeight,
        global: document.querySelector<HTMLElement>("[data-cinematic-stage]")?.dataset.globalProgress,
      })));
    }
    states.push(state);
    expect(state.boundary).toBe("02_03");
    expect(state.visibleRoots).toEqual(expect.arrayContaining(["decisions", "delegation"]));
    expect(state.semanticRoots).toHaveLength(1);
    expect(state.semanticRoots[0]).toBe(state.progress < 0.56 ? "decisions" : "delegation");
    expect(
      Math.max(state.decisionsSupport, state.delegationParent),
      `visual protagonist at boundary ${p}`,
    ).toBeGreaterThan(0.55);
  }

  expect(states[0].decisionsSupport).toBeGreaterThan(0.9);
  expect(states.at(-1)?.delegationParent).toBeGreaterThan(0.9);

  await seekBoundary(page, 0.51);
  const stoppedA = await readState(page);
  await page.waitForTimeout(900);
  const stoppedB = await readState(page);
  expect(stoppedB.progress).toBeCloseTo(stoppedA.progress, 3);
  expect(stoppedB.owner).toBe(stoppedA.owner);
  expect(stoppedB.semanticRoots).toEqual(stoppedA.semanticRoots);

  for (const p of [0.9, 0.7, 0.56, 0.4, 0.2, 0, 0.58, 0.48, 0.62, 0.5, 0.72, 0.42]) {
    await seekBoundary(page, p);
    const state = await readState(page);
    expect(state.semanticRoots).toHaveLength(1);
    expect(state.owner).toBe(state.progress < 0.56 ? "decisions" : "delegation");
    expect(Math.max(state.decisionsSupport, state.delegationParent)).toBeGreaterThan(0.55);
  }
});
