import type { RegisteredSceneKey } from "./scene-registry";

/**
 * Single source of truth for the seven cinematic inter-scene video
 * transitions AND for every web-runtime media variant of each one.
 * Boundary 07 -> 08 (concurrency -> causalReplay) is intentionally absent:
 * Scene 08 uses only its own existing entrance.
 *
 * Runtime tiers (all H.264 High, GOP 4 closed, 0 B-frames, CRF 24, CFR,
 * no audio, faststart), encoded from the 1440p300 / 4K240 masters in
 * assets/transitions/. Masters are NEVER referenced from here: their
 * ~1 s GOPs stall random-access seeks for hundreds of ms.
 */
export type TransitionTier = "fallback" | "standard" | "high";
/** A tier, or "bypass" (mobile / reduced motion: no transition media at all). */
export type TransitionQuality = TransitionTier | "bypass";

export type TransitionTierSpec = {
  width: number;
  height: number;
  fps: number;
  /** RFC 6381 codec string matching the encoded H.264 level. */
  codec: string;
  /** Approximate peak bitrate of the encodes, for MediaCapabilities queries. */
  bitrate: number;
  /** File-name suffix inside the runtime directory. */
  suffix: string;
};

/** Ordered lowest -> highest. */
export const TRANSITION_TIERS: readonly TransitionTier[] = ["fallback", "standard", "high"];

export const TRANSITION_TIER_SPECS: Record<TransitionTier, TransitionTierSpec> = {
  fallback: { width: 1920, height: 1080, fps: 60, codec: "avc1.640032", bitrate: 14_000_000, suffix: "rt-1080p60" },
  standard: { width: 1920, height: 1080, fps: 120, codec: "avc1.640033", bitrate: 16_000_000, suffix: "rt-1080p120" },
  high: { width: 2560, height: 1440, fps: 120, codec: "avc1.640034", bitrate: 26_000_000, suffix: "rt-1440p120" },
};

export type TransitionBoundary = {
  id: string;
  outgoing: RegisteredSceneKey;
  incoming: RegisteredSceneKey;
  /** One runtime file per quality tier, paths under /public. */
  sources: Record<TransitionTier, string>;
  /** Scroll distance dedicated to this transition, in viewport heights. */
  trackVh: number;
};

const RUNTIME_DIR = "/assets/kavachpay/transitions";

function boundary(
  id: string,
  outgoing: RegisteredSceneKey,
  incoming: RegisteredSceneKey,
  name: string,
  trackVh: number,
): TransitionBoundary {
  const file = (tier: TransitionTier) => `${RUNTIME_DIR}/${id}-${name}.${TRANSITION_TIER_SPECS[tier].suffix}.mp4`;
  return {
    id,
    outgoing,
    incoming,
    sources: { fallback: file("fallback"), standard: file("standard"), high: file("high") },
    trackVh,
  };
}

export const TRANSITION_REGISTRY: TransitionBoundary[] = [
  boundary("00-01", "prologue", "mandate", "opening-mandate", 180),
  boundary("01-02", "mandate", "decisions", "mandate-decisions", 180),
  boundary("02-03", "decisions", "delegation", "decisions-delegation", 180),
  boundary("03-04", "delegation", "stepUp", "delegation-stepup", 180),
  boundary("04-05", "stepUp", "revocation", "stepup-revocation", 200),
  boundary("05-06", "revocation", "splitDefense", "revocation-split-defense", 200),
  boundary("06-07", "splitDefense", "concurrency", "split-defense-concurrency", 200),
];

/** Boundary-overlap window (px) bleeding into the adjacent scenes' own tracks
 * so the outgoing scene is still visible as the video ramps in, and the
 * incoming scene is already visible as the video ramps out. */
export const TRANSITION_OVERLAP_PX = 64;

/** Fraction of total boundary progress spent easing opacity in/out. */
export const TRANSITION_EDGE_FRACTION = 0.05;
