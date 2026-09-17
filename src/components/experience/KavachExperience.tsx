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
import { experienceStore } from "@/lib/experience/store";
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
      lenisRef.current.scrollTo(target, {
        duration: 0.72,
        force: true,
        onComplete: () => ScrollTrigger.update(),
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
    const ownershipTriggers: ScrollTrigger[] = [];

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

    SCENE_REGISTRY.forEach((scene) => {
      ownershipTriggers.push(
        ScrollTrigger.create({
          trigger: `[data-track='${scene.slug}']`,
          start: "top center",
          end: "bottom center",
          onEnter: () => setActiveScene(scene.key),
          onEnterBack: () => setActiveScene(scene.key),
        }),
      );
    });

    const reconcileOwner = () => {
      const center = window.scrollY + window.innerHeight * 0.5;
      const scene = SCENE_REGISTRY.find((candidate) => {
        const track = document.querySelector<HTMLElement>(`[data-track='${candidate.slug}']`);
        return track && center >= track.offsetTop && center < track.offsetTop + track.offsetHeight;
      }) ?? SCENE_REGISTRY[SCENE_REGISTRY.length - 1];
      setActiveScene(scene.key);
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
      const track = document.querySelector<HTMLElement>(`[data-track='${scene.slug}']`);
      if (!track) return;
      const target = track.offsetTop + track.offsetHeight * scene.safeProgress;
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      ScrollTrigger.update();
      setActiveScene(scene.key);
    };

    document.fonts.ready.then(() => {
      refresh();
      restoreHashScene();
    });
    window.addEventListener("load", refresh, { once: true });
    window.addEventListener("pageshow", reconcileOwner);
    window.addEventListener("hashchange", restoreHashScene);
    requestAnimationFrame(reconcileOwner);

    return () => {
      window.removeEventListener("kp:scene", handleScene);
      window.removeEventListener("load", refresh);
      window.removeEventListener("pageshow", reconcileOwner);
      window.removeEventListener("hashchange", restoreHashScene);
      motionQuery.removeEventListener("change", handleMotionPreference);
      ownershipTriggers.forEach((trigger) => trigger.kill());
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
          </div>
          <DebugStageHUD />
        </>
      )}
      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
