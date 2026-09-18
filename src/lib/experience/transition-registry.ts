import type { RegisteredSceneKey } from "./scene-registry";

/**
 * Single source of truth for the seven cinematic inter-scene video
 * transitions. Boundary 07 -> 08 (concurrency -> causalReplay) is
 * intentionally absent: Scene 08 uses only its own existing entrance.
 */
export type TransitionBoundary = {
  id: string;
  outgoing: RegisteredSceneKey;
  incoming: RegisteredSceneKey;
  /** Path under /public. */
  src: string;
  /** Scroll distance dedicated to this transition, in viewport heights. */
  trackVh: number;
};

export const TRANSITION_REGISTRY: TransitionBoundary[] = [
  {
    id: "00-01",
    outgoing: "prologue",
    incoming: "mandate",
    src: "/assets/kavachpay/transitions/00-01-opening-mandate.mp4",
    trackVh: 180,
  },
  {
    id: "01-02",
    outgoing: "mandate",
    incoming: "decisions",
    src: "/assets/kavachpay/transitions/01-02-mandate-decisions.mp4",
    trackVh: 180,
  },
  {
    id: "02-03",
    outgoing: "decisions",
    incoming: "delegation",
    src: "/assets/kavachpay/transitions/02-03-decisions-delegation.mp4",
    trackVh: 180,
  },
  {
    id: "03-04",
    outgoing: "delegation",
    incoming: "stepUp",
    src: "/assets/kavachpay/transitions/03-04-delegation-stepup.mp4",
    trackVh: 180,
  },
  {
    id: "04-05",
    outgoing: "stepUp",
    incoming: "revocation",
    src: "/assets/kavachpay/transitions/04-05-stepup-revocation.mp4",
    trackVh: 200,
  },
  {
    id: "05-06",
    outgoing: "revocation",
    incoming: "splitDefense",
    src: "/assets/kavachpay/transitions/05-06-revocation-split-defense.mp4",
    trackVh: 200,
  },
  {
    id: "06-07",
    outgoing: "splitDefense",
    incoming: "concurrency",
    src: "/assets/kavachpay/transitions/06-07-split-defense-concurrency.mp4",
    trackVh: 200,
  },
] as const;

/** Boundary-overlap window (px) bleeding into the adjacent scenes' own tracks
 * so the outgoing scene is still visible as the video ramps in, and the
 * incoming scene is already visible as the video ramps out. */
export const TRANSITION_OVERLAP_PX = 64;

/** Fraction of total boundary progress spent easing opacity in/out. */
export const TRANSITION_EDGE_FRACTION = 0.05;
