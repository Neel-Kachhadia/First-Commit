"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { MandateDocument } from "@/components/documents/MandateDocument";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { mandateDemo } from "@/lib/experience/demo-state";
import { progressBus } from "@/lib/experience/progress-bus";
import styles from "./MandateScene.module.css";

function getMandateBounds(rootEl: HTMLElement | null) {
  if (!rootEl) return { top: 11, right: 8, bottom: 10, left: 53 };
  const stage = rootEl.querySelector<HTMLElement>(`.${styles.stage}`) || rootEl;
  const sheet = rootEl.querySelector<HTMLElement>("[data-mandate-sheet]");
  if (!stage || !sheet) return { top: 11, right: 8, bottom: 10, left: 53 };

  const stageRect = stage.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();

  if (stageRect.height === 0 || stageRect.width === 0) {
    return { top: 11, right: 8, bottom: 10, left: 53 };
  }

  const top = Math.max(0, Math.min(100, ((sheetRect.top - stageRect.top) / stageRect.height) * 100));
  const bottom = Math.max(0, Math.min(100, ((stageRect.bottom - sheetRect.bottom) / stageRect.height) * 100));
  const left = Math.max(0, Math.min(100, ((sheetRect.left - stageRect.left) / stageRect.width) * 100));
  const right = Math.max(0, Math.min(100, ((stageRect.right - sheetRect.right) / stageRect.width) * 100));

  return { top, right, bottom, left };
}

type MandateSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

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
      gsap.set("[data-mandate-header]", { clipPath: "inset(0 0% 0 0)" });
      gsap.set("[data-mandate-category]", { opacity: 1, y: 0, clipPath: "inset(0 0% 0 0)" });
      gsap.set("[data-mandate-paper-carrier]", { opacity: 1, y: 0 });
      gsap.set("[data-mandate-intent]", { opacity: 1, xPercent: 0 });
    });

    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const applyVisibility = (visible: boolean) => {
        if (!root.current) return;
        root.current.style.visibility = visible ? "visible" : "hidden";
        root.current.style.pointerEvents = visible ? "auto" : "none";
        root.current.setAttribute("aria-hidden", visible ? "false" : "true");
      };

      const bounds = getMandateBounds(root.current);
      const boundingPaper = root.current?.querySelector<HTMLElement>("[data-mandate-bounding-paper]");

      const easeInOut = gsap.parseEase("power1.inOut");

      const updateContraction = (p: number) => {
        if (!boundingPaper) return;
        let ratio = 0;
        if (p <= 0.02) {
          ratio = 0;
        } else if (p >= 0.16) {
          ratio = 1;
        } else {
          const t = (p - 0.02) / 0.14;
          ratio = easeInOut(t);
        }

        const top = bounds.top * ratio;
        const right = bounds.right * ratio;
        const bottom = bounds.bottom * ratio;
        const left = bounds.left * ratio;

        boundingPaper.style.clipPath = `inset(${top.toFixed(2)}% ${right.toFixed(2)}% ${bottom.toFixed(2)}% ${left.toFixed(2)}%)`;
        boundingPaper.setAttribute("data-paper-top", top.toFixed(2));
        boundingPaper.setAttribute("data-paper-right", right.toFixed(2));
        boundingPaper.setAttribute("data-paper-bottom", bottom.toFixed(2));
        boundingPaper.setAttribute("data-paper-left", left.toFixed(2));
      };

      let cachedExitY = -window.innerHeight * 1.1;

      const updateTargetBounds = () => {
        const fresh = getMandateBounds(root.current);
        bounds.top = fresh.top;
        bounds.right = fresh.right;
        bounds.bottom = fresh.bottom;
        bounds.left = fresh.left;
        if (boundingPaper) {
          boundingPaper.setAttribute("data-target-top", bounds.top.toFixed(2));
          boundingPaper.setAttribute("data-target-right", bounds.right.toFixed(2));
          boundingPaper.setAttribute("data-target-bottom", bounds.bottom.toFixed(2));
          boundingPaper.setAttribute("data-target-left", bounds.left.toFixed(2));
        }
        if (root.current) {
          const sheetEl = root.current.querySelector<HTMLElement>("[data-mandate-sheet]");
          const stageEl = root.current.querySelector<HTMLElement>("[data-scene='mandate']");
          if (sheetEl && stageEl) {
            const sheetRect = sheetEl.getBoundingClientRect();
            const stageRect = stageEl.getBoundingClientRect();
            const distanceToClear = (sheetRect.bottom - stageRect.top) + 60;
            cachedExitY = -Math.max(distanceToClear, window.innerHeight * 0.95);
          } else {
            cachedExitY = -window.innerHeight * 1.1;
          }
        }
        updateContraction(0);
      };

      updateTargetBounds();
      ScrollTrigger.addEventListener("refreshInit", updateTargetBounds);

      gsap.set("[data-mandate-bounding-paper]", {
        opacity: 1,
      });
      updateContraction(0);

      gsap.set("[data-mandate-frame]", { opacity: 0, scale: 0.985 });
      gsap.set("[data-mandate-sheet]", { opacity: 1, scale: 1 });
      gsap.set("[data-mandate-shadow]", { opacity: 0 });
      gsap.set("[data-mandate-hole]", { opacity: 0, scale: 0.8 });
      gsap.set("[data-mandate-intent]", { opacity: 0, xPercent: -6 });
      gsap.set("[data-mandate-support]", { opacity: 0 });
      gsap.set("[data-mandate-truth]", { opacity: 0 });
      gsap.set("[data-mandate-measure]", { opacity: 0 });
      // Internal Mandate formation initial states:
      gsap.set("[data-mandate-header]", { clipPath: "inset(0 100% 0 0)" });
      gsap.set("[data-mandate-category]", { opacity: 0, y: -5, clipPath: "inset(0 100% 0 0)" });
      gsap.set("[data-mandate-field]", { clipPath: "inset(0 100% 0 0)" });
      gsap.set("[data-mandate-field-val]", { opacity: 0, x: 6 });
      gsap.set("[data-mandate-field='blocked'] [data-mandate-field-val]", { opacity: 0, scale: 1.06, x: 0 });
      gsap.set("[data-mandate-stamp]", { opacity: 0, scale: 0.78, rotate: -8 });
      gsap.set("[data-mandate-footer]", { opacity: 0, y: 4 });
      gsap.set("[data-mandate-seal]", { opacity: 0, scale: 1.14, rotate: -12 });
      // Editorial splice initial states:
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      gsap.set("[data-mandate-paper-carrier]", { y: 0, opacity: 1 });
      gsap.set("[data-mandate-copy-stage]", { y: 0, opacity: 1 });
      gsap.set("[data-mandate-splice-geom]", { opacity: 0 });
      gsap.set("[data-mandate-splice-rule]", {
        scaleX: 0,
        transformOrigin: isMobile ? "center center" : "75% center",
      });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: triggerEl,
          start: "top top",
          end: isPersistent ? "bottom top" : "+=160%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("mandate", self.progress);
            updateContraction(self.progress);
          },
        },
      });

      // Dedicated visibility ScrollTrigger with authored boundary overlap:
      // Visible from start of Mandate to 120px past Mandate end into Decisions.
      // start uses a 1px epsilon (not part of the authored overlap) — GSAP's
      // onEnter for a non-scrubbed trigger requires progress to strictly exceed 0,
      // so landing exactly on the boundary pixel (e.g. scroll-restored deep link)
      // would otherwise leave the body hidden until 1px of further scroll.
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

      timeline

        // -------------------------------------------------------------
        // STAGE 1 — INTENT RECEIVED & BOUNDED CONVERGENCE (0.00 - 0.20)
        // -------------------------------------------------------------
        .to("[data-mandate-frame]", { opacity: 1, scale: 1, duration: 0.03 }, 0.01)
        .to("[data-mandate-shadow]", { opacity: 0.22, duration: 0.06 }, 0.05)
        .to("[data-mandate-shadow]", { opacity: 1, duration: 0.05 }, 0.11)
        .to("[data-mandate-support]", { opacity: 1, duration: 0.06 }, 0.10)
        .to("[data-mandate-truth]", { opacity: 1, duration: 0.06 }, 0.11)
        .to("[data-mandate-measure]", { opacity: 1, duration: 0.06 }, 0.12)
        .to("[data-mandate-hole]", { opacity: 1, scale: 1, duration: 0.04, ease: "power2.out" }, 0.13)
        .to("[data-mandate-frame]", { opacity: 0, duration: 0.04 }, 0.13)
        .to("[data-mandate-bounding-paper]", { opacity: 0, duration: 0.03 }, 0.15)
        .to("[data-mandate-intent]", { opacity: 1, xPercent: 0, duration: 0.06, ease: "power2.out" }, 0.16)

        // -------------------------------------------------------------
        // STAGE 2 — SCOPE ASSIGNED (0.20 - 0.28)
        // -------------------------------------------------------------
        .to("[data-mandate-header]", { clipPath: "inset(0 0% 0 0)", duration: 0.05, stagger: 0.015 }, 0.20)
        .to("[data-mandate-category]", { opacity: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.06, ease: "power2.out" }, 0.23)

        // -------------------------------------------------------------
        // STAGE 3 — COMPLETE AUTHORITY FIELDS (0.28 - 0.48)
        // All fields reveal rapidly: LIMIT, STEP-UP, NO, EXPIRES, DELEGATION, STAMP
        // -------------------------------------------------------------
        .to("[data-mandate-field]", { clipPath: "inset(0 0% 0 0)", duration: 0.06, stagger: 0.01 }, 0.28)
        .to("[data-mandate-field='limit'] [data-mandate-field-val]", { opacity: 1, x: 0, duration: 0.04, ease: "power2.out" }, 0.28)
        .to("[data-mandate-field='stepup'] [data-mandate-field-val]", { opacity: 1, x: 0, duration: 0.04, ease: "power2.out" }, 0.32)
        .to("[data-mandate-field='blocked'] [data-mandate-field-val]", { opacity: 1, scale: 1, x: 0, duration: 0.04, ease: "power2.out" }, 0.36)
        .to("[data-mandate-field='expires'] [data-mandate-field-val]", { opacity: 1, x: 0, duration: 0.04, ease: "power2.out" }, 0.40)
        .to("[data-mandate-field='delegation'] [data-mandate-field-val]", { opacity: 1, x: 0, duration: 0.04, ease: "power2.out" }, 0.44)
        .to("[data-mandate-stamp]", { opacity: 1, scale: 1, rotate: 0, duration: 0.06, ease: "power2.out" }, 0.48)

        // -------------------------------------------------------------
        // STAGE 4 — CONTRACT ACTIVATED (0.50 - 0.60)
        // Constraints complete -> seal impacts and settles firmly
        // -------------------------------------------------------------
        .to("[data-mandate-footer]", { opacity: 1, y: 0, duration: 0.05, stagger: 0.015 }, 0.50)
        .to("[data-mandate-seal]", { opacity: 1, scale: 1, rotate: -7, duration: 0.06, ease: "power2.out" }, 0.52)

        // -------------------------------------------------------------
        // STAGE 5 — FULL COMPLETED CONTRACT HOLD (0.60 - 0.82)
        // The complete authority contract holds in rock-solid rest.
        // -------------------------------------------------------------

        // -------------------------------------------------------------
        // STAGE 6 — UNRELATED CONTENT RECESSION & RULE EXTENSION (0.82 - 0.88)
        // Peripheral text recedes early; registration rules bridge to Decisions
        // -------------------------------------------------------------
        .to("[data-mandate-measure]", { opacity: 0, duration: 0.04 }, 0.82)
        .to("[data-mandate-support]", { opacity: 0, duration: 0.04 }, 0.83)
        .to("[data-mandate-truth]", { opacity: 0, duration: 0.04 }, 0.83)
        .to("[data-mandate-splice-geom]", { opacity: 1, duration: 0.01 }, 0.84)
        .fromTo(
          "[data-mandate-splice-rule]",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.05, stagger: 0.008, ease: "power2.out" },
          0.84,
        )

        // -------------------------------------------------------------
        // STAGE 7 — PHYSICAL PAPER CARRIER DEPARTURE (0.87 - 0.99)
        // Physical displacement does ~90% of visual departure.
        // Stage boundary crops departing material. No razor clipPath!
        // -------------------------------------------------------------
        .to(
          "[data-mandate-copy-stage]",
          {
            y: -36,
            opacity: 0,
            duration: 0.06,
            ease: "power2.in",
          },
          0.87,
        )
        .to(
          "[data-mandate-paper-carrier]",
          {
            y: () => cachedExitY,
            duration: 0.12,
            ease: "power2.in",
          },
          0.87,
        )
        // Opacity drops only in the final 15% of movement (0.965 - 0.995) to soften final exit
        .to(
          "[data-mandate-paper-carrier]",
          {
            opacity: 0,
            duration: 0.03,
            ease: "power1.out",
          },
          0.965,
        )

        // -------------------------------------------------------------
        // STAGE 8 — SPLICE RULE BRIDGE (0.96 - 1.00)
        // Rules hold at scaleX: 1, bridging directly into Decisions evaluation lines
        // -------------------------------------------------------------
        .set({}, {}, 1.00);

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", updateTargetBounds);
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
        {/* Dark stage layer: Ivory typography revealed as paper contracts away */}
        <div className={styles.copyStage} data-mandate-copy data-mandate-copy-stage>
          <p className={styles.sceneLabel}>01 / MANDATE</p>
          <h2 id="mandate-scene-title" className={styles.copyHeading}>Permission,<br />made exact.</h2>
          <p className={styles.support} data-mandate-support>SET BOUNDARIES<br />FOR A BRIGHTER<br />EVERYDAY.</p>
          <p className={styles.truth} data-mandate-truth>An agent receives authority<br />inside a contract—never<br />unrestricted money.</p>
        </div>

        {/* Contracting Paper Layer: Master ivory paper field with dark-ink copy */}
        <div className={styles.boundingPaper} data-mandate-bounding-paper data-mandate-handoff aria-hidden="true">
          <div className={styles.copyPaper} data-mandate-copy-paper>
            <p className={styles.sceneLabel}>01 / MANDATE</p>
            <strong className={styles.copyHeading}>Permission,<br />made exact.</strong>
            <i className={styles.bridgeMeta}>INTENT → BOUND AUTHORITY</i>
          </div>
        </div>

        {/* Destination registration frame */}
        <div className={styles.registeredFrame} data-mandate-frame aria-hidden="true">
          <span className={styles.regCornerTL} />
          <span className={styles.regCornerTR} />
          <span className={styles.regCornerBL} />
          <span className={styles.regCornerBR} />
        </div>

        {/* Editorial Splice Registration Geometry */}
        <div className={styles.spliceGeometry} data-mandate-splice-geom aria-hidden="true">
          <div className={styles.spliceRuleTop} data-mandate-splice-rule="top" />
          <div className={styles.spliceRuleUpper} data-mandate-splice-rule="upper">
            <span className={styles.spliceTickLeft} />
            <span className={styles.spliceLabelLeft}>+ REG. 01 // AXIS</span>
            <span className={styles.spliceTickRight} />
            <span className={styles.spliceLabelRight}>GATE // 01</span>
          </div>
          <div className={styles.spliceRuleLower} data-mandate-splice-rule="lower">
            <span className={styles.spliceTickLeft} />
            <span className={styles.spliceLabelLeft}>+ REG. 02 // DATUM</span>
            <span className={styles.spliceTickRight} />
            <span className={styles.spliceLabelRight}>GATE // 02</span>
          </div>
          <div className={styles.spliceRuleBottom} data-mandate-splice-rule="bottom" />
        </div>

        {/* Paper Artifact Carrier: Houses Intent Ticket and Mandate Sheet for unified registration shutter departure */}
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
