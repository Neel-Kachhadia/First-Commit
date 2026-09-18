"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { OpeningScene } from "./Opening/OpeningScene";
import { MandateScene } from "./Mandate/MandateScene";
import { DecisionsScene } from "./Decisions/DecisionsScene";
import { DelegationScene } from "./Delegation/DelegationScene";
import { StepUpScene } from "./StepUp/StepUpScene";
import { RevocationScene } from "./Revocation/RevocationScene";
import { SplitDefenseScene } from "./SplitDefense/SplitDefenseScene";
import { ConcurrencyScene } from "./Concurrency/ConcurrencyScene";
import { CausalReplayScene } from "./CausalReplay/CausalReplayScene";
import { DebugStageHUD } from "./DebugStageHUD";
import { GlobalNavbar } from "./GlobalNavbar";
import { FilmIntro } from "./FilmIntro/FilmIntro";
import { experienceStore, useExperienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import {
  SCENE_BY_KEY,
  SCENE_REGISTRY,
  sceneFromHash,
  type RegisteredSceneKey,
} from "@/lib/experience/scene-registry";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import type { ExperienceScene } from "@/lib/experience/demo-state";
import styles from "./KavachExperience.module.css";

const ExperienceCanvas = dynamic(
  () => import("@/components/webgl/ExperienceCanvas").then((module) => module.ExperienceCanvas),
  { ssr: false },
);

type SceneEvent = CustomEvent<{ id: ExperienceScene; progress?: number }>;

declare global {
  interface Window {
    ScrollTrigger?: typeof ScrollTrigger;
    gsap?: typeof gsap;
  }
}

export function KavachExperience() {
  const lenisRef = useRef<Lenis | null>(null);
  const menuScrollYRef = useRef(0);
  const previousOverflowRef = useRef({ html: "", body: "" });
  const introOverflowRef = useRef({ html: "", body: "" });
  const introLockedRef = useRef(false);
  // Last-settled viewport height, used to reconstruct pre-resize track geometry -- the
  // native `resize` event fires AFTER layout has already recomputed vh-based track heights,
  // so by the time a resize handler runs, the DOM no longer holds the "before" geometry.
  const viewportHeightRef = useRef(0);
  // Continuously-tracked scroll position. A resize that shrinks the document (e.g. a
  // shorter viewport near the end of the experience) can make the browser clamp
  // `window.scrollY` to the new, smaller max-scroll DURING reflow, before any resize
  // handler runs -- by the time `handleResize` reads `window.scrollY` the true pre-resize
  // position can already be gone. This ref, updated on every native scroll event, survives
  // that clamp.
  const lastScrollYRef = useRef(0);

  const navigateScene = useCallback((key: RegisteredSceneKey) => {
    const scene = SCENE_BY_KEY[key];
    const track = document.querySelector<HTMLElement>(`[data-track='${scene.slug}']`);
    if (!track) return;

    const target = Math.max(
      0,
      window.scrollY + track.getBoundingClientRect().top + track.offsetHeight * scene.safeProgress,
    );
    window.history.replaceState(window.history.state, "", `#scene-${scene.number}`);

    // Direct chapter navigation resolves in one synchronous jump, not an animated
    // scroll -- an animated tween would visibly traverse every intermediate scene's
    // ownership window on the way to the target (Step 10 of the isolated-scene model).
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { immediate: true, force: true });
    } else {
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
    }
    ScrollTrigger.update();
  }, []);

  const handleMenuOpenChange = useCallback((open: boolean) => {
    const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
    if (open) {
      menuScrollYRef.current = window.scrollY;
      previousOverflowRef.current = {
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      };
      lenisRef.current?.stop();
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      if (stage) {
        stage.inert = true;
        stage.setAttribute("aria-hidden", "true");
      }
      return;
    }

    document.documentElement.style.overflow = previousOverflowRef.current.html;
    document.body.style.overflow = previousOverflowRef.current.body;
    window.scrollTo({ top: menuScrollYRef.current, left: 0, behavior: "auto" });
    if (stage) {
      stage.inert = false;
      stage.removeAttribute("aria-hidden");
    }
    lenisRef.current?.start();
    ScrollTrigger.update();
  }, []);

  const lockForIntro = useCallback(() => {
    const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
    introLockedRef.current = true;
    introOverflowRef.current = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    lenisRef.current?.stop();
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (stage) {
      stage.inert = true;
      stage.setAttribute("aria-hidden", "true");
    }
  }, []);

  const releaseFromIntro = useCallback(() => {
    const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
    introLockedRef.current = false;
    document.documentElement.style.overflow = introOverflowRef.current.html;
    document.body.style.overflow = introOverflowRef.current.body;
    if (stage) {
      stage.inert = false;
      stage.removeAttribute("aria-hidden");
    }
    lenisRef.current?.start();
    ScrollTrigger.update();
  }, []);

  useEffect(() => {
    window.ScrollTrigger = ScrollTrigger;
    window.gsap = gsap;
    viewportHeightRef.current = window.innerHeight;
    lastScrollYRef.current = window.scrollY;
    const trackScrollY = () => {
      lastScrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", trackScrollY, { passive: true });
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visualTest = new URLSearchParams(window.location.search).has("visualTest");
    experienceStore.getState().setReducedMotion(motionQuery.matches);

    const syncSemanticOwner = (id: RegisteredSceneKey) => {
      const activeSlug = SCENE_BY_KEY[id].slug;
      document.querySelectorAll<HTMLElement>("[data-scene]").forEach((root) => {
        const owned = root.dataset.scene === activeSlug;
        root.setAttribute("aria-hidden", owned ? "false" : "true");
        root.inert = !owned;
        if (motionQuery.matches) {
          root.style.visibility = owned ? "visible" : "hidden";
          root.style.opacity = owned ? "1" : "0";
          root.style.pointerEvents = owned ? "auto" : "none";
        }
      });
    };

    const setActiveScene = (id: RegisteredSceneKey) => {
      experienceStore.getState().setScene(id);
      progressBus.setActiveScene(id);
      syncSemanticOwner(id);
      const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
      if (stage) stage.dataset.activeScene = id;
    };

    const handleScene = (event: Event) => {
      const { id } = (event as SceneEvent).detail;
      if (id !== "none") setActiveScene(id);
    };

    window.addEventListener("kp:scene", handleScene);

    let tick: ((time: number) => void) | null = null;

    const stopSmoothScroll = () => {
      if (tick) gsap.ticker.remove(tick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
      tick = null;
      gsap.ticker.lagSmoothing(500, 33);
    };

    const startSmoothScroll = () => {
      if (visualTest || motionQuery.matches || lenisRef.current) return;
      const lenis = new Lenis({
        autoRaf: false,
        duration: 0.72,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.94,
      });
      lenisRef.current = lenis;
      const activeLenis = lenis;
      // FilmIntro's lock effect (a child) can run before this parent effect creates Lenis;
      // converge on the correct state regardless of which fired first.
      if (introLockedRef.current) activeLenis.stop();
      tick = (time: number) => activeLenis.raf(time * 1000);
      activeLenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    };

    const handleMotionPreference = () => {
      experienceStore.getState().setReducedMotion(motionQuery.matches);
      if (motionQuery.matches) stopSmoothScroll();
      else startSmoothScroll();
      ScrollTrigger.refresh();
    };

    motionQuery.addEventListener("change", handleMotionPreference);
    startSmoothScroll();

    // Single ownership semantic: each scene's own visibility ScrollTrigger (top top / bottom
    // top anchored, already dispatching `kp:scene` on enter/enterBack) is the sole writer to
    // `experienceStore`. No separate center-anchored trigger here — that was the KP-MOTION-003
    // architectural ambiguity (navbar leading the real visual owner by ~half a viewport height).
    // `reconcileOwner` below is only a resync path (cold start / pageshow / hashchange / resize)
    // and mirrors the same top-of-track..bottom-of-track window, not viewport-center math.
    const trackFor = (slug: string) => document.querySelector<HTMLElement>(`[data-track='${slug}']`);

    const findOwnerAt = (scrollY: number) =>
      SCENE_REGISTRY.find((candidate) => {
        const track = trackFor(candidate.slug);
        return track && scrollY >= track.offsetTop && scrollY < track.offsetTop + track.offsetHeight;
      }) ?? SCENE_REGISTRY[SCENE_REGISTRY.length - 1];

    // Pure (DOM-free) mirror of the scroll track's geometry: each track is a plain block
    // `${trackVh}vh` tall with no overlap (see KavachExperience.module.css `.trackSegment`),
    // so offsetTop/height can be reconstructed from `vhPx` alone. Used only to recover
    // *pre-resize* geometry once the DOM has already moved on to the new size.
    const findOwnerAtWithVh = (scrollY: number, vhPx: number) => {
      let offset = 0;
      for (const scene of SCENE_REGISTRY) {
        const height = (scene.trackVh * vhPx) / 100;
        if (scrollY < offset + height) return { scene, offsetTop: offset, height };
        offset += height;
      }
      const last = SCENE_REGISTRY[SCENE_REGISTRY.length - 1];
      const lastHeight = (last.trackVh * vhPx) / 100;
      return { scene: last, offsetTop: offset - lastHeight, height: lastHeight };
    };

    const reconcileOwner = () => {
      setActiveScene(findOwnerAt(window.scrollY).key);
    };

    const refresh = () => {
      ScrollTrigger.refresh();
      reconcileOwner();
    };
    const restoreHashScene = () => {
      const scene = sceneFromHash(window.location.hash);
      if (!scene) {
        reconcileOwner();
        return;
      }
      const track = trackFor(scene.slug);
      if (!track) return;
      const target = track.offsetTop + track.offsetHeight * scene.safeProgress;
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      ScrollTrigger.update();
      setActiveScene(scene.key);
    };

    // KP-MOTION-002: resize must preserve normalized experience position, not absolute
    // scrollY. Track lengths are viewport-height-derived, so a resize moves every pixel
    // boundary while the browser leaves scrollY untouched -- capture {owner, progress
    // within owner's track} first, let ScrollTrigger recompute geometry, then remap scroll
    // to the equivalent pixel offset under the new geometry. Single-shot, no animation, so
    // it can't retrigger its own resize/refresh loop.
    //
    // The native `resize` event fires AFTER the browser has already reflowed vh-based
    // track heights to the new viewport -- by the time this handler runs, `track.offsetTop`/
    // `offsetHeight` already reflect the NEW size, so reading the DOM here for "before" state
    // would just recompute the same (already-broken) position the bug produces. Pre-resize
    // geometry has to be reconstructed from `viewportHeightRef` (the last-settled height,
    // cached below) via `findOwnerAtWithVh` instead.
    let resizeFrame: number | null = null;
    const handleResize = () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      // Use the continuously-tracked scroll position, not a fresh `window.scrollY` read --
      // see `lastScrollYRef`'s comment for why the live value can already be clamped here.
      const scrollYBefore = lastScrollYRef.current;
      const oldVhPx = viewportHeightRef.current || window.innerHeight;
      const { scene: ownerBefore, offsetTop, height } = findOwnerAtWithVh(scrollYBefore, oldVhPx);
      const progress = height > 0 ? Math.min(1, Math.max(0, (scrollYBefore - offsetTop) / height)) : 0;

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        ScrollTrigger.refresh();
        const trackAfter = trackFor(ownerBefore.slug);
        if (trackAfter) {
          const target = trackAfter.offsetTop + trackAfter.offsetHeight * progress;
          if (lenisRef.current) {
            // Lenis caches its own scroll limit and only recomputes it via its own
            // (differently-timed) resize handling -- without forcing that recompute first,
            // a corrective scrollTo past the OLD limit silently clamps to the stale value.
            lenisRef.current.resize();
            lenisRef.current.scrollTo(target, { immediate: true, force: true });
          } else {
            window.scrollTo({ top: target, left: 0, behavior: "auto" });
          }
          lastScrollYRef.current = window.scrollY;
        }
        viewportHeightRef.current = window.innerHeight;
        ScrollTrigger.update();
        reconcileOwner();
      });
    };

    document.fonts.ready.then(() => {
      refresh();
      restoreHashScene();
    });
    window.addEventListener("load", refresh, { once: true });
    window.addEventListener("pageshow", reconcileOwner);
    window.addEventListener("hashchange", restoreHashScene);
    window.addEventListener("resize", handleResize);
    requestAnimationFrame(reconcileOwner);

    return () => {
      window.removeEventListener("kp:scene", handleScene);
      window.removeEventListener("load", refresh);
      window.removeEventListener("pageshow", reconcileOwner);
      window.removeEventListener("hashchange", restoreHashScene);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", trackScrollY);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      motionQuery.removeEventListener("change", handleMotionPreference);
      document.documentElement.style.overflow = previousOverflowRef.current.html;
      document.body.style.overflow = previousOverflowRef.current.body;
      stopSmoothScroll();
    };
  }, []);

  const prologueTrackRef = useRef<HTMLDivElement>(null);
  const mandateTrackRef = useRef<HTMLDivElement>(null);
  const decisionsTrackRef = useRef<HTMLDivElement>(null);
  const delegationTrackRef = useRef<HTMLDivElement>(null);
  const stepUpTrackRef = useRef<HTMLDivElement>(null);
  const revocationTrackRef = useRef<HTMLDivElement>(null);
  const splitDefenseTrackRef = useRef<HTMLDivElement>(null);
  const concurrencyTrackRef = useRef<HTMLDivElement>(null);
  const causalReplayTrackRef = useRef<HTMLDivElement>(null);

  const introComplete = useExperienceStore((state) => state.introComplete);
  // Stage Mandate-and-beyond a beat after the intro releases rather than in the exact same
  // commit -- see the matching comment in ExperienceCanvas.tsx. Mounting 8 scenes' worth of
  // GSAP/ScrollTrigger setup in the same tick as the release crossfade starts moves the
  // stall from the countdown into the crossfade instead of removing it.
  //
  // A per-scene staggered version of this (one scene mounted per idle tick via a shared
  // `deferredMountStep` counter) was tried and reverted: it did not reduce the total
  // blocking cost -- profiling showed the same ~280ms+580ms pair landing back-to-back
  // regardless of scheduling strategy (double rAF, setTimeout, requestIdleCallback), because
  // that cost is Mandate's WebGL stage's first-ever paint (cold Three.js/R3F JIT + shader
  // compile + texture upload), not a scheduling artifact -- and it introduced a real
  // regression: tests and deep links that need a late scene (Concurrency, Causal Replay)
  // immediately could hit it before its staggered turn arrived, especially under load.
  const [heavyScenesReady, setHeavyScenesReady] = useState(false);
  useEffect(() => {
    if (!introComplete) return;
    if (typeof window.requestIdleCallback !== "function") {
      const timeout = window.setTimeout(() => setHeavyScenesReady(true), 80);
      return () => window.clearTimeout(timeout);
    }
    const handle = window.requestIdleCallback(() => setHeavyScenesReady(true), { timeout: 1500 });
    return () => window.cancelIdleCallback(handle);
  }, [introComplete]);

  return (
    <main className={styles.experience}>
      <FilmIntro onLock={lockForIntro} onRelease={releaseFromIntro} />
      <GlobalNavbar onNavigate={navigateScene} onMenuOpenChange={handleMenuOpenChange} />
      {introComplete && <ExperienceCanvas />}
      {/* Invisible scroll track to provide scroll height without rendering visuals */}
      <div className={styles.scrollTrack} aria-hidden="true">
        <div ref={prologueTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.prologue.trackVh}vh` }} data-track="prologue" />
        <div ref={mandateTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.mandate.trackVh}vh` }} data-track="mandate" />
        <div ref={decisionsTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.decisions.trackVh}vh` }} data-track="decisions" />
        <div ref={delegationTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.delegation.trackVh}vh` }} data-track="delegation" />
        <div ref={stepUpTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.stepUp.trackVh}vh` }} data-track="step-up" />
        <div ref={revocationTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.revocation.trackVh}vh` }} data-track="revocation" />
        <div ref={splitDefenseTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.splitDefense.trackVh}vh` }} data-track="split-defense" />
        <div ref={concurrencyTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.concurrency.trackVh}vh` }} data-track="concurrency" />
        <div ref={causalReplayTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.causalReplay.trackVh}vh` }} data-track="causal-replay" />
      </div>

      {/* Persistent Fixed Cinematic Stage: inset: 0 defines the actual fixed viewport plane */}
      <div className={styles.cinematicStage} data-cinematic-stage>
        <OpeningScene trackRef={prologueTrackRef} />
        {/* KP-MOTION-001: FilmIntro locks scroll (inert stage) until it releases, so
            nothing past Opening is reachable or visible during the countdown. Mounting
            every downstream scene's GSAP/ScrollTrigger setup eagerly at initial hydration
            competed with FilmIntro on the same ticker for main-thread time. Deferring
            mount until the intro actually releases costs nothing perceptually (scroll
            unlocks in the same store update that flips this flag) and removes that
            competing work from the countdown's critical path. */}
        {heavyScenesReady && (
          <>
            <MandateScene trackRef={mandateTrackRef} />
            <DecisionsScene trackRef={decisionsTrackRef} />
            <DelegationScene trackRef={delegationTrackRef} />
            <StepUpScene trackRef={stepUpTrackRef} />
            <RevocationScene trackRef={revocationTrackRef} />
            <SplitDefenseScene trackRef={splitDefenseTrackRef} />
            <ConcurrencyScene trackRef={concurrencyTrackRef} />
            <CausalReplayScene trackRef={causalReplayTrackRef} />
          </>
        )}
      </div>
      <DebugStageHUD />
      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
