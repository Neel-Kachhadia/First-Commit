import type { Page } from "@playwright/test";

export const checkpointProgress = [0, 0.25, 0.5, 0.75, 1] as const;

export const checkpointScenes = [
  { name: "prologue", selector: "[data-scene='prologue']" },
  { name: "mandate", selector: "[data-scene='mandate']" },
  { name: "decisions", selector: "[data-scene='decisions']" },
  { name: "delegation", selector: "[data-scene='delegation']" },
  { name: "stepUp", selector: "[data-scene='step-up']" },
  { name: "revocation", selector: "[data-scene='revocation']" },
  { name: "splitDefense", selector: "[data-scene='split-defense']" },
  { name: "concurrency", selector: "[data-scene='concurrency']" },
  { name: "causalReplay", selector: "[data-scene='causal-replay']" },
] as const;

/**
 * Reads a scene's real pinned-timeline scroll bounds from its `[data-track='...']`
 * trigger (the actual ScrollTrigger anchor in the persistent-stage architecture —
 * NOT the `[data-scene='...']` section, which is a fixed-position overlay with no
 * scroll height of its own).
 */
export async function getTrackBounds(page: Page, trackId: string) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-track='${id}']`);
    const all = (window as unknown as {
      ScrollTrigger?: { getAll?: () => Array<{ trigger?: Element | null; start: number; end: number }> };
    }).ScrollTrigger?.getAll?.() ?? [];
    const st = all.find((t) => t.trigger === el);
    return { start: st?.start ?? 0, end: st?.end ?? 0 };
  }, trackId);
}

export async function prepareVisualPage(page: Page) {
  await page.goto("/?visualTest=1", { waitUntil: "networkidle" });

  await page.addStyleTag({
    content: "html { scroll-behavior: auto !important; }",
  });

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) =>
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
      ),
    );
  });
}

type ScrollTriggerInstance = {
  trigger?: Element | null;
  start: number;
  end: number;
};

export async function seekSceneProgress(
  page: Page,
  selector: string,
  progress: number,
) {
  const target = await page.evaluate(
    ({ sceneSelector, sceneProgress }) => {
      const scene = document.querySelector<HTMLElement>(sceneSelector);

      if (!scene) {
        throw new Error(`Missing visual checkpoint scene: ${sceneSelector}`);
      }

      const stAll = (window as unknown as {
        ScrollTrigger?: {
          getAll?: () => ScrollTriggerInstance[];
          update?: () => void;
        };
      }).ScrollTrigger?.getAll?.() ?? [];

      const sceneId = scene.getAttribute("data-scene");
      const st = stAll.find(
        (t) =>
          t.trigger === scene ||
          t.trigger?.getAttribute("data-scene") === sceneId ||
          t.trigger?.getAttribute("data-track") === sceneId,
      );

      let targetScroll: number;
      if (st) {
        if (
          sceneProgress === 1 &&
          (sceneSelector === "[data-scene='prologue']" ||
            sceneSelector === "[data-scene='mandate']" ||
            sceneSelector === "[data-scene='decisions']" ||
            sceneSelector === "[data-scene='delegation']" ||
            sceneSelector === "[data-scene='step-up']" ||
            sceneSelector === "[data-scene='revocation']" ||
            sceneSelector === "[data-scene='split-defense']" ||
            sceneSelector === "[data-scene='concurrency']" ||
            sceneSelector === "[data-scene='causal-replay']")
        ) {
          targetScroll = Math.floor(st.end - 1);
        } else if (sceneProgress === 0 && sceneSelector !== "[data-scene='prologue']") {
          targetScroll = Math.ceil(st.start + 1);
        } else {
          const maxScroll = Math.max(
            document.documentElement.scrollHeight - window.innerHeight,
            0,
          );
          targetScroll = Math.min(
            maxScroll,
            st.start + (st.end - st.start) * sceneProgress,
          );
        }
      } else {
        const rect = scene.getBoundingClientRect();
        const sectionTop = rect.top + window.scrollY;
        const sectionRange = Math.max(rect.height - window.innerHeight, 0);
        const maxScroll = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          0,
        );
        targetScroll = Math.min(
          Math.max(sectionTop + sectionRange * sceneProgress, 0),
          maxScroll,
        );
      }

      window.scrollTo(0, targetScroll);
      window.dispatchEvent(new Event("scroll"));
      const globalSt = (window as unknown as {
        ScrollTrigger?: { update?: () => void };
      }).ScrollTrigger;
      if (globalSt?.update) {
        globalSt.update();
      }

      return targetScroll;
    },
    { sceneSelector: selector, sceneProgress: progress },
  );

  await page.waitForFunction(
    (targetScroll) => Math.abs(window.scrollY - targetScroll) < 2,
    target,
  );

  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  );
}
