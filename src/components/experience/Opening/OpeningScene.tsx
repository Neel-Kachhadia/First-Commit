"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { progressBus } from "@/lib/experience/progress-bus";
import { useExperienceStore } from "@/lib/experience/store";
import styles from "./OpeningScene.module.css";

type OpeningSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function OpeningScene({ trackRef }: OpeningSceneProps) {
  const root = useRef<HTMLElement>(null);
  const introComplete = useExperienceStore((state) => state.introComplete);
  const hasRevealedRef = useRef(false);

  useGSAP(
    () => {
      if (!root.current) return;
      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='prologue']" : root.current);
      const motion = gsap.matchMedia();

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
            end: isPersistent ? "bottom top" : "+=120%",
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

        const updateVisibility = () => {
          if (!root.current || !isPersistent) return;
          const st = timeline.scrollTrigger;
          if (!st) return;
          const y = window.scrollY;
          const isVisible = st.end > 0 ? y <= st.end + 50 : true;
          applyVisibility(isVisible);
        };

        updateVisibility();
        ScrollTrigger.addEventListener("refresh", updateVisibility);

        // Frozen 00 -> 01 carrier initial setups
        gsap.set("[data-opening-paper]", { clipPath: "inset(48% 0 52% 0)" });
        gsap.set("[data-opening-bridge]", { opacity: 0, y: 8 });

        // Scroll Scrub Timeline:
        // 1. Initial hero state rests at progress 0.0 - 0.20
        // 2. Hero decorations and red stroke fade before paper takeover (0.20 - 0.44)
        // 3. Wordmark transforms and clears (0.04 - 0.46)
        // 4. Frozen carrier paper takeover expands into Mandate (0.52 - 1.00)
        timeline
          .to("[data-opening-decor]", { opacity: 0, duration: 0.24, ease: "power1.out" }, 0.16)
          .to("[data-opening-stroke]", { opacity: 0, duration: 0.2, ease: "power1.out" }, 0.2)
          .to("[data-opening-word]", { yPercent: -8, scale: 0.965, duration: 0.26 }, 0.04)
          .to("[data-opening-word]", { yPercent: -16, opacity: 0, clipPath: "inset(0 0 45% 0)", duration: 0.2 }, 0.44)
          .to("[data-opening-paper]", { clipPath: "inset(0% 0 0% 0)", duration: 0.26, ease: "power1.inOut" }, 0.52)
          .to("[data-opening-bridge]", { opacity: 1, y: 0, duration: 0.18 }, 0.66)
          .to("[data-opening-meta]", { color: "#15130e", duration: 0.1 }, 0.74);

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

  // Entrance reveal: when FilmIntro releases, expose the wordmark and lock registration
  useEffect(() => {
    if (!introComplete || hasRevealedRef.current || !root.current) return;
    hasRevealedRef.current = true;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    // Optical title exposure: light catches, wordmark reveals around the red stroke, registration locks
    gsap.fromTo(
      "[data-opening-light]",
      { opacity: 0 },
      { opacity: 1, duration: 0.45, ease: "power1.out" },
    );
    gsap.fromTo(
      "[data-opening-word]",
      { opacity: 0.35, filter: "blur(2px)" },
      { opacity: 1, filter: "blur(0px)", duration: 0.38, ease: "power2.out" },
    );
    gsap.fromTo(
      "[data-opening-decor]",
      { opacity: 0 },
      { opacity: 1, duration: 0.32, ease: "power1.out", delay: 0.1 },
    );
  }, [introComplete]);

  return (
    <section ref={root} className={styles.section} data-scene="prologue" aria-labelledby="opening-title">
      <div className={styles.frame}>
        <div className={styles.stock} aria-hidden="true" />

        {/* Volumetric optical light projection exposure */}
        <div className={styles.opticalLight} data-opening-decor data-opening-light aria-hidden="true" />

        {/* Left-side physical film strip edge */}
        <aside className={styles.filmStrip} data-opening-decor data-film-strip aria-hidden="true">
          <div className={styles.sprocketTrack}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className={styles.sprocketHole}
                style={{ opacity: 0.9 + (i % 3) * 0.04 }}
              />
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

        {/* Monumental Hero Core: Wordmark & Red ACTION Residue */}
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

        {/* Right-Side Editorial Theses Stack */}
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

        {/* Bottom baseline datum rule & timecode */}
        <div className={styles.baselineBar} data-opening-decor aria-hidden="true">
          <span className={styles.timecode}>00 : 00 : 01 : 00</span>
          <span className={styles.baselineBranding}>KAVACHPAY // 2026</span>
        </div>

        {/* Preserved 00 -> 01 Carrier Bridge into Mandate */}
        <div className={styles.paperReveal} data-opening-paper aria-hidden="true">
          <div className={styles.paperBridge} data-opening-bridge>
            <span className={styles.bridgeLabel}>01 / MANDATE</span>
            <strong className={styles.bridgeTitle}>Permission,<br />made exact.</strong>
            <i className={styles.bridgeMeta}>INTENT → BOUND AUTHORITY</i>
          </div>
        </div>
      </div>
    </section>
  );
}
