/**
 * ONE global semantic scene owner.
 *
 * `activeSceneId` (the store's `activeScene`) is the single answer to "which scene
 * is live right now". It drives, and nothing else may decide:
 *   aria-hidden / inert / pointer-events of every scene root, keyboard reach,
 *   the navbar chapter, reduced-motion visibility, deep-link state.
 * Two scenes may be VISUALLY present at once (film blend, authored linger); only
 * one is ever semantically active.
 *
 * Owner = the last scene whose track top has passed the probe line:
 *   - film active (desktop, no reduced motion): probe = viewport centre. The
 *     cinematic layer covers the swap, and the Mandate WebGL stock relies on this
 *     timing, so it is deliberately unchanged.
 *   - no film (mobile / reduced motion): probe = viewport top, i.e. exactly where
 *     the outgoing body hands over to the incoming one. A centre probe would flip
 *     the navbar and aria half a viewport early there.
 * Scroll gaps (film spacers) keep the previous owner, never "none".
 */
import { SCENE_REGISTRY, type RegisteredSceneKey } from "./scene-registry";

export type OwnerProbe = "center" | "top";

/** Pure: index of the owning scene given each track's document-top and the scroll state. */
export function resolveOwnerIndex(trackTops: readonly number[], scrollY: number, viewportHeight: number, probe: OwnerProbe): number {
  const y = scrollY + (probe === "center" ? viewportHeight * 0.5 : 1);
  let owner = 0;
  for (let i = 0; i < trackTops.length; i += 1) {
    if (trackTops[i] <= y) owner = i;
  }
  return owner;
}

export function readTrackTops(): number[] {
  return SCENE_REGISTRY.map((scene) => {
    const track = document.querySelector<HTMLElement>(`[data-track='${scene.slug}']`);
    return track ? track.getBoundingClientRect().top + window.scrollY : Number.POSITIVE_INFINITY;
  });
}

/** True when a film spacer exists and reduced motion is off (i.e. the cinematic layer is in charge of swaps). */
export function isFilmActive(reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  const spacer = document.querySelector<HTMLElement>("[data-transition-track]");
  return !!spacer && spacer.offsetHeight > 0;
}

export function resolveOwnerKey(reducedMotion: boolean): RegisteredSceneKey {
  const probe: OwnerProbe = isFilmActive(reducedMotion) ? "center" : "top";
  const index = resolveOwnerIndex(readTrackTops(), window.scrollY, window.innerHeight, probe);
  return SCENE_REGISTRY[index].key;
}

/**
 * Applies the semantic owner to every scene root. Scenes keep their own VISUAL
 * choreography, but semantics never come from them.
 * Reduced motion additionally means one visible root: non-owners are removed
 * from layout (display:none) so that a child with an explicit `visibility:visible`
 * cannot leak through a hidden parent.
 */
/** Inline !important beats a scene stylesheet's own !important (Decisions forces its root visible under reduced motion). */
function setImportant(el: HTMLElement, property: string, value: string): void {
  if (el.style.getPropertyValue(property) !== value || el.style.getPropertyPriority(property) !== "important") {
    el.style.setProperty(property, value, "important");
  }
}

export function enforceSemanticOwner(ownerSlug: string, reducedMotion: boolean): void {
  document.querySelectorAll<HTMLElement>("[data-scene]").forEach((root) => {
    const owned = root.dataset.scene === ownerSlug;
    const aria = owned ? "false" : "true";
    if (root.getAttribute("aria-hidden") !== aria) root.setAttribute("aria-hidden", aria);
    if (root.inert !== !owned) root.inert = !owned;
    setImportant(root, "pointer-events", owned ? "auto" : "none");
    if (reducedMotion) {
      setImportant(root, "visibility", owned ? "visible" : "hidden");
      setImportant(root, "opacity", owned ? "1" : "0");
      if (owned) {
        if (root.style.display === "none") root.style.removeProperty("display");
      } else {
        setImportant(root, "display", "none");
      }
    } else if (root.style.display === "none") {
      root.style.removeProperty("display");
    }
  });
}

/**
 * Keeps the enforced state true even when a scene's own effect / trigger writes its
 * root's aria-hidden, inert or style later (mount order, visibility triggers).
 * Attribute-filtered on the nine scene roots only.
 */
export function observeSemanticOwner(getState: () => { slug: string; reducedMotion: boolean }): () => void {
  const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
  let scheduled = false;
  const reapply = () => {
    scheduled = false;
    const { slug, reducedMotion } = getState();
    if (!slug) return;
    enforceSemanticOwner(slug, reducedMotion);
  };
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(reapply);
  });
  roots.forEach((root) => observer.observe(root, { attributes: true, attributeFilter: ["aria-hidden", "inert", "style"] }));
  return () => observer.disconnect();
}
