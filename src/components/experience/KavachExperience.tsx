"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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
import { CinematicTransitionLayer } from "./CinematicTransitionLayer";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { transportBridge } from "@/lib/experience/transition-transport-bridge";
import { WheelTransport, type WHEEL_TRANSPORT_PARAMS } from "@/lib/experience/wheel-transport";
import {
  SCENE_BY_KEY,
  SCENE_REGISTRY,
  sceneFromHash,
  type RegisteredSceneKey,
} from "@/lib/experience/scene-registry";
import { TRANSITION_REGISTRY } from "@/lib/experience/transition-registry";
import { enforceSemanticOwner, observeSemanticOwner, resolveOwnerKey } from "@/lib/experience/scene-ownership";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import styles from "./KavachExperience.module.css";

const ExperienceCanvas = dynamic(
  () => import("@/components/webgl/ExperienceCanvas").then((module) => module.ExperienceCanvas),
  { ssr: false },
);


declare global {
  interface Window {
    ScrollTrigger?: typeof ScrollTrigger;
    gsap?: typeof gsap;
    __kpWheel?: {
      snapshot: () => ReturnType<WheelTransport["snapshot"]>;
      params: () => typeof WHEEL_TRANSPORT_PARAMS;
      setParams: (patch: Partial<typeof WHEEL_TRANSPORT_PARAMS>) => void;
    };
  }
}

export function KavachExperience() {
  const lenisRef = useRef<Lenis | null>(null);
  const menuScrollYRef = useRef(0);
  const previousOverflowRef = useRef({ html: "", body: "" });
  const introOverflowRef = useRef({ html: "", body: "" });
  const introLockedRef = useRef(false);

  const navigateScene = useCallback((key: RegisteredSceneKey) => {
    const scene = SCENE_BY_KEY[key];
    const track = document.querySelector<HTMLElement>(`[data-track='${scene.slug}']`);
    if (!track) return;

    const target = Math.max(
      0,
      window.scrollY + track.getBoundingClientRect().top + track.offsetHeight * scene.safeProgress,
    );
    window.history.replaceState(window.history.state, "", `#scene-${scene.number}`);

    const visualTest = new URLSearchParams(window.location.search).has("visualTest");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (lenisRef.current && !visualTest && !reducedMotion) {
      // A navigation jump is not wheel intent: it passes through the film transport untouched
      // (the first wheel/touch input after it, or its completion, hands control back).
      transportBridge.setProgrammatic(true);
      lenisRef.current.scrollTo(target, {
        duration: 0.72,
        force: true,
        onComplete: () => {
          transportBridge.setProgrammatic(false);
          ScrollTrigger.update();
        },
      });
    } else {
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      ScrollTrigger.update();
    }
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
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visualTest = new URLSearchParams(window.location.search).has("visualTest");
    experienceStore.getState().setReducedMotion(motionQuery.matches);

    // ONE global semantic owner (see lib/experience/scene-ownership.ts). Scenes may be
    // visually present together during a film blend, but aria/inert/pointer-events, the
    // navbar chapter and reduced-motion visibility all follow this single value.
    let ownerKey: RegisteredSceneKey | null = null;
    const stopObservingOwner = observeSemanticOwner(() => ({
      slug: ownerKey ? SCENE_BY_KEY[ownerKey].slug : "",
      reducedMotion: motionQuery.matches,
    }));

    const setActiveScene = (id: RegisteredSceneKey) => {
      ownerKey = id;
      experienceStore.getState().setScene(id);
      progressBus.setActiveScene(id);
      enforceSemanticOwner(SCENE_BY_KEY[id].slug, motionQuery.matches);
      const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
      if (stage) stage.dataset.activeScene = id;
    };

    /** The single writer: derive the owner from scroll, only touch state when it changes. */
    const reconcileOwner = (force = false) => {
      const next = resolveOwnerKey(motionQuery.matches);
      if (force || next !== ownerKey) setActiveScene(next);
    };

    let tick: ((time: number) => void) | null = null;
    const ownershipTriggers: ScrollTrigger[] = [];

    const stopSmoothScroll = () => {
      transportBridge.setEnabled(false);
      transportBridge.setProgrammatic(false);
      if (tick) gsap.ticker.remove(tick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
      tick = null;
      delete window.__kpWheel;
      gsap.ticker.lagSmoothing(500, 33);
    };

    const startSmoothScroll = () => {
      if (visualTest || motionQuery.matches || lenisRef.current) return;
      const wheel = new WheelTransport();
      const mobileQuery = window.matchMedia("(max-width: 48rem)");
      const originalWheel = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("wheelTransport") === "off";
      let wheelActive = false;
      let lastWheelTick: number | null = null;
      const wheelEnabled = () => !originalWheel && !mobileQuery.matches && transportBridge.enabled;
      const lenis = new Lenis({
        autoRaf: false,
        duration: 0.72,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.94,
        virtualScroll: ({ deltaY, event }) => {
          const instance = lenisRef.current;
          if (!instance || !wheelEnabled() || !event.type.includes("wheel") || event.ctrlKey ||
            event.defaultPrevented || !event.cancelable || !deltaY || instance.isStopped || instance.isLocked) return true;
          if (event.composedPath().some((node) => node instanceof HTMLElement &&
            (node.hasAttribute("data-lenis-prevent") || node.hasAttribute("data-lenis-prevent-wheel") ||
              node.hasAttribute("data-lenis-prevent-vertical")))) return true;
          event.preventDefault();
          if (!wheelActive || transportBridge.programmatic) {
            // Cancel an existing navigation tween before wheel input takes ownership.
            instance.scrollTo(instance.actualScroll, { immediate: true });
            wheel.reset(instance.actualScroll, instance.limit);
          }
          transportBridge.setProgrammatic(false);
          wheelActive = true;
          wheel.input(deltaY, instance.actualScroll, instance.limit, performance.now());
          return false; // Replace Lenis' wheel interpolation, not a second inertia layer.
        },
      });
      lenisRef.current = lenis;
      const activeLenis = lenis;
      // FilmIntro's lock effect (a child) can run before this parent effect creates Lenis;
      // converge on the correct state regardless of which fired first.
      if (introLockedRef.current) activeLenis.stop();
      // ONE chain per frame: Lenis' canonical scroll -> ScrollTrigger (raw target) -> film transport.
      tick = (time: number) => {
        activeLenis.raf(time * 1000);
        const dt = lastWheelTick === null ? 0 : time - lastWheelTick;
        lastWheelTick = time;
        if (!wheelEnabled() || activeLenis.isStopped || activeLenis.isLocked || transportBridge.programmatic ||
          wheelActive && Math.abs(activeLenis.actualScroll - wheel.presented) > 2) {
          wheelActive = false;
          wheel.reset(activeLenis.actualScroll, activeLenis.limit);
        }
        if (wheelActive) {
          const next = wheel.step(dt);
          const limited = transportBridge.governScroll(next);
          if (Math.abs(limited - next) > 0.01) wheel.reset(limited, activeLenis.limit);
          activeLenis.scrollTo(limited, { immediate: true });
          if (wheel.settled) wheelActive = false;
        }
        transportBridge.step(time);
      };
      if (process.env.NODE_ENV !== "production") {
        window.__kpWheel = {
          snapshot: () => wheel.snapshot(),
          params: () => ({ ...wheel.params }),
          setParams: (patch) => {
            Object.assign(wheel.params, patch);
            wheel.reset(activeLenis.actualScroll, activeLenis.limit);
          },
        };
      }
      activeLenis.on("scroll", (instance) => {
        // Wheel-driven smooth scroll only: bound the pending intent and hold the page at the
        // handoff gates until the film is home. Programmatic navigation and native (keyboard,
        // scrollbar, touch) scrolling pass through and are absorbed by the transport instead.
        if (instance.isScrolling === "smooth" && !transportBridge.programmatic) {
          const y = instance.scroll;
          const limited = transportBridge.governScroll(y);
          if (limited !== y) {
            if (instance.targetScroll === limited) instance.targetScroll = y;
            instance.scrollTo(limited, { immediate: true, force: true }); // emits again -> ScrollTrigger.update below
            return;
          }
        }
        ScrollTrigger.update();
      });
      activeLenis.on("virtual-scroll", () => transportBridge.setProgrammatic(false));
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      // Dev/test A/B only: `?transport=off` keeps the previous raw scroll -> frame mapping.
      if (!(process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("transport") === "off")) {
        transportBridge.setEnabled(true);
      }
    };

    const handleMotionPreference = () => {
      experienceStore.getState().setReducedMotion(motionQuery.matches);
      if (motionQuery.matches) stopSmoothScroll();
      else startSmoothScroll();
      ScrollTrigger.refresh();
      reconcileOwner(true);
    };

    motionQuery.addEventListener("change", handleMotionPreference);
    startSmoothScroll();

    // One trigger for the whole page drives the owner (no per-scene owner triggers).
    ownershipTriggers.push(
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: () => reconcileOwner(),
        onRefresh: () => reconcileOwner(),
      }),
    );

    const refresh = () => {
      ScrollTrigger.refresh();
      reconcileOwner(true);
    };
    const restoreHashScene = () => {
      const scene = sceneFromHash(window.location.hash);
      if (!scene) {
        reconcileOwner(true);
        return;
      }
      const track = document.querySelector<HTMLElement>(`[data-track='${scene.slug}']`);
      if (!track) return;
      const target = track.offsetTop + track.offsetHeight * scene.safeProgress;
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      ScrollTrigger.update();
      setActiveScene(scene.key);
    };

    // A viewport resize can cross the mobile breakpoint that collapses/expands
    // the cinematic-transition scroll spacers, changing total document height
    // under an unchanged scrollY. If that strands the user inside a spacer
    // (no scene track contains the new viewport center), snap forward to the
    // nearest scene rather than leaving the stage with zero owners.
    let resizeTimer: number | undefined;
    const recoverFromResize = () => {
      ScrollTrigger.refresh();
      const center = window.scrollY + window.innerHeight * 0.5;
      const inGap = !SCENE_REGISTRY.some((candidate) => {
        const track = document.querySelector<HTMLElement>(`[data-track='${candidate.slug}']`);
        return track && center >= track.offsetTop && center < track.offsetTop + track.offsetHeight;
      });
      if (inGap) {
        const target =
          SCENE_REGISTRY.find((candidate) => {
            const track = document.querySelector<HTMLElement>(`[data-track='${candidate.slug}']`);
            return track && track.offsetTop > center;
          }) ?? SCENE_REGISTRY[SCENE_REGISTRY.length - 1];
        const track = document.querySelector<HTMLElement>(`[data-track='${target.slug}']`);
        if (track) {
          window.scrollTo({
            top: track.offsetTop + track.offsetHeight * target.safeProgress,
            left: 0,
            behavior: "auto",
          });
          ScrollTrigger.update();
        }
      }
      reconcileOwner();
    };
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(recoverFromResize, 120);
    };
    window.addEventListener("resize", handleResize);

    document.fonts.ready.then(() => {
      refresh();
      restoreHashScene();
    });
    window.addEventListener("load", refresh, { once: true });
    const onPageShow = () => reconcileOwner(true);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("hashchange", restoreHashScene);
    requestAnimationFrame(() => reconcileOwner(true));

    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("load", refresh);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("hashchange", restoreHashScene);
      motionQuery.removeEventListener("change", handleMotionPreference);
      ownershipTriggers.forEach((trigger) => trigger.kill());
      stopObservingOwner();
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

  const isLegacy = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("stage") === "legacy",
    () => false,
  );
  const migrationStep = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("migration"),
    () => null,
  );

  return (
    <main className={styles.experience}>
      <FilmIntro onLock={lockForIntro} onRelease={releaseFromIntro} />
      <GlobalNavbar onNavigate={navigateScene} onMenuOpenChange={handleMenuOpenChange} />
      <ExperienceCanvas />
      {isLegacy ? (
        <div className={styles.editorialLayerLegacy}>
          <OpeningScene />
          <MandateScene />
          <DecisionsScene />
          <DelegationScene />
          <StepUpScene />
          <RevocationScene />
          <SplitDefenseScene />
          <ConcurrencyScene />
          <CausalReplayScene />
        </div>
      ) : (
        <>
          {/* Invisible scroll track to provide scroll height without rendering visuals */}
          <div className={styles.scrollTrack} aria-hidden="true">
            <div ref={prologueTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.prologue.trackVh}vh` }} data-track="prologue" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[0].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[0].id} />
            <div ref={mandateTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.mandate.trackVh}vh` }} data-track="mandate" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[1].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[1].id} />
            <div ref={decisionsTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.decisions.trackVh}vh` }} data-track="decisions" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[2].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[2].id} />
            <div ref={delegationTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.delegation.trackVh}vh` }} data-track="delegation" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[3].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[3].id} />
            <div ref={stepUpTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.stepUp.trackVh}vh` }} data-track="step-up" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[4].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[4].id} />
            <div ref={revocationTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.revocation.trackVh}vh` }} data-track="revocation" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[5].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[5].id} />
            <div ref={splitDefenseTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.splitDefense.trackVh}vh` }} data-track="split-defense" />
            <div className={styles.transitionTrack} style={{ height: `${TRANSITION_REGISTRY[6].trackVh}vh` }} data-transition-track={TRANSITION_REGISTRY[6].id} />
            <div ref={concurrencyTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.concurrency.trackVh}vh` }} data-track="concurrency" />
            {/* No transition track here: 07 -> 08 is intentionally cut-only. */}
            <div ref={causalReplayTrackRef} className={styles.trackSegment} style={{ height: `${SCENE_BY_KEY.causalReplay.trackVh}vh` }} data-track="causal-replay" />
          </div>

          {/* Persistent Fixed Cinematic Stage: inset: 0 defines the actual fixed viewport plane */}
          <div className={styles.cinematicStage} data-cinematic-stage>
            <OpeningScene trackRef={prologueTrackRef} />
            <MandateScene trackRef={mandateTrackRef} />
            {migrationStep !== "A" && (
              <>
                <DecisionsScene trackRef={decisionsTrackRef} />
                {migrationStep !== "B" && (
                  <>
                    <DelegationScene trackRef={delegationTrackRef} />
                    {migrationStep !== "C" && (
                      <>
                        <StepUpScene trackRef={stepUpTrackRef} />
                        <RevocationScene trackRef={revocationTrackRef} />
                        <SplitDefenseScene trackRef={splitDefenseTrackRef} />
                        <ConcurrencyScene trackRef={concurrencyTrackRef} />
                        <CausalReplayScene trackRef={causalReplayTrackRef} />
                      </>
                    )}
                  </>
                )}
              </>
            )}
            <CinematicTransitionLayer />
          </div>
          <DebugStageHUD />
        </>
      )}
      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
