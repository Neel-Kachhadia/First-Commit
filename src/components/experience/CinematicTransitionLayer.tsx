"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { experienceStore } from "@/lib/experience/store";
import {
  TRANSITION_REGISTRY,
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
  trigger: ScrollTrigger | null;
};

const IS_DEV = process.env.NODE_ENV !== "production";
/** No seek completing for this long while the film is being scrubbed = a stall sample. */
const STALL_MS = 400;

const MOBILE_QUERY = "(max-width: 48rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const isMobileViewport = () => window.matchMedia(MOBILE_QUERY).matches;

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
      trigger: null,
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
    const applyFns: Array<(progress: number) => void> = [];
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

      const applyProgress = (progress: number) => {
        if (isBypassMode() || meta[index].failed) {
          meta[index].seamKey = null; // a later re-entry must re-apply the pose
          gsap.set(videoEl, { opacity: 0 });
          return;
        }

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
          opacity = seamOpacity(progress, overlapFrac);
          const seamKey = `${progress}|${viewport.width}|${viewport.height}|${override ? 1 : 0}`;
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
          opacity = computeTransitionOpacity(progress, TRANSITION_EDGE_FRACTION);
          gsap.set(videoEl, { opacity });
        }

        if (meta[index].duration > 0) {
          const seamCfg = seamsOff ? undefined : TRANSITION_SEAMS[boundary.id];
          const framePosition = seamCfg ? seamVideoProgress(seamCfg, progress, TRANSITION_OVERLAP_PX / rangePx) : progress;
          const target = progressToVideoTime(framePosition, meta[index].duration);
          if (Math.abs(videoEl.currentTime - target) > 0.008) {
            noteSeekRequest(opacity >= 0.5 && progress > 0.05 && progress < 0.95);
            videoEl.currentTime = target;
          }
        }
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
      };

      // Presented-frame clock for stall detection (no-op where rVFC is missing).
      let frameCallbackId: number | null = null;
      const armFrameCallback = () => {
        if (typeof videoEl.requestVideoFrameCallback !== "function") return;
        frameCallbackId = videoEl.requestVideoFrameCallback(() => {
          meta[index].lastFrameAt = performance.now();
          armFrameCallback();
        });
      };
      armFrameCallback();
      cleanups.push(() => {
        if (frameCallbackId !== null && typeof videoEl.cancelVideoFrameCallback === "function") videoEl.cancelVideoFrameCallback(frameCallbackId);
      });

      applyFns[index] = applyProgress;

      const onLoadedMetadata = () => {
        meta[index].duration = videoEl.duration;
        // Metadata can resolve after the last scroll-driven onUpdate (e.g. a
        // fast jump straight into an unprefetched boundary); re-apply the
        // trigger's current progress so the video doesn't stay stuck on a
        // stale frame until the next scroll tick.
        if (trigger) applyProgress(trigger.progress);
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

      const trigger = ScrollTrigger.create({
        trigger: spacerEl,
        start: "top top+=64",
        end: "bottom top-=64",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          applyProgress(self.progress);
        },
      });
      meta[index].trigger = trigger;
      triggers.push(trigger);
    });

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
          if (i >= 0) applyFns[i]?.(progressOf(i));
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
