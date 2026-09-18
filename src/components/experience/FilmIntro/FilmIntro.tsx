"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "@/lib/motion/gsap";
import { useExperienceStore } from "@/lib/experience/store";
import { FilmLeader } from "./FilmLeader";
import { DirectorSlate } from "./DirectorSlate";
import styles from "./FilmIntro.module.css";

const SESSION_KEY = "kp:intro-seen:v1";

type ResolvedMode = "skip" | "reduced" | "full";

type FilmIntroProps = {
  /** Suppresses scroll/menu/stage interaction while the pre-film sequence owns the viewport. */
  onLock: () => void;
  /** Restores normal scroll/interaction. Called ~150-300ms before the overlay finishes fading. */
  onRelease: () => void;
};

function readSessionSeen(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSessionSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable (private mode / blocked) — replay next load, harmless.
  }
}

/** Decided once per mount from URL/hash/sessionStorage/matchMedia — none of which exist during SSR. */
function decideMode(): ResolvedMode {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("intro");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (forced === "0") return "skip";
  if (forced === "1") return reducedMotion ? "reduced" : "full";

  const hasDeepLink = window.location.hash !== "" && window.location.hash !== "#scene-00";
  if (hasDeepLink) return "skip";
  if (params.has("visualTest")) return "skip";
  if (readSessionSeen()) return "skip";

  return reducedMotion ? "reduced" : "full";
}

const noopSubscribe = () => () => {};
const getServerMode = (): ResolvedMode | "pending" => "pending";

export function FilmIntro({ onLock, onRelease }: FilmIntroProps) {
  const setIntroComplete = useExperienceStore((state) => state.setIntroComplete);
  // SSR-safe: server/first-paint snapshot is "pending"; React swaps in the real,
  // client-only decision (URL/hash/sessionStorage/matchMedia) before the browser paints,
  // the same technique KavachExperience already uses for isLegacy/migrationStep.
  const resolvedMode = useSyncExternalStore(noopSubscribe, decideMode, getServerMode);
  const [done, setDone] = useState(false);
  const [reducedShow, setReducedShow] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const slateRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const releasedRef = useRef(false);
  const finishedRef = useRef(false);

  const release = useCallback(() => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    onRelease();
    setIntroComplete(true);
  }, [onRelease, setIntroComplete]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    release();
    markSessionSeen();
    setDone(true);
  }, [release]);

  // Skip decision is a derived read of the resolved mode, not local state — sync it
  // to the external experience store rather than mirroring it into component state.
  useEffect(() => {
    if (resolvedMode !== "skip") return;
    releasedRef.current = true;
    finishedRef.current = true;
    setIntroComplete(true);
  }, [resolvedMode, setIntroComplete]);

  // Reduced-motion branch: restrained static card, fixed short hold, no motion.
  useEffect(() => {
    if (resolvedMode !== "reduced" || done) return;
    onLock();
    const raf = requestAnimationFrame(() => setReducedShow(true));
    const timer = window.setTimeout(finish, 600);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.clearTimeout(timer);
      finish();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [resolvedMode, done, onLock, finish]);

  // Full cinematic branch: one authored GSAP timeline, played once, never scrubbed.
  useEffect(() => {
    if (resolvedMode !== "full" || done) return;
    onLock();

    const root = rootRef.current;
    const leader = leaderRef.current;
    const black = blackRef.current;
    const slate = slateRef.current;
    const flash = flashRef.current;
    const rule = ruleRef.current;
    if (!root || !leader || !black || !slate || !flash || !rule) return;

    const numeral = leader.querySelector<HTMLElement>("[data-numeral]");
    const wedge = leader.querySelector<HTMLElement>("[data-wedge]");
    const splice = leader.querySelector<HTMLElement>("[data-splice]");
    const frameAdvance = leader.querySelector<HTMLElement>("[data-frame-advance]");
    const clapper = slate.querySelector<HTMLElement>("[data-clapper]");
    const board = slate.querySelector<HTMLElement>("[data-board]");
    const strokes = slate.querySelectorAll<SVGPathElement>("[data-action-stroke]");
    const underline = slate.querySelector<SVGPathElement>("[data-action-underline]");
    const period = slate.querySelector<SVGElement>("[data-action-period]");
    if (!numeral || !wedge || !splice || !frameAdvance || !clapper || !board || !underline || !period) return;

    const ctx = gsap.context(() => {
      gsap.set(root, { opacity: 1, pointerEvents: "auto" });
      gsap.set([black, slate, flash], { opacity: 0 });
      gsap.set(slate, { xPercent: 8, yPercent: 22, rotate: -6, scale: 0.93, transformOrigin: "50% 50%" });
      gsap.set(clapper, { rotateX: -34 });
      gsap.set(board, { y: 0 });
      // Raw attr:, not the CSS property — pathLength=1 normalization requires unitless
      // values, and GSAP's CSS tweening would otherwise write "1px" / "0px". opacity:0
      // alongside the dash math — an exactly-balanced 1-unit dash/gap can still
      // rasterize a stray hairline at the boundary in Chromium.
      gsap.set(strokes, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 }, opacity: 0 });
      gsap.set(underline, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 }, opacity: 0 });
      // opacity, not just scale:0 — a zero-area filled circle can still rasterize
      // a stray hairline dot in Chromium.
      gsap.set(period, { scale: 0, opacity: 0, transformOrigin: "50% 50%" });
      gsap.set(rule, { scaleX: 0 });
      gsap.set(numeral, { opacity: 0 });
      numeral.textContent = "3";

      const tl = gsap.timeline({ defaults: { ease: "power1.out" }, onComplete: finish });
      timelineRef.current = tl;

      // 0.00 - 0.30 projector wake
      tl.fromTo(leader, { opacity: 0.7 }, { opacity: 1, duration: 0.12, ease: "none" }, 0)
        .to(leader, { opacity: 0.86, duration: 0.06, ease: "none" }, 0.14)
        .to(leader, { opacity: 1, duration: 0.1, ease: "none" }, 0.2)
        .to(wedge, { rotation: 640, duration: 1.78, ease: "none" }, 0.3);

      // 0.30 - 0.92 "3"
      tl.to(numeral, { opacity: 1, duration: 0.05, ease: "none" }, 0.32);

      // frame advance 3 -> 2 (~0.90)
      tl.to(frameAdvance, { opacity: 0.85, duration: 0.04, ease: "none" }, 0.9)
        .to(leader, { y: -6, duration: 0.03, ease: "none" }, 0.9)
        .call(() => { numeral.textContent = "2"; }, [], 0.92)
        .set(numeral, { opacity: 0 }, 0.92)
        .to(frameAdvance, { opacity: 0, duration: 0.05, ease: "none" }, 0.93)
        .to(leader, { y: 0, duration: 0.04, ease: "none" }, 0.94)
        .to(numeral, { opacity: 1, duration: 0.05, ease: "none" }, 0.94);

      // frame advance 2 -> 1 (~1.50)
      tl.to(frameAdvance, { opacity: 0.85, duration: 0.04, ease: "none" }, 1.5)
        .to(leader, { y: -6, duration: 0.03, ease: "none" }, 1.5)
        .call(() => { numeral.textContent = "1"; }, [], 1.52)
        .set(numeral, { opacity: 0 }, 1.52)
        .to(frameAdvance, { opacity: 0, duration: 0.05, ease: "none" }, 1.53)
        .to(leader, { y: 0, duration: 0.04, ease: "none" }, 1.54)
        .to(numeral, { opacity: 1, duration: 0.05, ease: "none" }, 1.54);

      // splice flick before hard cut
      tl.to(splice, { opacity: 0.9, duration: 0.03, ease: "none" }, 2.04)
        .to(splice, { opacity: 0, duration: 0.04, ease: "none" }, 2.07);

      // 2.08 - 2.28 hard cut to black
      tl.to(leader, { opacity: 0, duration: 0.08, ease: "none" }, 2.08)
        .to(black, { opacity: 1, duration: 0.06, ease: "none" }, 2.08);

      // 2.28 - 3.15 slate enters and settles
      tl.to(
        slate,
        { opacity: 1, xPercent: 4, yPercent: 10, rotate: -3, scale: 1, duration: 0.62, ease: "power2.out" },
        2.28,
      )
        .to(slate, { xPercent: 4.6, yPercent: 10.6, rotate: -3.4, duration: 0.09, ease: "power1.inOut" }, 2.9)
        .to(slate, { xPercent: 4, yPercent: 10, rotate: -3, duration: 0.16, ease: "power1.out" }, 2.99);

      // clap: anticipation then fast impact
      tl.to(clapper, { rotateX: -40, duration: 0.05, ease: "none" }, 3.02)
        .to(clapper, { rotateX: 0, duration: 0.09, ease: "power2.in" }, 3.07)
        .to(flash, { opacity: 0.85, duration: 0.05, ease: "none" }, 3.15)
        .to(board, { y: 2, duration: 0.04, ease: "none" }, 3.15)
        .to(clapper, { rotateX: 1.5, duration: 0.05, ease: "none" }, 3.16)
        .to(flash, { opacity: 0, duration: 0.09, ease: "none" }, 3.2)
        .to(board, { y: 0, duration: 0.07, ease: "power1.out" }, 3.19)
        .to(clapper, { rotateX: 0, duration: 0.06, ease: "power1.out" }, 3.21);

      // 3.15 - 3.65 ACTION. writes
      const strokeStart = 3.18;
      strokes.forEach((path, index) => {
        const at = strokeStart + index * 0.055;
        tl.set(path, { opacity: 1 }, at).to(
          path,
          { attr: { "stroke-dashoffset": 0 }, duration: 0.13, ease: "power1.inOut" },
          at,
        );
      });
      tl.to(
        period,
        { scale: 1, opacity: 1, duration: 0.08, ease: "power1.out" },
        strokeStart + strokes.length * 0.055 + 0.02,
      );
      tl.set(underline, { opacity: 1 }, 3.52).to(
        underline,
        { attr: { "stroke-dashoffset": 0 }, duration: 0.12, ease: "power1.inOut" },
        3.52,
      );

      // 3.65 - 4.15 the underline becomes a registration rule; frame opens onto Scene 00
      tl.addLabel("release", 3.65)
        .call(release, [], "release")
        .to(rule, { scaleX: 1, duration: 0.16, ease: "power1.inOut" }, "release")
        .set(root, { pointerEvents: "none" }, "release")
        // Release exposure: a brief restrained optical bloom (the clap flash above stays the
        // one full-strength exposure), easing into the live Scene 00 rather than flashing white.
        .to(flash, { opacity: 0.36, duration: 0.06, ease: "power1.out" }, "release+=0.14")
        .to(flash, { opacity: 0, duration: 0.2, ease: "power1.in" }, "release+=0.2")
        .to(root, { opacity: 0, duration: 0.3, ease: "power1.in" }, "release+=0.2");
    }, root);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      timelineRef.current?.progress(1);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      timelineRef.current?.kill();
      timelineRef.current = null;
      ctx.revert();
    };
  }, [resolvedMode, done, onLock, release, finish]);

  if (done || resolvedMode === "skip" || resolvedMode === "pending") return null;

  if (resolvedMode === "reduced") {
    return (
      <div className={styles.root} aria-hidden="true">
        <div className={styles.reducedCard} data-show={reducedShow || undefined}>
          <p className={styles.reducedEyebrow}>KAVACH PICTURES</p>
          <p className={styles.reducedPresents}>PRESENTS</p>
          <p className={styles.reducedTitle}>KAVACHPAY</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true" data-film-intro>
      <FilmLeader containerRef={leaderRef} />
      <div ref={blackRef} className={styles.blackFrame} />
      <DirectorSlate containerRef={slateRef} />
      <div ref={ruleRef} className={styles.registrationRule} />
      <div ref={flashRef} className={styles.flash} />
    </div>
  );
}
