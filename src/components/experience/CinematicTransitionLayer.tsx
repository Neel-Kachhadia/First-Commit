"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { experienceStore } from "@/lib/experience/store";
import { TRANSITION_REGISTRY, TRANSITION_EDGE_FRACTION } from "@/lib/experience/transition-registry";
import { computeTransitionOpacity, progressToVideoTime } from "@/lib/experience/transition-math";
import styles from "./CinematicTransitionLayer.module.css";

type BoundaryMeta = {
  duration: number;
  failed: boolean;
};

const isMobileViewport = () => window.matchMedia("(max-width: 48rem)").matches;

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

  useEffect(() => {
    const meta: BoundaryMeta[] = TRANSITION_REGISTRY.map(() => ({
      duration: 0,
      failed: false,
    }));

    const cleanups: Array<() => void> = [];
    const triggers: ScrollTrigger[] = [];

    TRANSITION_REGISTRY.forEach((boundary, index) => {
      const videoEl = videoRefs.current[index];
      const spacerEl = document.querySelector<HTMLElement>(
        `[data-transition-track='${boundary.id}']`,
      );
      if (!videoEl || !spacerEl) return;

      const applyProgress = (progress: number) => {
        const bypass = experienceStore.getState().reducedMotion || isMobileViewport();
        if (bypass || meta[index].failed) {
          gsap.set(videoEl, { opacity: 0 });
          return;
        }

        const opacity = computeTransitionOpacity(progress, TRANSITION_EDGE_FRACTION);
        gsap.set(videoEl, { opacity });

        if (meta[index].duration > 0) {
          const target = progressToVideoTime(progress, meta[index].duration);
          if (Math.abs(videoEl.currentTime - target) > 0.008) {
            videoEl.currentTime = target;
          }
        }
      };

      const onLoadedMetadata = () => {
        meta[index].duration = videoEl.duration;
        // Metadata can resolve after the last scroll-driven onUpdate (e.g. a
        // fast jump straight into an unprefetched boundary); re-apply the
        // trigger's current progress so the video doesn't stay stuck on a
        // stale frame until the next scroll tick.
        if (trigger) applyProgress(trigger.progress);
      };
      const onError = () => {
        meta[index].failed = true;
        gsap.set(videoEl, { opacity: 0 });
        if (process.env.NODE_ENV !== "production") {
          console.error(`[CinematicTransitionLayer] failed to load ${boundary.src}`);
        }
      };
      videoEl.addEventListener("loadedmetadata", onLoadedMetadata);
      videoEl.addEventListener("error", onError);
      cleanups.push(() => {
        videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
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
      triggers.push(trigger);
    });

    // Prefetch: bump preload for boundaries whose track is within ~1.5
    // viewport heights of the current scroll position.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = (entry.target as HTMLElement).dataset.transitionTrack;
          const index = TRANSITION_REGISTRY.findIndex((boundary) => boundary.id === id);
          const videoEl = index >= 0 ? videoRefs.current[index] : null;
          if (videoEl && videoEl.preload !== "auto") {
            videoEl.preload = "auto";
            if (videoEl.readyState === 0) videoEl.load();
          }
        });
      },
      { rootMargin: "150% 0px" },
    );
    document.querySelectorAll<HTMLElement>("[data-transition-track]").forEach((el) => {
      observer.observe(el);
    });

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      cleanups.forEach((fn) => fn());
      observer.disconnect();
    };
  }, []);

  return (
    <div className={styles.layer} data-cinematic-transition-layer aria-hidden="true">
      {TRANSITION_REGISTRY.map((boundary, index) => (
        <video
          key={boundary.id}
          ref={(el) => {
            videoRefs.current[index] = el;
          }}
          className={styles.video}
          data-transition-video={boundary.id}
          src={boundary.src}
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
