"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { experienceStore } from "@/lib/experience/store";
import {
  TRANSITION_REGISTRY,
  TRANSITION_TIER_SPECS,
  TRANSITION_EDGE_FRACTION,
  TRANSITION_OVERLAP_PX,
  type TransitionQuality,
  type TransitionTier,
} from "@/lib/experience/transition-registry";
import {
  TransitionQualityController,
  decideFromCapabilities,
  parseQualityOverride,
  parseAutoHighOverride,
  AUTO_PROMOTE_TO_HIGH,
  type CapabilityReport,
  type ViewportInfo,
} from "@/lib/experience/transition-quality";
import { probeTransitionCapabilities } from "@/lib/experience/transition-capabilities";
import { computeTransitionOpacity, progressToVideoTime } from "@/lib/experience/transition-math";
import { BoundaryTransport, DEFAULT_TRANSPORT_PARAMS, SEEK_TUNING, shouldWriteSeek, type TransportParams } from "@/lib/experience/transition-transport";
import { transportBridge } from "@/lib/experience/transition-transport-bridge";
import { TRANSITION_SEAMS, insetToClipPath, seamOpacity, seamPoseAt, seamVideoProgress, type BoundarySeam, type SeamPose } from "@/lib/experience/transition-seam";
import styles from "./CinematicTransitionLayer.module.css";

type BoundaryMeta = {
  duration: number;
  failed: boolean;
  /** Tier whose file is currently attached (null = nothing staged). Fixed once the boundary starts. */
  tier: TransitionTier | null;
  /** Tiers already tried for this staging, so a failure chain can never loop. */
  tried: Set<TransitionTier>;
  /** The LATEST outstanding seek request (a newer request supersedes an older one). */
  pendingSeek: { at: number; sample: boolean } | null;
  /** When the first request after the last completed seek was issued (stall detection). */
  unresolvedSince: number | null;
  /** Progress|viewport the seam presentation was last applied for (skips redundant style writes). */
  seamKey: string | null;
  /** Last time this element presented a new frame (requestVideoFrameCallback), 0 if unsupported. */
  lastFrameAt: number;
  /** Media time of the frame the compositor last presented (rVFC), null until one was. */
  presentedMediaTime: number | null;
  trigger: ScrollTrigger | null;
  /** Cinematic transport: raw target -> velocity-limited presented progress. */
  transport: BoundaryTransport;
  /** Media time the presented progress wants (coalesced: only the LATEST matters). */
  desired: number;
  /** Media time last written to the element, and when (never read back mid-seek). */
  lastRequested: number | null;
  lastRequestAt: number;
  /** Diagnostics: number of currentTime writes on this boundary. */
  writes: number;
  /** presented|target last applied (skips redundant style/seek work while at rest). */
  appliedKey: string | null;
  /** Last applied opacity / presented progress (quality sampling gate for flushed seeks). */
  lastOpacity: number;
  lastPresented: number;
};

const IS_DEV = process.env.NODE_ENV !== "production";
/** No seek completing for this long while the film is being scrubbed = a stall sample. */
const STALL_MS = 400;
/** Counter-movement below 2x this many scroll px never reverses the cinematic direction (trackpad noise). */
const TRANSPORT_DEADBAND_PX = 2;

const MOBILE_QUERY = "(max-width: 48rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const isMobileViewport = () => window.matchMedia(MOBILE_QUERY).matches;

/** Dev-only frame recorder for `window.__kpMotion` (never started in production; the hook is not installed there). */
function createMotionRecorder() {
  return {
    on: false,
    frames: [] as Array<Record<string, unknown>>,
    push(frame: Record<string, unknown>) {
      if (this.frames.length < 60_000) this.frames.push(frame);
    },
  };
}

/** True where the video layer is never shown (mobile cut / reduced motion). */
const isBypassMode = () =>
  experienceStore.getState().reducedMotion ||
  window.matchMedia(REDUCED_MOTION_QUERY).matches ||
  isMobileViewport();

/**
 * Single owner of all seven inter-scene cinematic video transitions.
 * Scroll position (via a ScrollTrigger per boundary, on that boundary's own
 * scroll-track spacer) is the only driver of video.currentTime — videos stay
 * paused and are scrubbed deterministically, forward and reverse.
 *
 * Mobile and prefers-reduced-motion bypass the video layer entirely and fall
 * back to the scenes' own hard-cut ownership handoff (documented responsive
 * policy: a broken/cropped 16:9 cinematic crossfade is worse than a clean cut).
 */
export function CinematicTransitionLayer() {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const backdropRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const meta: BoundaryMeta[] = TRANSITION_REGISTRY.map(() => ({
      duration: 0,
      failed: false,
      tier: null,
      tried: new Set<TransitionTier>(),
      pendingSeek: null,
      unresolvedSince: null,
      seamKey: null,
      lastFrameAt: 0,
      presentedMediaTime: null,
      trigger: null,
      transport: new BoundaryTransport(),
      desired: -1,
      lastRequested: null,
      lastRequestAt: 0,
      writes: 0,
      appliedKey: null,
      lastOpacity: 0,
      lastPresented: 0,
    }));

    // ---- Adaptive quality session (session-local, nothing persisted/sent) ----
    // Bypass sessions (mobile / reduced motion) never create a controller, never
    // probe MediaCapabilities and never stage a file.
    const viewportInfo = (): ViewportInfo => ({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    });
    const forcedTier = parseQualityOverride(window.location.search, IS_DEV);
    // Dev/test only: `?transitionSeam=off` disables seam calibration (BEFORE/AFTER comparisons).
    const seamsOff = IS_DEV && new URLSearchParams(window.location.search).get("transitionSeam") === "off";
    // Dev/test only: closed-loop calibration replaces a boundary's poses at the CURRENT viewport.
    const seamOverrides: Record<string, { start?: SeamPose; end?: SeamPose }> = {};
    /** Running average of the display frame interval (ms); drives tick-aware seek pacing. */
    let frameMsAverage = 16.7;
    const applyFns: Array<(presented: number, target: number) => void> = [];
    const engagedFns: Array<() => boolean> = [];
    const seekFns: Array<() => void> = [];
    const allowHigh = AUTO_PROMOTE_TO_HIGH || parseAutoHighOverride(window.location.search, IS_DEV);
    let controller: TransitionQualityController | null = null;
    let capabilityReport: CapabilityReport = null;
    let disposed = false;
    const ensureController = (): TransitionQualityController => {
      if (controller) return controller;
      if (forcedTier) {
        controller = new TransitionQualityController({ start: forcedTier, ceiling: forcedTier, adaptive: false });
      } else {
        // Conservative start: STANDARD. The ceiling stays STANDARD until the
        // browser answers the MediaCapabilities probe.
        controller = new TransitionQualityController({ start: "standard", ceiling: "standard" });
        probeTransitionCapabilities()
          .then((report) => {
            if (disposed || !controller) return;
            capabilityReport = report;
            controller.applyCapabilityDecision(decideFromCapabilities(report, viewportInfo(), allowHigh));
            restageUpcoming();
            publishDebug();
          })
          .catch(() => undefined);
      }
      return controller;
    };
    const currentQuality = (): TransitionQuality => (isBypassMode() ? "bypass" : controller ? controller.tier : "standard");
    const publishDebug = () => {
      if (!IS_DEV) return;
      const layer = layerRef.current;
      if (layer) layer.dataset.transitionQuality = currentQuality();
      meta.forEach((m, i) => {
        const el = videoRefs.current[i];
        if (!el) return;
        if (m.tier) el.dataset.transitionTier = m.tier;
        else delete el.dataset.transitionTier;
      });
    };
    const progressOf = (index: number) => meta[index].trigger?.progress ?? 0;

    const cleanups: Array<() => void> = [];
    const triggers: ScrollTrigger[] = [];

    TRANSITION_REGISTRY.forEach((boundary, index) => {
      const videoEl = videoRefs.current[index];
      const spacerEl = document.querySelector<HTMLElement>(
        `[data-transition-track='${boundary.id}']`,
      );
      if (!videoEl || !spacerEl) return;

      /** True while this boundary is driven by the transport (Lenis running, film live, metadata known). */
      const transportEngaged = () =>
        transportBridge.enabled && !transportBridge.programmatic && !isBypassMode() && !meta[index].failed && meta[index].duration > 0;

      /**
       * Presents a boundary. `presented` (transport output) chooses the FRAME and the seam
       * pose so picture and geometry always agree; `target` (raw scroll intent) drives only
       * the layer's opacity envelope, because the live DOM flips at raw scroll positions and
       * the film must be opaque exactly then. Without the transport both are the same number.
       */
      const apply = (presented: number, target: number) => {
        if (isBypassMode() || meta[index].failed) {
          meta[index].seamKey = null; // a later re-entry must re-apply the pose
          gsap.set(videoEl, { opacity: 0 });
          return;
        }
        const progress = presented;

        let seam: BoundarySeam | undefined = seamsOff ? undefined : TRANSITION_SEAMS[boundary.id];
        const override = IS_DEV ? seamOverrides[boundary.id] : undefined;
        // Total scroll range of this boundary (trigger start..end); no layout read on the hot path.
        const rangePx = meta[index].trigger ? meta[index].trigger.end - meta[index].trigger.start : spacerEl.offsetHeight + 128;
        if (seam && override) {
          const at = seam.samples[0];
          seam = { ...seam, samples: [{ width: window.innerWidth, height: window.innerHeight, start: override.start ?? at.start, end: override.end ?? at.end }] };
        }
        let opacity: number;
        if (seam) {
          // Calibrated boundary: the film conforms to the live scenes at both ends.
          const viewport = { width: window.innerWidth, height: window.innerHeight };
          const overlapFrac = TRANSITION_OVERLAP_PX / rangePx;
          opacity = seamOpacity(target, overlapFrac);
          const seamKey = `${progress}|${target}|${viewport.width}|${viewport.height}|${override ? 1 : 0}`;
          if (meta[index].seamKey !== seamKey) {
            meta[index].seamKey = seamKey;
            const pose = seamPoseAt(seam, progress, viewport, overlapFrac);
            gsap.set(videoEl, {
              opacity,
              scale: pose.scale,
              x: pose.x,
              y: pose.y,
              clipPath: insetToClipPath(pose.inset),
              mixBlendMode: seam.backdrop && pose.blend > 0.001 ? "lighten" : "normal",
            });
            const backdropEl = backdropRefs.current[index];
            if (backdropEl && seam.backdrop) gsap.set(backdropEl, { opacity: pose.blend * opacity, backgroundColor: seam.backdrop });
          }
        } else {
          opacity = computeTransitionOpacity(target, TRANSITION_EDGE_FRACTION);
          gsap.set(videoEl, { opacity });
        }

        if (meta[index].duration > 0) {
          const seamCfg = seamsOff ? undefined : TRANSITION_SEAMS[boundary.id];
          const framePosition = seamCfg ? seamVideoProgress(seamCfg, progress, TRANSITION_OVERLAP_PX / rangePx) : progress;
          const wanted = progressToVideoTime(framePosition, meta[index].duration);
          meta[index].desired = wanted;
          meta[index].lastOpacity = opacity;
          meta[index].lastPresented = progress;
          if (transportEngaged()) {
            requestSeek();
          } else if (Math.abs(videoEl.currentTime - wanted) > 0.008) {
            // Passthrough (no Lenis: visual tests, reduced motion, native scroll): the original 1:1 mapping.
            noteSeekRequest(opacity >= 0.5 && progress > 0.05 && progress < 0.95);
            meta[index].lastRequested = wanted;
            meta[index].lastRequestAt = performance.now();
            meta[index].writes += 1;
            videoEl.currentTime = wanted;
          }
        }
      };

      /**
       * Seek coalescing: only the LATEST desired time matters. Sub-half-frame changes are never
       * written (no decoder churn without a new picture) and an in-flight seek is not aborted by
       * a newer one unless it is stuck (a flood of seek A, B, C, D... starves the decoder). The
       * `seeked` event flushes the newest desired time immediately.
       */
      const requestSeek = () => {
        const m = meta[index];
        if (m.duration <= 0 || m.desired < 0) return;
        const now = performance.now();
        const spec = m.tier ? TRANSITION_TIER_SPECS[m.tier] : null;
        if (
          !shouldWriteSeek({
            desired: m.desired,
            lastRequested: m.lastRequested,
            seeking: videoEl.seeking,
            sinceRequestMs: now - m.lastRequestAt,
            frameDuration: spec ? 1 / spec.fps : 1 / 60,
            settled: m.transport.settled,
            frameMs: frameMsAverage,
          })
        ) {
          return;
        }
        noteSeekRequest(m.lastOpacity >= 0.5 && m.lastPresented > 0.05 && m.lastPresented < 0.95);
        m.lastRequested = m.desired;
        m.lastRequestAt = now;
        m.writes += 1;
        videoEl.currentTime = m.desired;
      };

      // Quality signal 1: service time of the LATEST seek request (request -> `seeked`).
      // A newer request supersedes an older one, so this stays independent of how
      // fast the user scrolls. Signal 2: a stall sample when no seek completes for
      // STALL_MS while the film is visibly being scrubbed. Both are recorded only
      // for the CURRENT tier and only while the film is on screen mid-transition.
      const noteSeekRequest = (countable: boolean) => {
        const m = meta[index];
        const now = performance.now();
        m.pendingSeek = { at: now, sample: countable };
        if (m.unresolvedSince === null) {
          m.unresolvedSince = now;
        } else if (now - Math.max(m.unresolvedSince, m.lastFrameAt) > STALL_MS) {
          // Requests keep arriving, nothing completed AND no new picture was
          // presented: the image is genuinely stuck (superseded-but-updating
          // seeks keep lastFrameAt fresh and never count).
          recordSample(index, now - Math.max(m.unresolvedSince, m.lastFrameAt), countable);
          m.unresolvedSince = now;
        }
      };
      const onSeeked = () => {
        const m = meta[index];
        const request = m.pendingSeek;
        m.pendingSeek = null;
        m.unresolvedSince = null;
        if (request) recordSample(index, performance.now() - request.at, request.sample);
        // Flush: the newest desired time goes out the moment the previous seek is done.
        if (transportEngaged() && m.desired >= 0 && m.desired !== m.lastRequested) requestSeek();
      };

      // Presented-frame clock for stall detection (no-op where rVFC is missing).
      let frameCallbackId: number | null = null;
      const armFrameCallback = () => {
        if (typeof videoEl.requestVideoFrameCallback !== "function") return;
        frameCallbackId = videoEl.requestVideoFrameCallback((_now, metadata) => {
          meta[index].lastFrameAt = performance.now();
          meta[index].presentedMediaTime = metadata.mediaTime;
          armFrameCallback();
        });
      };
      armFrameCallback();
      cleanups.push(() => {
        if (frameCallbackId !== null && typeof videoEl.cancelVideoFrameCallback === "function") videoEl.cancelVideoFrameCallback(frameCallbackId);
      });

      applyFns[index] = apply;
      engagedFns[index] = transportEngaged;
      seekFns[index] = requestSeek;

      const onLoadedMetadata = () => {
        meta[index].duration = videoEl.duration;
        // Metadata can resolve after the last scroll-driven onUpdate (e.g. a
        // fast jump straight into an unprefetched boundary); re-apply the
        // trigger's current progress so the video doesn't stay stuck on a
        // stale frame until the next scroll tick.
        if (trigger) {
          meta[index].transport.reset(trigger.progress);
          meta[index].appliedKey = null;
          apply(trigger.progress, trigger.progress);
        }
      };
      const onError = () => {
        const m = meta[index];
        const failedTier = m.tier;
        if (!failedTier || !videoEl.getAttribute("src")) return;
        if (IS_DEV) console.error(`[CinematicTransitionLayer] failed to load ${boundary.sources[failedTier]}`);
        // HIGH -> STANDARD -> FALLBACK. The failed source can never have been
        // shown, so swapping it even for an active boundary cannot jump frames.
        const c = ensureController();
        const next = c.noteLoadFailure(failedTier);
        if (next !== failedTier && !m.tried.has(next)) {
          attachTier(index, next);
          restageUpcoming();
        } else {
          // Nothing lower left: existing clean-cut / scene-handoff behaviour.
          m.failed = true;
          gsap.set(videoEl, { opacity: 0 });
        }
        publishDebug();
      };
      videoEl.addEventListener("loadedmetadata", onLoadedMetadata);
      videoEl.addEventListener("seeked", onSeeked);
      videoEl.addEventListener("error", onError);
      cleanups.push(() => {
        videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
        videoEl.removeEventListener("seeked", onSeeked);
        videoEl.removeEventListener("error", onError);
      });

      const configureTransport = () => {
        const t = meta[index].trigger;
        const range = t ? t.end - t.start : 0;
        if (range > 0) meta[index].transport.configure({ overlapFrac: TRANSITION_OVERLAP_PX / range }, TRANSPORT_DEADBAND_PX / range);
      };
      const trigger = ScrollTrigger.create({
        trigger: spacerEl,
        start: "top top+=64",
        end: "bottom top-=64",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Transport engaged: the single ticker (KavachExperience) owns presentation via step().
          // Otherwise (no Lenis: visual tests, reduced motion, native-only) the original 1:1 mapping.
          if (transportEngaged()) return;
          meta[index].transport.reset(self.progress);
          apply(self.progress, self.progress);
        },
        onRefresh: () => configureTransport(),
      });
      meta[index].trigger = trigger;
      triggers.push(trigger);
      configureTransport();
    });

    // ---- Cinematic transport driver -----------------------------------------------------
    // ONE chain: Lenis' canonical scroll -> ScrollTrigger progress (= raw target, immediate)
    // -> BoundaryTransport (velocity/accel-limited, coalesced) -> frame + seam. The step runs in
    // the same gsap tick, right after lenis.raf (KavachExperience), so there is one writer per frame.
    let lastTick: number | null = null;
    let lastScrollY = window.scrollY;
    const recorder = createMotionRecorder();
    const stepAll = (nowSeconds: number) => {
      const stepStart = recorder.on ? performance.now() : 0;
      const dt = lastTick === null ? 0 : nowSeconds - lastTick;
      lastTick = nowSeconds;
      lastScrollY = window.scrollY;
      if (dt > 0.002 && dt < 0.1) frameMsAverage += (dt * 1000 - frameMsAverage) * 0.1;
      let watched = -1;
      meta.forEach((m, i) => {
        const trig = m.trigger;
        if (!trig || !engagedFns[i]?.()) return;
        const t = m.transport;
        t.feed(trig.progress);
        t.step(dt);
        const key = `${t.presented}|${t.target}`;
        if (key !== m.appliedKey) {
          m.appliedKey = key;
          applyFns[i](t.presented, t.target);
        } else if (m.desired >= 0 && m.desired !== m.lastRequested) {
          seekFns[i]();
        }
        if (watched < 0 && (!t.settled || (trig.progress > 0 && trig.progress < 1))) watched = i;
      });
      if (recorder.on && watched >= 0) recorder.push({ ...motionFrame(watched, nowSeconds, dt), stepMs: performance.now() - stepStart });
    };
    /** Bounded pending intent + handoff gates: what raw scroll position the transport lets the page reach. */
    const governScroll = (y: number): number => {
      const prev = lastScrollY;
      const lo = Math.min(y, prev);
      const hi = Math.max(y, prev);
      const order = y >= prev ? meta.map((_, i) => i) : meta.map((_, i) => meta.length - 1 - i);
      for (const i of order) {
        const m = meta[i];
        const trig = m.trigger;
        if (!trig || !engagedFns[i]?.() || hi <= trig.start || lo >= trig.end) continue;
        const range = trig.end - trig.start;
        const limits = m.transport.limits();
        const limited = Math.min(trig.start + limits.hi * range, Math.max(trig.start + limits.lo * range, y));
        lastScrollY = limited;
        return limited;
      }
      lastScrollY = y;
      return y;
    };
    const enabledChanged = (enabled: boolean) => {
      lastTick = null;
      lastScrollY = window.scrollY;
      meta.forEach((m, i) => {
        m.appliedKey = null;
        if (!m.trigger) return;
        m.transport.reset(m.trigger.progress);
        if (!enabled) applyFns[i]?.(m.trigger.progress, m.trigger.progress);
      });
    };
    const unregisterTransport = transportBridge.register({ step: stepAll, governScroll, enabledChanged });
    cleanups.push(unregisterTransport);
    const motionFrame = (i: number, nowSeconds: number, dt: number) => {
      const m = meta[i];
      const el = videoRefs.current[i];
      const t = m.transport;
      return {
        t: performance.now(),
        dt: dt * 1000,
        id: TRANSITION_REGISTRY[i].id,
        tier: m.tier,
        y: window.scrollY,
        target: t.target,
        presented: t.presented,
        gap: t.target - t.presented,
        velocity: t.velocity,
        acceleration: t.acceleration,
        desiredTime: m.desired,
        requestedTime: m.lastRequested,
        currentTime: el ? el.currentTime : null,
        presentedMediaTime: m.presentedMediaTime,
        seeking: el ? el.seeking : null,
        frameAgeMs: m.lastFrameAt ? performance.now() - m.lastFrameAt : null,
        writes: m.writes,
        opacity: el ? parseFloat(el.style.opacity || "0") : null,
      };
    };

    // Staging policy. The <video> elements ship WITHOUT a src, so nothing is
    // fetched until a boundary is actually about to be scrubbed:
    //  - stage: track within ~1.5 viewport heights -> attach src + preload.
    //  - release: track farther than ~3.5 viewport heights -> drop src so the
    //    decoder/media buffer is freed (at most ~2 boundaries live at once).
    //  - bypass (mobile film-bypass or reduced motion): never stage, and
    //    release anything already staged; the video is never shown there.
    const trackIndex = (el: Element) => {
      const id = (el as HTMLElement).dataset.transitionTrack;
      return TRANSITION_REGISTRY.findIndex((boundary) => boundary.id === id);
    };
    /** Attaches exactly ONE variant (the given tier) of this boundary. */
    function attachTier(index: number, tier: TransitionTier) {
      const videoEl = videoRefs.current[index];
      if (!videoEl) return;
      const m = meta[index];
      m.tier = tier;
      m.tried.add(tier);
      m.duration = 0;
      m.pendingSeek = null;
      m.unresolvedSince = null;
      m.lastRequested = null;
      m.desired = -1;
      m.presentedMediaTime = null;
      m.appliedKey = null;
      videoEl.preload = "auto";
      videoEl.setAttribute("src", TRANSITION_REGISTRY[index].sources[tier]);
    }
    const stage = (index: number) => {
      const videoEl = index >= 0 ? videoRefs.current[index] : null;
      if (!videoEl || meta[index].failed || isBypassMode() || videoEl.getAttribute("src")) return;
      const c = ensureController();
      const before = c.tier;
      const tier = c.tierForNextStage();
      meta[index].tried.clear();
      attachTier(index, tier);
      if (tier !== before) restageUpcoming();
      publishDebug();
    };
    const release = (index: number) => {
      const videoEl = index >= 0 ? videoRefs.current[index] : null;
      if (!videoEl || !videoEl.getAttribute("src")) return;
      meta[index].duration = 0;
      meta[index].tier = null;
      meta[index].pendingSeek = null;
      meta[index].unresolvedSince = null;
      meta[index].lastRequested = null;
      meta[index].desired = -1;
      meta[index].presentedMediaTime = null;
      meta[index].appliedKey = null;
      videoEl.preload = "none";
      videoEl.removeAttribute("src");
      videoEl.load();
      publishDebug();
    };
    /**
     * After a quality change: swap the variant of every staged boundary that has
     * NOT been reached yet (progress 0), so no unused variant lingers. A boundary
     * that has started (or finished) keeps its source untouched.
     */
    function restageUpcoming() {
      if (!controller || isBypassMode()) return;
      const want = controller.tier;
      meta.forEach((m, i) => {
        const el = videoRefs.current[i];
        if (!el || !el.getAttribute("src") || m.failed || m.tier === want || progressOf(i) !== 0) return;
        release(i);
        m.tried.clear();
        attachTier(i, want);
      });
      publishDebug();
    }
    function recordSample(index: number, latencyMs: number, countable: boolean) {
      const m = meta[index];
      if (!countable || !controller || m.tier !== controller.tier) return;
      controller.record(latencyMs);
      if (controller.evaluationDue && controller.evaluate()) restageUpcoming();
    }

    const stageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) stage(trackIndex(entry.target));
        });
      },
      { rootMargin: "150% 0px" },
    );
    const releaseObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) release(trackIndex(entry.target));
        });
      },
      { rootMargin: "350% 0px" },
    );
    const trackEls = Array.from(document.querySelectorAll<HTMLElement>("[data-transition-track]"));
    const observeTracks = () => {
      trackEls.forEach((el) => {
        stageObserver.observe(el);
        releaseObserver.observe(el);
      });
    };
    observeTracks();

    // Viewport / motion-preference changes: drop staged media when entering
    // bypass; re-observe (fresh initial callback) when leaving it.
    const modeQueries = [
      window.matchMedia(MOBILE_QUERY),
      window.matchMedia(REDUCED_MOTION_QUERY),
    ];
    const onModeChange = () => {
      if (isBypassMode()) {
        TRANSITION_REGISTRY.forEach((_, index) => release(index));
      } else {
        stageObserver.disconnect();
        releaseObserver.disconnect();
        observeTracks();
      }
    };
    modeQueries.forEach((query) => query.addEventListener("change", onModeChange));

    // Re-derive the viewport benefit (e.g. window moved to a denser display).
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!controller || forcedTier || isBypassMode()) return;
        controller.applyCapabilityDecision(decideFromCapabilities(capabilityReport, viewportInfo(), allowHigh));
        restageUpcoming();
        publishDebug();
      }, 200);
    };
    window.addEventListener("resize", onResize);

    // Development / test hook only (never present in a production build).
    if (IS_DEV) {
      (window as unknown as { __kpMotion?: unknown }).__kpMotion = {
        defaults: DEFAULT_TRANSPORT_PARAMS,
        params: () => ({ ...meta[0].transport.params }),
        /** Live-tune every boundary's transport (e.g. `__kpMotion.setParams({ vMax: 0.9 })`). */
        setParams: (patch: Partial<TransportParams>) => meta.forEach((m) => Object.assign(m.transport.params, patch)),
        setSeekInterval: (ms: number) => { SEEK_TUNING.minIntervalMs = ms; },
        enabled: () => transportBridge.enabled,
        snapshot: () =>
          meta.map((m, i) => ({
            id: TRANSITION_REGISTRY[i].id,
            tier: m.tier,
            engaged: engagedFns[i]?.() ?? false,
            ...m.transport.snapshot(),
            desiredTime: m.desired,
            requestedTime: m.lastRequested,
            currentTime: videoRefs.current[i]?.currentTime ?? null,
            presentedMediaTime: m.presentedMediaTime,
            writes: m.writes,
            jumps: m.transport.jumps,
          })),
        record: (on: boolean) => {
          recorder.on = on;
          if (on) recorder.frames = [];
        },
        frames: () => recorder.frames,
      };
    }
    // `?motionDebug=1` (dev only): a small readout of the transport for the boundary being scrubbed.
    let debugTimer: number | undefined;
    let debugEl: HTMLPreElement | null = null;
    if (IS_DEV && new URLSearchParams(window.location.search).get("motionDebug") === "1") {
      debugEl = document.createElement("pre");
      debugEl.setAttribute("data-motion-debug", "");
      debugEl.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#9fe;background:rgba(0,0,0,.72);pointer-events:none;white-space:pre";
      document.body.appendChild(debugEl);
      debugTimer = window.setInterval(() => {
        const i = meta.findIndex((m) => m.trigger && m.trigger.progress > 0 && m.trigger.progress < 1);
        if (!debugEl) return;
        if (i < 0) {
          debugEl.textContent = `motion ${transportBridge.enabled ? "transport" : "passthrough"} | idle`;
          return;
        }
        const m = meta[i];
        const el = videoRefs.current[i];
        const t = m.transport;
        debugEl.textContent = [
          `${TRANSITION_REGISTRY[i].id}  tier ${m.tier ?? "-"}  ${transportBridge.enabled ? "transport" : "passthrough"}`,
          `scrollY ${window.scrollY.toFixed(0)}  raw ${(m.trigger?.progress ?? 0).toFixed(4)}`,
          `target ${t.target.toFixed(4)}  presented ${t.presented.toFixed(4)}  gap ${t.debt.toFixed(4)}`,
          `v ${t.velocity.toFixed(3)}/s  a ${t.acceleration.toFixed(2)}/s^2`,
          `media desired ${m.desired.toFixed(3)}  req ${m.lastRequested?.toFixed(3) ?? "-"}  ct ${el?.currentTime.toFixed(3) ?? "-"}  shown ${m.presentedMediaTime?.toFixed(3) ?? "-"}`,
          `seeking ${el?.seeking ? "y" : "n"}  frame age ${m.lastFrameAt ? (performance.now() - m.lastFrameAt).toFixed(0) : "-"} ms  writes ${m.writes}`,
        ].join("\n");
      }, 100);
    }

    // Development / test hook only (never present in a production build).
    if (IS_DEV) {
      (window as unknown as { __kpTransitionQuality?: unknown }).__kpTransitionQuality = {
        state: () => ({
          quality: currentQuality(),
          tier: controller?.tier ?? null,
          cap: controller?.cap ?? null,
          forced: forcedTier,
          adaptive: controller?.adaptive ?? null,
          samples: controller?.sampleCount ?? 0,
          latencies: controller?.samplesSnapshot() ?? [],
          history: controller?.historySnapshot() ?? [],
          events: controller?.events.map((e) => ({ ...e })) ?? [],
          staged: meta.map((m, i) => ({ id: TRANSITION_REGISTRY[i].id, tier: m.tier, progress: progressOf(i) })),
        }),
        /** Pose the seam model prescribes for a boundary at a progress (pure; for tests). */
        seamPose: (id: string, progress: number) => {
          const seam = TRANSITION_SEAMS[id];
          const spacer = document.querySelector<HTMLElement>(`[data-transition-track='${id}']`);
          const overlapFrac = spacer ? TRANSITION_OVERLAP_PX / (spacer.offsetHeight + 128) : 0.03;
          return seam ? seamPoseAt(seam, progress, { width: window.innerWidth, height: window.innerHeight }, overlapFrac) : null;
        },
        /** Native (untransformed) vs presented (transformed) video bounds, in CSS px. */
        videoRects: (id: string) => {
          const el = document.querySelector<HTMLVideoElement>(`[data-transition-video='${id}']`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const l = layerRef.current?.getBoundingClientRect();
          return {
            layer: l ? { x: l.x, y: l.y, width: l.width, height: l.height } : null,
            native: { width: el.offsetWidth, height: el.offsetHeight },
            presented: { x: r.x, y: r.y, width: r.width, height: r.height },
          };
        },
        /** Closed-loop calibration: replace a boundary's start/end pose at the current viewport, then re-apply. */
        setSeamOverride: (id: string, pose: { start?: SeamPose; end?: SeamPose } | null) => {
          if (pose) seamOverrides[id] = pose;
          else delete seamOverrides[id];
          const i = TRANSITION_REGISTRY.findIndex((b) => b.id === id);
          if (i >= 0) meta[i].seamKey = null;
          if (i >= 0) applyFns[i]?.(meta[i].transport.presented, meta[i].transport.target);
        },
        /** Feed synthetic seek latencies (ms) into the CURRENT tier's rolling window. */
        inject: (latencies: number[]) => {
          const c = ensureController();
          latencies.forEach((ms) => c.record(ms));
          if (c.evaluationDue && c.evaluate()) restageUpcoming();
          publishDebug();
        },
      };
    }
    publishDebug();

    return () => {
      disposed = true;
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      if (IS_DEV) delete (window as unknown as { __kpTransitionQuality?: unknown }).__kpTransitionQuality;
      if (IS_DEV) delete (window as unknown as { __kpMotion?: unknown }).__kpMotion;
      if (debugTimer !== undefined) window.clearInterval(debugTimer);
      debugEl?.remove();
      triggers.forEach((trigger) => trigger.kill());
      cleanups.forEach((fn) => fn());
      stageObserver.disconnect();
      releaseObserver.disconnect();
      modeQueries.forEach((query) => query.removeEventListener("change", onModeChange));
    };
  }, []);

  return (
    <div ref={layerRef} className={styles.layer} data-cinematic-transition-layer aria-hidden="true">
      {TRANSITION_REGISTRY.map((boundary, index) => (
        <div
          key={`${boundary.id}-backdrop`}
          ref={(el) => {
            backdropRefs.current[index] = el;
          }}
          className={styles.seamBackdrop}
          data-transition-backdrop={boundary.id}
        />
      ))}
      {TRANSITION_REGISTRY.map((boundary, index) => (
        <video
          key={boundary.id}
          ref={(el) => {
            videoRefs.current[index] = el;
          }}
          className={styles.video}
          data-transition-video={boundary.id}
          muted
          playsInline
          preload="none"
          controls={false}
          tabIndex={-1}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
