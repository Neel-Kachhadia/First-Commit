import type { ExperienceScene as ExperienceSceneId } from "./scene-registry";
import type { MotionSnapshot } from "./motion-model";

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
let currentSnapshot: MotionSnapshot | null = null;
const listeners = new Set<ProgressListener>();
const snapshotListeners = new Set<(snapshot: MotionSnapshot) => void>();

/**
 * Minimal GSAP-timeline shape a boundary can drive imperatively. Scenes
 * register a paused, un-scrubbed entry timeline here so a shared boundary
 * (motion-runtime.ts) can own its progress instead of the scene's own
 * ScrollTrigger — the single-writer requirement for boundary-owned beats.
 */
type BoundaryDrivenTimeline = { progress(value?: number): number };
const boundaryTimelines = new Map<string, BoundaryDrivenTimeline>();

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

  getSnapshot(): MotionSnapshot | null {
    return currentSnapshot;
  },

  publishSnapshot(snapshot: MotionSnapshot): void {
    currentSnapshot = snapshot;
    currentActiveScene = snapshot.semanticOwner;
    for (const scene of Object.keys(snapshot.sceneProgress) as Array<keyof typeof snapshot.sceneProgress>) {
      progressRegistry[scene] = snapshot.sceneProgress[scene];
    }
    for (const listener of snapshotListeners) listener(snapshot);
  },

  subscribeSnapshot(listener: (snapshot: MotionSnapshot) => void): () => void {
    snapshotListeners.add(listener);
    return () => snapshotListeners.delete(listener);
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

  registerTimeline(key: string, timeline: BoundaryDrivenTimeline): void {
    boundaryTimelines.set(key, timeline);
  },

  unregisterTimeline(key: string): void {
    boundaryTimelines.delete(key);
  },

  getTimeline(key: string): BoundaryDrivenTimeline | undefined {
    return boundaryTimelines.get(key);
  },
};
