/**
 * Adaptive transition-quality policy. Pure and DOM-free so every decision is
 * unit-testable; the browser glue (MediaCapabilities probe, seek timing,
 * staging) lives in CinematicTransitionLayer.
 *
 * Principles:
 *  - Never pick a tier from a GPU name / user agent. Ceiling comes from the
 *    browser's own MediaCapabilities answer + what the viewport can display.
 *  - Always START at STANDARD (1080p120); the controller then earns promotion
 *    (HIGH) or is forced to demote (FALLBACK) from real seek behaviour.
 *  - Quality only ever changes for a boundary that has not started yet.
 *  - Hysteresis: a demotion permanently lowers the session ceiling, so the
 *    system can never flap HIGH <-> STANDARD between scenes.
 */
import { TRANSITION_TIERS, type TransitionTier } from "./transition-registry";

export type TierCapability = { supported: boolean; smooth: boolean; powerEfficient: boolean };
export type CapabilityReport = Partial<Record<TransitionTier, TierCapability>> | null;

export type ViewportInfo = { width: number; height: number; dpr: number };

/** Rolling-sample thresholds, calibrated against measured real-layer behaviour. */
export const QUALITY_THRESHOLDS = {
  /** A seek that took longer than this counts as a stale-frame event. */
  staleMs: 200,
  excellent: { p50: 12, p95: 40, staleRatio: 0.02 },
  degraded: { p50: 40, p95: 150, staleRatio: 0.1 },
  /** Median seek this slow is unambiguous (hundreds of ms): one window is enough to demote. */
  severeP50: 120,
  /** Samples kept for the CURRENT tier only (reset on every tier change). */
  windowSize: 120,
  /** Minimum samples before a verdict may promote / demote. */
  promoteMinSamples: 30,
  demoteMinSamples: 30,
  /** New samples required between two evaluations that count toward a streak. */
  evalStride: 12,
  promoteStreak: 2,
  demoteStreak: 2,
  /** Demoting a tier that was earned by promotion needs stronger evidence. */
  demoteStreakAfterPromotion: 3,
} as const;

/**
 * Whether the adaptive system may promote to HIGH (1440p120) on its own.
 * MEASURED DECISION: as rendered in the transition layer, HIGH differs from
 * STANDARD by only ~0.35-1.5 gray levels on average (PSNR 35-45 dB) — visible
 * only on static fine detail under 2x zoom — while costing +43% payload, a
 * lower delivered-frame rate under scrubbing and level-5.2 decode. So the
 * automatic ceiling stays STANDARD. HIGH remains fully implemented and is
 * reachable via the dev/test override; flip this to true to enable promotion.
 */
export const AUTO_PROMOTE_TO_HIGH = false;

/** Minimum physical-pixel cover width at which 1440p can show more than 1080p. */
export const HIGH_TIER_MIN_COVER_WIDTH = 2200;

export const tierIndex = (tier: TransitionTier) => TRANSITION_TIERS.indexOf(tier);
export const lowerTier = (tier: TransitionTier): TransitionTier => TRANSITION_TIERS[Math.max(0, tierIndex(tier) - 1)];
export const higherTier = (tier: TransitionTier): TransitionTier =>
  TRANSITION_TIERS[Math.min(TRANSITION_TIERS.length - 1, tierIndex(tier) + 1)];

/**
 * The 16:9 film is `object-fit: cover` over the viewport, so the source
 * width needed for 1:1 pixels is the larger of the viewport's physical width
 * and its physical height scaled to 16:9.
 */
export function coverWidthInDevicePixels({ width, height, dpr }: ViewportInfo): number {
  return Math.max(width * dpr, height * dpr * (16 / 9));
}

export function viewportBenefitsFromHigh(viewport: ViewportInfo): boolean {
  return coverWidthInDevicePixels(viewport) >= HIGH_TIER_MIN_COVER_WIDTH;
}

export type CapabilityDecision = { start: TransitionTier; ceiling: TransitionTier; reason: string };

/**
 * Turns a MediaCapabilities report + viewport into the start tier and the
 * highest tier the session may be promoted to. Uncertain / missing data always
 * resolves to STANDARD (never HIGH).
 */
export function decideFromCapabilities(
  report: CapabilityReport,
  viewport: ViewportInfo,
  allowHigh: boolean = AUTO_PROMOTE_TO_HIGH,
): CapabilityDecision {
  if (!report) return { start: "standard", ceiling: "standard", reason: "capabilities-unavailable" };

  const std = report.standard;
  const fb = report.fallback;
  const high = report.high;

  // STANDARD explicitly not decodable / not smooth, but the 60 fps floor is:
  // start at the floor. Anything else (including all-unsupported) stays
  // STANDARD so the load-failure fallback chain stays the safety net.
  if (std && (!std.supported || !std.smooth) && fb && fb.supported) {
    return { start: "fallback", ceiling: "fallback", reason: "standard-not-smooth" };
  }

  const highCapable = !!high && high.supported && high.smooth && high.powerEfficient;
  if (highCapable && viewportBenefitsFromHigh(viewport)) {
    return allowHigh
      ? { start: "standard", ceiling: "high", reason: "high-capable-and-useful" }
      : { start: "standard", ceiling: "standard", reason: "high-auto-promotion-disabled" };
  }
  return {
    start: "standard",
    ceiling: "standard",
    reason: !highCapable ? "high-not-capable" : "viewport-gains-nothing-from-high",
  };
}

/** `?transitionQuality=` — dev/test only; anything invalid is ignored. */
export function parseQualityOverride(search: string, allowed: boolean): TransitionTier | null {
  if (!allowed) return null;
  const value = new URLSearchParams(search).get("transitionQuality");
  return value && (TRANSITION_TIERS as readonly string[]).includes(value) ? (value as TransitionTier) : null;
}

/** `?transitionAutoHigh=1` — dev/test only: lets the controller reach HIGH even while AUTO_PROMOTE_TO_HIGH is off. */
export function parseAutoHighOverride(search: string, allowed: boolean): boolean {
  return allowed && new URLSearchParams(search).get("transitionAutoHigh") === "1";
}

export type Verdict = "excellent" | "healthy" | "degraded" | "insufficient";

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export function classifySamples(latencies: readonly number[], minSamples: number): { verdict: Verdict; p50: number; p95: number; staleRatio: number } {
  if (latencies.length < minSamples) return { verdict: "insufficient", p50: 0, p95: 0, staleRatio: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const staleRatio = latencies.filter((ms) => ms > QUALITY_THRESHOLDS.staleMs).length / latencies.length;
  const t = QUALITY_THRESHOLDS;
  const verdict: Verdict =
    p50 > t.degraded.p50 || p95 > t.degraded.p95 || staleRatio >= t.degraded.staleRatio
      ? "degraded"
      : p50 <= t.excellent.p50 && p95 <= t.excellent.p95 && staleRatio <= t.excellent.staleRatio
        ? "excellent"
        : "healthy";
  return { verdict, p50, p95, staleRatio };
}

export type QualityEvent = { type: "promote" | "demote" | "cap"; from: TransitionTier; to: TransitionTier; reason: string };

/**
 * Session-local controller. `tier` is what the NEXT boundary to be staged
 * should use; a boundary that has already started never consults it again.
 */
export class TransitionQualityController {
  tier: TransitionTier;
  /** Ceiling from MediaCapabilities + viewport (may rise once the async probe answers). */
  private capabilityCeiling: TransitionTier;
  /** Ceiling imposed by observed failures / demotions; only ever decreases (hysteresis). */
  private hardCap: TransitionTier = TRANSITION_TIERS[TRANSITION_TIERS.length - 1];
  readonly adaptive: boolean;
  readonly events: QualityEvent[] = [];

  private samples: number[] = [];
  private history: number[] = [];
  private sinceEval = 0;
  private excellentStreak = 0;
  private degradedStreak = 0;
  private promotedOnce = false;

  constructor(opts: { start: TransitionTier; ceiling: TransitionTier; adaptive?: boolean }) {
    this.capabilityCeiling = opts.ceiling;
    this.tier = tierIndex(opts.start) > tierIndex(opts.ceiling) ? opts.ceiling : opts.start;
    this.adaptive = opts.adaptive ?? true;
  }

  /** Highest tier this session may currently use. */
  get cap(): TransitionTier {
    return tierIndex(this.capabilityCeiling) <= tierIndex(this.hardCap) ? this.capabilityCeiling : this.hardCap;
  }

  get sampleCount() {
    return this.samples.length;
  }

  /** Every sample of the session, capped at 4000 (diagnostics / calibration only). */
  historySnapshot(): number[] {
    return [...this.history];
  }

  /** Copy of the current rolling window (diagnostics / calibration only). */
  samplesSnapshot(): number[] {
    return [...this.samples];
  }

  /**
   * Applies the (async) MediaCapabilities decision. It can raise the
   * capability ceiling, but never above a ceiling already lowered by observed
   * failures / demotions (`hardCap`), and it never changes the tier upward.
   */
  applyCapabilityDecision(decision: CapabilityDecision) {
    if (!this.adaptive) return;
    this.capabilityCeiling = decision.ceiling;
    if (tierIndex(decision.start) < tierIndex(this.tier)) this.setTier(decision.start, "demote", `capabilities:${decision.reason}`);
    if (tierIndex(this.tier) > tierIndex(this.cap)) this.setTier(this.cap, "demote", `capabilities:${decision.reason}`);
  }

  /** A seek's request -> `seeked` latency while a transition was visibly scrubbing. */
  record(latencyMs: number) {
    // Forced (non-adaptive) controllers still collect samples for diagnostics; they never evaluate.
    if (!Number.isFinite(latencyMs)) return;
    this.samples.push(latencyMs);
    if (this.history.length < 4000) this.history.push(latencyMs);
    if (this.samples.length > QUALITY_THRESHOLDS.windowSize) this.samples.shift();
    this.sinceEval += 1;
  }

  /** A source of this tier failed to load: never use it (or anything above it) again this session. */
  noteLoadFailure(failed: TransitionTier) {
    const below = lowerTier(failed);
    if (tierIndex(this.cap) >= tierIndex(failed) && below !== failed) this.lowerCap(below, `load-failure:${failed}`);
    if (tierIndex(this.tier) >= tierIndex(failed) && below !== failed) this.setTier(below, "demote", `load-failure:${failed}`);
    return this.tier;
  }

  /** True when enough new samples have arrived to run another evaluation. */
  get evaluationDue() {
    return this.adaptive && this.sinceEval >= QUALITY_THRESHOLDS.evalStride;
  }

  /**
   * Applies at most one promotion or demotion from the rolling window.
   * Returns true when `tier` changed. Callers only use the new tier for a
   * boundary that has not started; a running transition never consults it.
   */
  evaluate(): boolean {
    if (!this.evaluationDue) return false;
    const t = QUALITY_THRESHOLDS;
    const before = this.tier;
    this.sinceEval = 0;
    const cls = classifySamples(this.samples, Math.min(t.promoteMinSamples, t.demoteMinSamples));

    if (cls.verdict === "degraded" && this.samples.length >= t.demoteMinSamples) {
      this.degradedStreak += 1;
      this.excellentStreak = 0;
      const severe = cls.p50 >= t.severeP50;
      const needed = severe ? 1 : this.promotedOnce ? t.demoteStreakAfterPromotion : t.demoteStreak;
      if (this.degradedStreak >= needed && tierIndex(this.tier) > 0) {
        const from = this.tier;
        const to = lowerTier(from);
        this.lowerCap(to, `degraded-at:${from}`);
        this.setTier(to, "demote", severe ? "seek-latency-severe" : "rolling-seek-latency-degraded");
      }
    } else if (cls.verdict === "excellent" && this.samples.length >= t.promoteMinSamples) {
      this.excellentStreak += 1;
      this.degradedStreak = 0;
      if (this.excellentStreak >= t.promoteStreak && tierIndex(this.tier) < tierIndex(this.cap)) {
        this.setTier(higherTier(this.tier), "promote", "rolling-seek-latency-excellent");
        this.promotedOnce = true;
      }
    } else if (cls.verdict === "healthy") {
      // A single merely-healthy window breaks both streaks.
      this.excellentStreak = 0;
      this.degradedStreak = 0;
    }
    return this.tier !== before;
  }

  /** Tier the next boundary should be staged with (runs a due evaluation first). */
  tierForNextStage(): TransitionTier {
    this.evaluate();
    return this.tier;
  }

  private lowerCap(to: TransitionTier, reason: string) {
    if (tierIndex(to) >= tierIndex(this.hardCap)) return;
    this.events.push({ type: "cap", from: this.hardCap, to, reason });
    this.hardCap = to;
  }

  private setTier(to: TransitionTier, type: "promote" | "demote", reason: string) {
    if (to === this.tier) return;
    this.events.push({ type, from: this.tier, to, reason });
    this.tier = to;
    this.samples = [];
    this.sinceEval = 0;
    this.excellentStreak = 0;
    this.degradedStreak = 0;
  }
}
