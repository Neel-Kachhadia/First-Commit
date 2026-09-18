import type { ExperienceScene as ExperienceSceneId } from "./scene-registry";

export type { ExperienceSceneId };

type ProgressListener = (scene: ExperienceSceneId, progress: number) => void;

const progressRegistry: Record<ExperienceSceneId, number> = {
  prologue: 0,
  mandate: 0,
  decisions: 0,
  delegation: 0,
  stepUp: 0,
  revocation: 0,
  splitDefense: 0,
  concurrency: 0,
  causalReplay: 0,
  none: 0,
};

let currentActiveScene: ExperienceSceneId = "none";
const listeners = new Set<ProgressListener>();

/**
 * High-frequency imperative progress channel outside React lifecycle.
 * Used for WebGL on-demand invalidation and diagnostics HUD.
 * Never causes React reconciliation or component re-renders.
 */
export const progressBus = {
  get(scene: ExperienceSceneId): number {
    return progressRegistry[scene] ?? 0;
  },

  set(scene: ExperienceSceneId, value: number): void {
    const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    progressRegistry[scene] = clamped;
    for (const listener of listeners) {
      listener(scene, clamped);
    }
  },

  getActiveScene(): ExperienceSceneId {
    return currentActiveScene;
  },

  setActiveScene(scene: ExperienceSceneId): void {
    currentActiveScene = scene;
  },

  subscribe(listener: ProgressListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getAll(): Record<ExperienceSceneId, number> {
    return { ...progressRegistry };
  },
};
