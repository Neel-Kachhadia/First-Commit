import { TRANSITION_TIERS, TRANSITION_TIER_SPECS } from "./transition-registry";
import type { CapabilityReport, TierCapability } from "./transition-quality";

/**
 * Asks the browser (not a GPU-name table) whether it can decode / smoothly
 * play each exact runtime configuration. Resolves to `null` when the API is
 * missing, every query throws, or it does not answer within `timeoutMs` — the
 * caller then simply stays on STANDARD.
 *
 * Only ever call this on desktop, non-reduced-motion sessions: bypass
 * sessions must not probe or download anything.
 */
export async function probeTransitionCapabilities(timeoutMs = 400): Promise<CapabilityReport> {
  const mc = typeof navigator !== "undefined" ? navigator.mediaCapabilities : undefined;
  if (!mc || typeof mc.decodingInfo !== "function") return null;

  const query = async (tier: (typeof TRANSITION_TIERS)[number]): Promise<[typeof tier, TierCapability | null]> => {
    const spec = TRANSITION_TIER_SPECS[tier];
    try {
      const info = await mc.decodingInfo({
        type: "file",
        video: {
          contentType: `video/mp4; codecs="${spec.codec}"`,
          width: spec.width,
          height: spec.height,
          bitrate: spec.bitrate,
          framerate: spec.fps,
        },
      });
      return [tier, { supported: !!info.supported, smooth: !!info.smooth, powerEfficient: !!info.powerEfficient }];
    } catch {
      return [tier, null];
    }
  };

  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs));
  const answered = await Promise.race([Promise.all(TRANSITION_TIERS.map(query)), timeout]);
  if (!answered) return null;

  const report: NonNullable<CapabilityReport> = {};
  for (const [tier, cap] of answered) if (cap) report[tier] = cap;
  return Object.keys(report).length ? report : null;
}
