"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { progressBus } from "@/lib/experience/progress-bus";
import styles from "./OpeningScene.module.css";

type OpeningSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function OpeningScene({ trackRef }: OpeningSceneProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
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
        const isVisible = st.end > 0 ? y <= (st.end + 50) : true;
        applyVisibility(isVisible);
      };


      updateVisibility();
      ScrollTrigger.addEventListener("refresh", updateVisibility);

      // [data-opening-paper]/[data-opening-bridge] previously wiped to a
      // full-bleed paper card previewing Mandate's own headline — the
      // 00 -> 01 boundary's old DOM transition. That boundary is now owned by
      // the video transition layer, so both stay in their hidden resting
      // state and Opening's own timeline ends at 0.46 instead.
      gsap.set("[data-opening-paper]", { clipPath: "inset(48% 0 52% 0)" });
      gsap.set("[data-opening-bridge]", { opacity: 0, y: 8 });
      gsap.set("[data-opening-reg]", { opacity: 0 });

      timeline
        .to("[data-opening-word]", { yPercent: -8, scale: 0.965, duration: 0.26 }, 0.04)
        .to("[data-opening-window]", { opacity: 1, duration: 0.14 }, 0.16)
        .to("[data-opening-rule]", { scaleX: 1, duration: 0.2, ease: "power2.out" }, 0.36)
        .to("[data-opening-reg]", { opacity: 1, duration: 0.1 }, 0.40)
        .to("[data-opening-word]", { yPercent: -16, opacity: 0, clipPath: "inset(0 0 45% 0)", duration: 0.2 }, 0.44)
        .to("[data-opening-window]", { yPercent: -20, duration: 0.2 }, 0.46)
        .to("[data-opening-meta]", { color: "#15130e", duration: 0.1 }, 0.74);

      return () => {
        ScrollTrigger.removeEventListener("refresh", updateVisibility);
        timeline.scrollTrigger?.kill();
        timeline.kill();
      };
    });

    return () => motion.revert();
  }, { scope: root, dependencies: [trackRef] });

  return (
    <section ref={root} className={styles.section} data-scene="prologue" aria-labelledby="opening-title">
      <div className={styles.frame}>
        <div className={styles.stock} aria-hidden="true" />

        <div className={styles.aperture} data-opening-window>
          <span>AUTHORITY IS NOT ACCESS.</span>
          <span>IT IS A BOUND CONTRACT.</span>
        </div>

        <h1 id="opening-title" className={styles.wordmark} data-opening-word>
          KavachPay
        </h1>

        <div className={styles.statement} data-opening-meta>
          <p>CONTROL<br />TRAVELS<br />FURTHER</p>
          <p>SAME MONEY.<br />A SAFER TOMORROW.</p>
        </div>

        <div className={styles.cornerMark} aria-hidden="true">KP<br />01</div>
        <div className={styles.registrationMark} data-opening-reg aria-hidden="true">
          <span className={styles.regCross}>+</span>
          <span>SEC-00 // REG. 48.0</span>
        </div>
        <div className={styles.rule} data-opening-rule aria-hidden="true" />
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
