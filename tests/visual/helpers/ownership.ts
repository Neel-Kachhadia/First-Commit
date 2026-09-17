import type { Page } from "@playwright/test";

export const SCENE_IDS = ["prologue", "mandate", "decisions", "delegation", "step-up", "revocation", "split-defense", "concurrency", "causal-replay"] as const;

/**
 * Ownership snapshot for the persistent cinematic stage. "Visible" is computed
 * robustly (computed visibility + display), not mere DOM existence, because all
 * scene roots stay mounted at all times in this architecture.
 */
export async function readOwnership(page: Page) {
  return page.evaluate((sceneIds) => {
    const roots = sceneIds.map((id) => {
      const el = document.querySelector<HTMLElement>(`[data-scene='${id}']`);
      if (!el) return { id, visible: false };
      const cs = window.getComputedStyle(el);
      return { id, visible: cs.visibility === "visible" && cs.display !== "none" };
    });

    // A duplicate carrier is only a real problem when two copies are BOTH
    // strongly present at once (the reported bug: "two nearly identical
    // horizontal register bars stacked" at near-full opacity). A brief,
    // matched crossfade where one copy is at 48% and the other at 52% is the
    // INTENDED handoff mechanism (the same "sum of opacities" invariant already
    // proven for the 04->05 folio bridge), not a duplicate. So this returns
    // both: `dominantCount` (instances a viewer would perceive as "the" carrier,
    // opacity > 0.9) and `opacitySum` (should stay close to 1 throughout any
    // handoff, never approach 2).
    const measureText = (text: string) => {
      // CSS `visibility` is inherited but can be overridden by a descendant back
      // to "visible" even under a `visibility:hidden` ancestor (exactly what the
      // carrier-bridge fix relies on: the incoming carrier renders correctly
      // while its still-inactive scene root stays hidden). `getComputedStyle`
      // already resolves that inheritance correctly for any node — no manual
      // ancestor walk needed, and a walk inspecting each ancestor's OWN value
      // (rather than final computed value) gives false negatives here.
      // `opacity`, by contrast, does NOT inherit as a computed property (a
      // descendant's own `opacity` is independent of its ancestor's) even though
      // the ancestor's opacity visually compounds at paint time — so effective
      // visual opacity must be computed by multiplying opacity up the chain.
      let dominantCount = 0;
      let opacitySum = 0;
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (el.children.length > 0) return; // leaf nodes only, avoid double counting via ancestors
        if (!el.textContent?.includes(text)) return;
        const cs = window.getComputedStyle(el);
        if (cs.visibility !== "visible" || cs.display === "none") return;

        let effectiveOpacity = 1;
        let node: HTMLElement | null = el;
        while (node) {
          effectiveOpacity *= parseFloat(window.getComputedStyle(node).opacity);
          if (effectiveOpacity <= 0) break;
          node = node.parentElement;
        }
        if (effectiveOpacity > 0.05) {
          opacitySum += effectiveOpacity;
          if (effectiveOpacity > 0.9) dominantCount += 1;
        }
      });
      return { dominantCount, opacitySum };
    };

    const staleInlineStyles = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scene]"),
    ).map((el) => ({
      id: el.getAttribute("data-scene"),
      inlineVisibility: el.style.visibility,
      inlineDisplay: el.style.display,
    }));

    const decisionRegister = measureText("DECISION REGISTER");
    const authorityFolio = measureText("AUTHORITY FOLIO");
    const authorityRegister = measureText("AUTHORITY REGISTER");
    const kavachpayFooter = measureText("KAVACHPAY");

    return {
      roots,
      visibleRootCount: roots.filter((r) => r.visible).length,
      visibleRootIds: roots.filter((r) => r.visible).map((r) => r.id),
      // "Count" fields are the perceived-duplicate check: instances at >90%
      // effective opacity. A matched crossfade (e.g. 48%/52%) never trips this.
      decisionRegisterCount: decisionRegister.dominantCount,
      authorityFolioCount: authorityFolio.dominantCount,
      authorityRegisterCount: authorityRegister.dominantCount,
      kavachpayFooterCount: kavachpayFooter.dominantCount,
      // "Sum" fields catch the case a naive count would miss: two copies both
      // sitting at, say, 70% simultaneously (neither individually "dominant",
      // but together clearly two carriers overlapping). Should stay close to
      // 1 during any handoff, never approach 2.
      decisionRegisterOpacitySum: decisionRegister.opacitySum,
      authorityFolioOpacitySum: authorityFolio.opacitySum,
      authorityRegisterOpacitySum: authorityRegister.opacitySum,
      staleInlineStyles,
    };
  }, SCENE_IDS as unknown as string[]);
}

export type Ownership = Awaited<ReturnType<typeof readOwnership>>;

/**
 * Physical-congruence check for a specific outgoing/incoming carrier pair
 * (e.g. the two Decision Register copies during the 02->03 handoff). A
 * duplicate-count check alone can't catch two copies that are both "singular"
 * but sit at visibly different screen positions during the crossfade — this
 * measures the actual rects directly.
 */
export async function readCarrierGeometry(page: Page, outgoingSelector: string, incomingSelector: string) {
  return page.evaluate(
    ({ outSel, incSel }) => {
      const outEl = document.querySelector<HTMLElement>(outSel);
      const incEl = document.querySelector<HTMLElement>(incSel);
      if (!outEl || !incEl) return null;
      const outRect = outEl.getBoundingClientRect();
      const incRect = incEl.getBoundingClientRect();
      const outOpacity = parseFloat(window.getComputedStyle(outEl).opacity);
      const incOpacity = parseFloat(window.getComputedStyle(incEl).opacity);
      return {
        outOpacity,
        incOpacity,
        deltaX: Math.abs(outRect.x - incRect.x),
        deltaY: Math.abs(outRect.y - incRect.y),
        deltaWidth: Math.abs(outRect.width - incRect.width),
        deltaHeight: Math.abs(outRect.height - incRect.height),
      };
    },
    { outSel: outgoingSelector, incSel: incomingSelector },
  );
}
