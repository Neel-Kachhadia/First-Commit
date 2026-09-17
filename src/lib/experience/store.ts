import { create } from "zustand";
import type { ExperienceScene } from "./scene-registry";

export type { ExperienceScene } from "./scene-registry";
export type PerformanceTier = "low" | "mid" | "high";

type ExperienceState = {
  activeScene: ExperienceScene;
  reducedMotion: boolean;
  webglReady: boolean;
  performanceTier: PerformanceTier;
  /** True once the pre-film leader/slate sequence has released the film (or was bypassed). */
  introComplete: boolean;
  setScene: (id: ExperienceScene) => void;
  setReducedMotion: (reduced: boolean) => void;
  setWebglReady: (ready: boolean) => void;
  setIntroComplete: (complete: boolean) => void;
};

export const useExperienceStore = create<ExperienceState>()((set) => ({
  activeScene: "none",
  reducedMotion: false,
  webglReady: false,
  performanceTier: "mid",
  introComplete: false,
  setScene: (activeScene) =>
    set((state) => (state.activeScene === activeScene ? state : { activeScene })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setWebglReady: (webglReady) => set({ webglReady }),
  setIntroComplete: (introComplete) => set({ introComplete }),
}));

/** Imperative store access for scroll orchestration outside React. */
export const experienceStore = useExperienceStore;


