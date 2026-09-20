"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { progressBus } from "@/lib/experience/progress-bus";
import styles from "./OpeningScene.module.css";

type OpeningSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

// Scene 00 is the first fully exposed frame of the film. FilmIntro releases onto
// it already exposed (its own flash + fade is the exposure), so the hero is at
// rest from the first frame. The only scroll-derived motion is the thesis
// statement resolving into the frame the 00->01 film begins on: the aperture
// bar, the registration rule and its mark. The wordmark, red residue stroke,
// film strip, crop marks and notations never move, fade or scale.
const APERTURE_REST = 0.72; // opacity of the aperture bar in the 00->01 film's first frame

export function OpeningScene({ trackRef }: OpeningSceneProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!root.current) return;
      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='prologue']" : root.current);
      const motion = gsap.matchMedia();

      // Reduced motion: the complete static hero, terminal state, no ambient weave (CSS).
      motion.add("(prefers-reduced-motion: reduce)", () => {
        if (root.current) {
          root.current.style.visibility = "visible";
          root.current.style.pointerEvents = "auto";
          root.current.setAttribute("aria-hidden", "false");
        }
        gsap.set("[data-opening-window]", { opacity: APERTURE_REST });
        gsap.set("[data-opening-rule]", { scaleX: 1 });
        gsap.set("[data-opening-reg]", { opacity: 1 });
      });

      motion.add("(prefers-reduced-motion: no-preference)", () => {
        const applyVisibility = (visible: boolean) => {
          if (!root.current) return;
          root.current.style.visibility = visible ? "visible" : "hidden";
          root.current.style.pointerEvents = visible ? "auto" : "none";
          root.current.setAttribute("aria-hidden", visible ? "false" : "true");
        };

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: triggerEl,
            start: "top top",
            end: isPersistent ? "bottom top" : "+=100%",
            pin: !isPersistent,
            scrub: true,
            invalidateOnRefresh: true,
            onEnter: () => {
              applyVisibility(true);
              window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "prologue" } }));
            },
            onEnterBack: () => {
              applyVisibility(true);
              window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "prologue" } }));
            },
            onLeave: () => {
              if (isPersistent) applyVisibility(false);
            },
            onUpdate: (self) => {
              progressBus.set("prologue", self.progress);
              updateVisibility();
            },
          },
        });

        // Body stays up to 50px past its track end (it sits under the 00->01 film).
        const updateVisibility = () => {
          if (!root.current || !isPersistent) return;
          const st = timeline.scrollTrigger;
          if (!st) return;
          applyVisibility(st.end > 0 ? window.scrollY <= st.end + 50 : true);
        };
        updateVisibility();
        ScrollTrigger.addEventListener("refresh", updateVisibility);

        // Initial state: the hero is exposed and complete; only the thesis
        // statement (bar, rule, mark) is still to resolve.
        gsap.set("[data-opening-window]", { opacity: 0 });
        gsap.set("[data-opening-rule]", { scaleX: 0 });
        gsap.set("[data-opening-reg]", { opacity: 0 });

        // A hold 0.00-0.15 | B the thesis bar exposes 0.15-0.35 | C the registration
        // rule draws and its mark locks 0.40-0.58 | D terminal hold 0.58-1.00.
        timeline
          .to("[data-opening-window]", { opacity: APERTURE_REST, duration: 0.2, ease: "power1.inOut" }, 0.15)
          .to("[data-opening-rule]", { scaleX: 1, duration: 0.18, ease: "power2.out" }, 0.4)
          .to("[data-opening-reg]", { opacity: 1, duration: 0.1 }, 0.48);

        // Mobile has no 00->01 film (the transition layer and its scroll spacer are
        // bypassed at <=48rem), so Opening hands straight to Mandate. Policy: a short,
        // scroll-derived dip of the frame to black at the very end of the track; Mandate
        // then arrives from black. No paper wipe, no preview, fully reversible.
        if (window.matchMedia("(max-width: 48rem)").matches) {
          timeline.to("[data-opening-frame]", { opacity: 0, duration: 0.06, ease: "power1.in" }, 0.94);
        }
        timeline.set({}, {}, 1);

        return () => {
          ScrollTrigger.removeEventListener("refresh", updateVisibility);
          timeline.scrollTrigger?.kill();
          timeline.kill();
        };
      });

      return () => motion.revert();
    },
    { scope: root, dependencies: [trackRef] },
  );

  return (
    <section ref={root} className={styles.section} data-scene="prologue" aria-labelledby="opening-title">
      <div className={styles.frame} data-opening-frame>
        <div className={styles.stock} aria-hidden="true" />

        {/* Volumetric optical light projection exposure */}
        <div className={styles.opticalLight} data-opening-decor data-opening-light aria-hidden="true" />

        {/* Left-side physical film strip edge */}
        <aside className={styles.filmStrip} data-opening-decor data-film-strip aria-hidden="true">
          <div className={styles.sprocketTrack}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className={styles.sprocketHole} style={{ opacity: 0.9 + (i % 3) * 0.04 }} />
            ))}
          </div>
          <div className={styles.filmEdgeMeta}>
            <span className={styles.filmCode}>KP<br />001</span>
            <span className={styles.filmCue}>PICTURE<br />STARTS<br />HERE<br />↓</span>
          </div>
        </aside>

        {/* Perimeter registration frame & crop marks */}
        <div className={styles.registrationFrame} data-opening-decor aria-hidden="true">
          <div className={`${styles.cropMark} ${styles.cropTL}`} />
          <div className={`${styles.cropMark} ${styles.cropTR}`} />
          <div className={`${styles.cropMark} ${styles.cropBL}`} />
          <div className={`${styles.cropMark} ${styles.cropBR}`} />
          <div className={`${styles.datumCross} ${styles.datumTop}`} />
          <div className={`${styles.datumCross} ${styles.datumBottom}`} />
        </div>

        {/* Top-left production notation */}
        <div className={styles.metaTopLeft} data-opening-decor aria-hidden="true">
          <p className={styles.metaHeader}>PICTURE 01 &nbsp;/&nbsp; AUTHORITY</p>
          <p className={styles.metaSub}>BOUND CONTRACT<br />{"// SEC-00"}</p>
        </div>

        {/* Top-right production notation */}
        <div className={styles.metaTopRight} data-opening-decor aria-hidden="true">
          <p className={styles.metaHeader}>TAKE 01</p>
          <p className={styles.metaSub}>ROLL KP-01</p>
        </div>

        {/* Thesis bar: exposes into the frame the 00->01 film begins on */}
        <div className={styles.aperture} data-opening-window>
          <span>AUTHORITY IS NOT ACCESS.</span>
          <span>IT IS A BOUND CONTRACT.</span>
        </div>

        {/* Monumental hero core: wordmark & red ACTION residue */}
        <div className={styles.heroCore}>
          <h1 id="opening-title" className={styles.wordmark} data-opening-word data-hero-title>
            KavachPay
          </h1>
          <div className={styles.actionStrokeWrap} data-opening-stroke data-action-residue aria-hidden="true">
            <svg className={styles.actionSvg} viewBox="0 0 1000 120" preserveAspectRatio="none">
              {/* Offset pressure/undertone path */}
              <path
                className={styles.actionStrokeUnder}
                d="M 18 58 C 118 61, 238 64, 358 64 C 418 65, 446 74, 466 80 C 476 83, 462 67, 455 64 C 478 62, 532 60, 598 58 C 702 54, 802 48, 903 42 C 942 39, 970 36, 988 34"
              />
              {/* Primary grease-pencil stroke */}
              <path
                className={styles.actionStrokeMain}
                d="M 20 54 C 120 57, 240 60, 360 61 C 415 62, 442 70, 468 78 C 478 81, 464 64, 452 61 C 475 59, 530 57, 595 55 C 700 51, 800 45, 905 39 C 945 36, 975 33, 990 31"
              />
            </svg>
          </div>
        </div>

        {/* Right-side editorial thesis stack */}
        <div className={styles.thesisStack} data-opening-decor>
          <div className={styles.thesisControl}>
            <span>CONTROL</span>
            <span>TRAVELS</span>
            <span>FURTHER</span>
          </div>
          <div className={styles.badgeBox} aria-hidden="true">
            <span>KP</span>
            <span>01</span>
          </div>
          <div className={styles.thesisMoney} data-opening-meta>
            <span>SAME MONEY.</span>
            <span>A SAFER TOMORROW.</span>
            <div className={styles.thesisRule} aria-hidden="true" />
          </div>
        </div>

        {/* Registration rule and mark */}
        <div className={styles.registrationMark} data-opening-reg aria-hidden="true">
          <span className={styles.regCross}>+</span>
          <span>SEC-00 // REG. 48.0</span>
        </div>
        <div className={styles.rule} data-opening-rule aria-hidden="true" />

        {/* Bottom baseline datum rule & timecode */}
        <div className={styles.baselineBar} data-opening-decor aria-hidden="true">
          <span className={styles.timecode}>00 : 00 : 01 : 00</span>
          <span className={styles.baselineBranding}>KAVACHPAY // 2026</span>
        </div>
      </div>
    </section>
  );
}
