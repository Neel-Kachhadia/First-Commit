"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { MandateDocument } from "@/components/documents/MandateDocument";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { mandateDemo } from "@/lib/experience/demo-state";
import { progressBus } from "@/lib/experience/progress-bus";
import styles from "./MandateScene.module.css";

type MandateSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

const CLIP_HIDDEN = "inset(0 100% 0 0)";
const CLIP_SHOWN = "inset(0 0% 0 0)";

// Authority fields in the order the intent compiles them into the contract.
const FIELDS = ["limit", "stepup", "blocked", "expires", "delegation"] as const;

export function MandateScene({ trackRef }: MandateSceneProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!root.current) return;
    const isPersistent = Boolean(trackRef);
    const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='mandate']" : root.current);
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: reduce)", () => {
      if (root.current) {
        root.current.style.visibility = "visible";
        root.current.style.pointerEvents = "auto";
        root.current.setAttribute("aria-hidden", "false");
      }
      gsap.set("[data-mandate-header]", { clipPath: CLIP_SHOWN });
      gsap.set("[data-mandate-category]", { opacity: 1, y: 0, clipPath: CLIP_SHOWN });
      gsap.set("[data-mandate-field]", { clipPath: CLIP_SHOWN });
      gsap.set("[data-mandate-field-val]", { opacity: 1, x: 0, scale: 1 });
      gsap.set("[data-mandate-stamp]", { opacity: 1, scale: 1, rotate: 0 });
      gsap.set("[data-mandate-footer]", { opacity: 1, y: 0 });
      gsap.set("[data-mandate-seal]", { opacity: 1, scale: 1, rotate: -7 });
    });

    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const applyVisibility = (visible: boolean) => {
        if (!root.current) return;
        root.current.style.visibility = visible ? "visible" : "hidden";
        root.current.style.pointerEvents = visible ? "auto" : "none";
        root.current.setAttribute("aria-hidden", visible ? "false" : "true");
      };

      // ---- Initial state: exactly the 00->01 film's last frame ---------------
      // Already established by the film and untouched here: scene label,
      // headline, support and truth copy, the intent ticket, the blank sheet with
      // its eyelet and stacked shadow, and the 0 - 4,000 measure. Only the
      // contract itself (everything printed ON the sheet) is still to be compiled.
      gsap.set("[data-mandate-frame]", { opacity: 0 });
      gsap.set("[data-mandate-header]", { clipPath: CLIP_HIDDEN });
      gsap.set("[data-mandate-category]", { opacity: 0, y: -5, clipPath: CLIP_HIDDEN });
      gsap.set("[data-mandate-field]", { clipPath: CLIP_HIDDEN });
      gsap.set("[data-mandate-field-val]", { opacity: 0, x: 6 });
      gsap.set("[data-mandate-field='blocked'] [data-mandate-field-val]", { opacity: 0, scale: 1.06, x: 0 });
      gsap.set("[data-mandate-stamp]", { opacity: 0, scale: 0.78, rotate: -8 });
      gsap.set("[data-mandate-footer]", { opacity: 0, y: 4 });
      gsap.set("[data-mandate-seal]", { opacity: 0, scale: 1.14, rotate: -12 });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: triggerEl,
          start: "top top",
          end: isPersistent ? "bottom top" : "+=240%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("mandate", self.progress);
          },
        },
      });

      // Visibility. start uses a 1px epsilon (not an authored overlap): GSAP's
      // onEnter for a non-scrubbed trigger needs progress strictly > 0, so a
      // scroll-restored deep link on the boundary pixel would otherwise leave
      // the body hidden until 1px more scroll. The body deliberately lingers
      // 120px past its end so it stays under the desktop 01->02 film's fade-in.
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top-=120px",
        onEnter: () => {
          applyVisibility(true);
          window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "mandate" } }));
        },
        onEnterBack: () => {
          applyVisibility(true);
          window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "mandate" } }));
        },
        onLeave: () => {
          if (isPersistent) applyVisibility(false);
        },
        onLeaveBack: () => {
          applyVisibility(false);
        },
      });

      // =========================================================================
      // A — INTENT RECEIVED (0.00 - 0.05): hold the film's frame untouched.
      // The intent ticket and the blank contract stock are already on stage.
      //
      // B — STOCK BOUNDED (0.05 - 0.10): registration corners fix the region of
      // the sheet the intent is about to be compiled into.
      // =========================================================================
      // Desktop only: the mobile frame geometry runs a rule straight through the
      // ticket's quote, so on mobile the frame is never shown.
      const showFrame = !window.matchMedia("(max-width: 900px)").matches;
      if (showFrame) timeline.to("[data-mandate-frame]", { opacity: 1, duration: 0.05, ease: "power1.out" }, 0.05);

      // =========================================================================
      // C — SCOPE ASSIGNED (0.10 - 0.25): the contract header prints, then the
      // category the intent named ("groceries") is set as the spending scope.
      // =========================================================================
      timeline
        .to("[data-mandate-header]", { clipPath: CLIP_SHOWN, duration: 0.06, stagger: 0.02 }, 0.1)
        .to(
          "[data-mandate-category]",
          { opacity: 1, y: 0, clipPath: CLIP_SHOWN, duration: 0.08, ease: "power2.out" },
          0.18,
        );

      // =========================================================================
      // D — LIMITS COMPILED (0.25 - 0.73): one enforceable constraint at a time.
      // Each rule is ruled onto the sheet, then its value is set against it:
      // LIMIT 4,000/WEEK -> STEP-UP > 1,500 -> NO ALCOHOL -> EXPIRES SUN 23:59
      // -> DELEGATION 2 LEVELS MAX. NO ALCOHOL lands hard (a prohibition, not a
      // number); the others settle in.
      // =========================================================================
      FIELDS.forEach((name, i) => {
        const at = 0.25 + i * 0.1;
        timeline
          .to(`[data-mandate-field='${name}']`, { clipPath: CLIP_SHOWN, duration: 0.05, ease: "power1.out" }, at)
          .to(
            `[data-mandate-field='${name}'] [data-mandate-field-val]`,
            name === "blocked"
              ? { opacity: 1, scale: 1, x: 0, duration: 0.03, ease: "power3.out" }
              : { opacity: 1, x: 0, duration: 0.05, ease: "power2.out" },
            at + 0.03,
          );
      });

      // =========================================================================
      // E — CONTRACT BOUND (0.75 - 0.89): the category block stamp, the footer
      // and the seal strike. The seal is the hard event: authority is now bound.
      // The registration corners release once the stock is sealed.
      // =========================================================================
      timeline
        .to("[data-mandate-stamp]", { opacity: 1, scale: 1, rotate: 0, duration: 0.04, ease: "power2.out" }, 0.75)
        .to("[data-mandate-footer]", { opacity: 1, y: 0, duration: 0.05, stagger: 0.015 }, 0.76)
        .to("[data-mandate-seal]", { opacity: 1, scale: 1, rotate: -7, duration: 0.05, ease: "power2.out" }, 0.8);
      if (showFrame) timeline.to("[data-mandate-frame]", { opacity: 0, duration: 0.04, ease: "power1.in" }, 0.85);

      // =========================================================================
      // F — TERMINAL HOLD (0.89 - 1.00): the completed contract, exactly the
      // 01->02 film's first frame. Nothing recedes, departs or bridges.
      // =========================================================================
      timeline.set({}, {}, 1.0);

      return () => {
        visibilityTrigger.kill();
        timeline.scrollTrigger?.kill();
        timeline.kill();
      };
    });

    return () => motion.revert();
  }, { scope: root, dependencies: [trackRef] });

  return (
    <section ref={root} className={styles.section} data-scene="mandate" aria-labelledby="mandate-scene-title">
      <div className={styles.stage}>
        {/* Dark stage layer: scene copy, established by the 00->01 film */}
        <div className={styles.copyStage} data-mandate-copy data-mandate-copy-stage>
          <p className={styles.sceneLabel}>01 / MANDATE</p>
          <h2 id="mandate-scene-title" className={styles.copyHeading}>Permission,<br />made exact.</h2>
          <p className={styles.support} data-mandate-support>SET BOUNDARIES<br />FOR A BRIGHTER<br />EVERYDAY.</p>
          <p className={styles.truth} data-mandate-truth>An agent receives authority<br />inside a contract—never<br />unrestricted money.</p>
        </div>

        {/* Registration frame: fixes the region of the stock being compiled into */}
        <div className={styles.registeredFrame} data-mandate-frame aria-hidden="true">
          <span className={styles.regCornerTL} />
          <span className={styles.regCornerTR} />
          <span className={styles.regCornerBL} />
          <span className={styles.regCornerBR} />
        </div>

        {/* Intent ticket and mandate sheet */}
        <div className={styles.paperCarrier} data-mandate-paper-carrier>
          <div className={styles.intent} data-mandate-intent>
            <span>ORIGINAL INTENT / 01</span>
            <strong>“{mandateDemo.intent}”</strong>
            <i>COMPILED →</i>
          </div>

          <div className={styles.sheet} data-mandate-sheet>
            <div className={styles.sheetShadow} data-mandate-shadow aria-hidden="true" />
            <MandateDocument />
          </div>
        </div>

        <div className={styles.measure} data-mandate-measure aria-hidden="true">
          <span>0</span><i /><span>4,000</span>
        </div>
      </div>
    </section>
  );
}
