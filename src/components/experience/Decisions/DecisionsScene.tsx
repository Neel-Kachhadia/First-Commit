"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { decisionsDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { TransactionReceipt } from "@/components/documents/TransactionReceipt";
import { DecisionStamp } from "@/components/graphics/DecisionStamp";
import styles from "./DecisionsScene.module.css";

type DecisionsSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function DecisionsScene({ trackRef }: DecisionsSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReduced = experienceStore.getState().reducedMotion;
      if (prefersReduced) {
        if (!root.current || !stageRef.current) return;

        // KP-MOTION-006: reduced motion changes animation behavior, not scene ownership --
        // this used to force visibility/pointer-events on unconditionally, which stayed
        // true (and interactive) even while a different scene owned the stage. Mirror the
        // same ownership-aware visibility trigger the full-motion branch below uses, just
        // without the scrubbed timeline driving it.
        const reducedTriggerEl =
          trackRef?.current ?? (Boolean(trackRef) ? "[data-track='decisions']" : root.current);
        const applyReducedVisibility = (visible: boolean) => {
          if (root.current) {
            root.current.style.visibility = visible ? "visible" : "hidden";
            root.current.style.pointerEvents = visible ? "auto" : "none";
            root.current.setAttribute("aria-hidden", visible ? "false" : "true");
          }
          if (stageRef.current) {
            stageRef.current.style.visibility = visible ? "visible" : "hidden";
          }
        };
        applyReducedVisibility(false);

        const reducedVisibilityTrigger = ScrollTrigger.create({
          trigger: reducedTriggerEl,
          start: "top top+=1px",
          end: "bottom top",
          onEnter: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "decisions" } }));
          },
          onEnterBack: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "decisions" } }));
          },
          onLeave: () => applyReducedVisibility(false),
          onLeaveBack: () => applyReducedVisibility(false),
        });

        gsap.set(
          "[data-lane-tag='allow'], [data-lane-tag='stepup'], [data-lane-tag='deny']",
          {
            scale: 1,
            x: 0,
            y: 0,
            opacity: 1,
            clipPath: "none",
            letterSpacing: "-0.025em",
          },
        );
        return () => reducedVisibilityTrigger.kill();
      }
      if (!root.current || !stageRef.current) return;

      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const allowMidX = isMobile ? 10 : 35;
      const allowExitX = isMobile ? 28 : 68;
      const stepUpArrestX = isMobile ? 2 : 6;
      const denyHaltX = isMobile ? -6 : -8;

      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='decisions']" : root.current);

      const applyVisibility = (visible: boolean) => {
        if (root.current) {
          root.current.style.visibility = visible ? "visible" : "hidden";
          root.current.style.pointerEvents = visible ? "auto" : "none";
          root.current.setAttribute("aria-hidden", visible ? "false" : "true");
        }
        if (stageRef.current) {
          stageRef.current.style.visibility = visible ? "visible" : "hidden";
        }
      };

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: triggerEl,
          start: "top top",
          end: isPersistent ? "bottom top" : "+=220%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("decisions", self.progress);
          },
        },
      });

      // Body visibility trigger scoped exactly to Decisions' own pinned window --
      // no overlap into Mandate or Delegation.
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          applyVisibility(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", {
              detail: { id: "decisions" },
            }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", {
              detail: { id: "decisions" },
            }),
          );
        },
        onLeave: () => {
          if (isPersistent) applyVisibility(false);
        },
        onLeaveBack: () => {
          applyVisibility(false);
        },
      });

      const startScale = isMobile ? 2.1 : 2.45;

      // Initial setup for deterministic forward and reverse scrub
      gsap.set(
        "[data-lane-tag='allow'], [data-lane-tag='stepup'], [data-lane-tag='deny']",
        {
          scale: startScale,
          x: 0,
          y: -6,
          opacity: 0,
          clipPath: "inset(0% 0% 100% 0%)",
          letterSpacing: "-0.01em",
          transformOrigin: "left center",
        },
      );
      gsap.set("[data-lane-tag='deny']", {
        color: "#ebe1c9",
      });
      gsap.set("[data-lane-letter]", { opacity: 0, x: -10 });
      gsap.set("[data-lane-rule]", { opacity: 0, y: -6 });
      gsap.set("[data-lane-track-line]", { scaleX: 0, transformOrigin: "left center" });
      gsap.set("[data-decisions-header]", { opacity: 0, y: -8 });
      gsap.set("[data-decisions-footer]", { opacity: 0, y: 8 });
      gsap.set("[data-lane-sprockets]", { opacity: 0 });
      gsap.set("[data-receipt-wrap]", { opacity: 0, xPercent: -130 });
      gsap.set("[data-gate='stepup']", { opacity: 0, scaleY: 0 });
      gsap.set("[data-barrier='deny']", { opacity: 0, scaleX: 0 });
      gsap.set("[data-stamp]", { opacity: 0 });
      gsap.set("[data-note]", { opacity: 0, x: 12 });


      // =========================================================================
      // BEAT 1: THRESHOLD REGISTRATION & COORDINATED CONTRACTION (0.00 - 0.22)
      // 0.00 - 0.035: Threshold Registration Reveal. All three labels (ALLOW /
      // STEP-UP / DENY) register into the horizontal rules together as ONE family.
      // Row-local clip opens vertically from rule, type travels slightly into
      // position, opacity moves 0 -> 1, tracking resolves. Zero scale pop.
      // 0.035 - 0.065: Complete Threshold Hold. Full large threshold family
      // holds in rock-solid rest before contraction begins.
      // 0.065 - 0.22: Coordinated Contraction. All three outcomes contract together
      // as ONE single typographic family into their operational lane anchors.
      // 0.22 - 0.25: Operational Settle.
      // =========================================================================
      timeline
        // Threshold registration reveal: all three labels reveal as ONE family from 0.00 to 0.035
        .fromTo(
          "[data-lane-tag='allow'], [data-lane-tag='stepup'], [data-lane-tag='deny']",
          {
            clipPath: "inset(0% 0% 100% 0%)",
            opacity: 0,
            y: -6,
            letterSpacing: "-0.01em",
            scale: startScale,
            x: 0,
            transformOrigin: "left center",
          },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            opacity: 1,
            y: 0,
            letterSpacing: "-0.025em",
            scale: startScale,
            duration: 0.035,
            stagger: 0.002,
            ease: "power2.out",
          },
          0.00,
        )
        // 0.035 - 0.065: Complete threshold hold (labels remain at full startScale, unclipped, opacity 1)

        // 0.065 - 0.22: Coordinated typographic contraction across all three lanes simultaneously
        .fromTo(
          "[data-lane-tag='allow'], [data-lane-tag='stepup'], [data-lane-tag='deny']",
          {
            scale: startScale,
            x: 0,
            y: 0,
            opacity: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            letterSpacing: "-0.025em",
            transformOrigin: "left center",
          },
          {
            scale: 1,
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.155,
            ease: "power2.out",
          },
          0.065,
        )
        // Subtly tint DENY to administrative red late in contraction
        .fromTo(
          "[data-lane-tag='deny']",
          { color: "#ebe1c9" },
          { color: "#a92a24", duration: 0.06, ease: "power1.inOut" },
          0.16,
        )

        // Top institutional header and bottom frame register
        .fromTo(
          "[data-decisions-header]",
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.07, ease: "power2.out" },
          0.04,
        )
        .fromTo(
          "[data-decisions-footer]",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.07, ease: "power2.out" },
          0.04,
        )

        // Lane identity letters A / B / C register as labels approach operational anchors
        .fromTo(
          "[data-lane-letter]",
          { opacity: 0, x: -10 },
          { opacity: 1, x: 0, duration: 0.08, stagger: 0.015, ease: "power2.out" },
          0.13,
        )

        // Descriptors (CONTINUITY / INTERRUPTION / INCOMPLETION) emerge into registration
        .fromTo(
          "[data-lane-rule]",
          { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: 0.08, stagger: 0.015, ease: "power2.out" },
          0.13,
        )

        // Evaluation tracks extend outward from the settled typographic anchors
        .fromTo(
          "[data-lane-track-line]",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.08, stagger: 0.02, ease: "power2.out" },
          0.14,
        )

        // Sprocket tracks materialize along the three lanes
        .fromTo(
          "[data-lane-sprockets]",
          { opacity: 0 },
          { opacity: 0.55, duration: 0.08, ease: "none" },
          0.14,
        );

      // =========================================================================
      // BEAT 2: ALLOW — CONTINUITY (0.25 - 0.49)
      // Grocery ₹1,249 enters ONLY after contraction has fully resolved & settled.
      // Glides cleanly through evaluation, receives APPROVED in-flight,
      // continues out forward. Velocity preserved!
      // =========================================================================
      timeline
        // Focus spotlight on Lane A
        .to("[data-lane='allow']", { opacity: 1, duration: 0.05 }, 0.25)
        .to("[data-lane='stepup']", { opacity: 0.38, duration: 0.05 }, 0.25)
        .to("[data-lane='deny']", { opacity: 0.38, duration: 0.05 }, 0.25)

        // Receipt enters from left
        .fromTo(
          "[data-receipt-wrap='allow']",
          { xPercent: -130, opacity: 0 },
          { xPercent: -15, opacity: 1, duration: 0.12, ease: "power1.in" },
          0.25,
        )
        // Continues gliding through the inspection point (no stop!)
        .to(
          "[data-receipt-wrap='allow']",
          { xPercent: allowMidX, duration: 0.08, ease: "none" },
          0.37,
        )
        // In-flight stamp registers without stopping velocity
        .fromTo(
          "[data-stamp='allow']",
          { opacity: 0, scale: 1.35, rotate: -8 },
          { opacity: 1, scale: 1, rotate: -2, duration: 0.04, ease: "power2.out" },
          0.39,
        )
        // Annotation registers quietly on the right
        .fromTo(
          "[data-note='allow']",
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.05 },
          0.41,
        )
        // Smooth continuation to exit boundary
        .to(
          "[data-receipt-wrap='allow']",
          { xPercent: allowExitX, opacity: 0.92, duration: 0.08, ease: "power1.out" },
          0.45,
        );

      // =========================================================================
      // BEAT 3: STEP-UP — INTERRUPTION (0.50 - 0.72)
      // Travel ₹4,900 enters with forward momentum, then is cleanly and
      // sharply ARRESTED mid-lane. Stamp registers on the held slip.
      // Route remains intact, slip is held in suspense.
      // =========================================================================
      timeline
        // Focus shifts to Lane B
        .to("[data-lane='allow']", { opacity: 0.45, duration: 0.05 }, 0.50)
        .to("[data-lane='stepup']", { opacity: 1, duration: 0.05 }, 0.50)
        .to("[data-lane='deny']", { opacity: 0.35, duration: 0.05 }, 0.50)

        // Receipt enters from left with forward momentum
        .fromTo(
          "[data-receipt-wrap='stepup']",
          { xPercent: -130, opacity: 0 },
          { xPercent: -20, opacity: 1, duration: 0.10, ease: "power2.out" },
          0.50,
        )
        // Advances toward checkpoint then sharply arrests
        .to(
          "[data-receipt-wrap='stepup']",
          { xPercent: stepUpArrestX, duration: 0.05, ease: "expo.out" },
          0.60,
        )
        // Hold gate indicator clamps around the slip
        .fromTo(
          "[data-gate='stepup']",
          { opacity: 0, scaleY: 0 },
          { opacity: 1, scaleY: 1, duration: 0.04, ease: "power3.out" },
          0.62,
        )
        // STEP-UP REQUIRED stamp registers on the arrested slip
        .fromTo(
          "[data-stamp='stepup']",
          { opacity: 0, scale: 1.4, rotate: 6 },
          { opacity: 1, scale: 1, rotate: 3, duration: 0.04, ease: "power2.out" },
          0.64,
        )
        // Annotation registers on the right
        .fromTo(
          "[data-note='stepup']",
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.05 },
          0.66,
        );

      // =========================================================================
      // BEAT 4: DENY — INCOMPLETION (0.73 - 0.90)
      // Blocked Merchant ₹799 advances, but the route itself TERMINATES.
      // Slip hits a severed boundary, cannot proceed, stamped DENIED.
      // =========================================================================
      timeline
        // Focus shifts to Lane C
        .to("[data-lane='allow']", { opacity: 0.45, duration: 0.05 }, 0.73)
        .to("[data-lane='stepup']", { opacity: 0.45, duration: 0.05 }, 0.73)
        .to("[data-lane='deny']", { opacity: 1, duration: 0.05 }, 0.73)

        // Receipt enters along rail C
        .fromTo(
          "[data-receipt-wrap='deny']",
          { xPercent: -130, opacity: 0 },
          { xPercent: -35, opacity: 1, duration: 0.08, ease: "power1.out" },
          0.73,
        )
        // Route sever / barrier activates ahead of the slip
        .fromTo(
          "[data-barrier='deny']",
          { opacity: 0, scaleX: 0 },
          { opacity: 1, scaleX: 1, duration: 0.04, ease: "power2.out" },
          0.78,
        )
        // Route rail terminates and breaks away
        .to(
          "[data-track-remaining='deny']",
          { opacity: 0.12, strokeDashoffset: 40, duration: 0.05 },
          0.79,
        )
        // Slip attempts continuation and halts abruptly at the void barrier
        .to(
          "[data-receipt-wrap='deny']",
          { xPercent: denyHaltX, duration: 0.04, ease: "power3.out" },
          0.80,
        )
        // Heavy administrative DENIED stamp impacts
        .fromTo(
          "[data-stamp='deny']",
          { opacity: 0, scale: 1.5, rotate: -9 },
          { opacity: 1, scale: 1, rotate: -4, duration: 0.04, ease: "power2.out" },
          0.82,
        )
        // Annotation registers on the right
        .fromTo(
          "[data-note='deny']",
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.05 },
          0.85,
        );

      // =========================================================================
      // BEAT 5: FINAL RESTING COMPOSITION (0.89 - 1.00)
      // All three lanes settle into their authentic resting positions:
      // A = clear exit / continued
      // B = suspended / held with open path ahead
      // C = terminated / severed with dead end
      // 0.89 - 0.93: Completed Decisions operating state holds in clear readable
      // rest. The scene stays in this resting composition through the end of its
      // own track; the scene root is hidden by the visibility trigger once the
      // viewer scrolls past it, so no separate release/fade-out is needed here.
      // =========================================================================
      timeline
        .to("[data-lane='allow']", { opacity: 0.9, duration: 0.04 }, 0.89)
        .to("[data-lane='stepup']", { opacity: 0.95, duration: 0.04 }, 0.89)
        .to("[data-lane='deny']", { opacity: 0.95, duration: 0.04 }, 0.89)
        // Sustained terminal hold through 0.93
        .set({}, {}, 0.93)
        // Geometry-only: collapses the track line width without touching its
        // now boundary-owned opacity.
        .to(
          "[data-lane-track-line]",
          { scaleX: 0.3, duration: 0.035, ease: "power1.in" },
          0.935,
        )
        // Geometry-only: scale/position, opacity owned by the boundary.
        .to(
          "[data-receipt-wrap='allow']",
          { scale: 0.94, duration: 0.035, ease: "power1.out" },
          0.93,
        )
        .to(
          "[data-receipt-wrap='stepup']",
          { yPercent: -180, scale: 0.7, duration: 0.035, ease: "power2.in" },
          0.935,
        )
        .to(
          "[data-receipt-wrap='deny']",
          { yPercent: -240, scale: 0.7, duration: 0.035, ease: "power2.in" },
          0.94,
        )
        .set({}, {}, 1.00);

      return () => {
        visibilityTrigger.kill();
        timeline.scrollTrigger?.kill();
        timeline.kill();
      };
    },
    { scope: root, dependencies: [trackRef] },
  );

  return (
    <section
      ref={root}
      className={styles.section}
      data-scene="decisions"
      aria-labelledby="decisions-scene-title"
    >
      <div ref={stageRef} className={styles.stage} data-decisions-stage>
        {/* Top Institutional Header Bar */}
        <header className={styles.sceneHeader} data-decisions-header>
          <div className={styles.headerLeft}>
            <span className={styles.sceneIndex}>02</span>
            <span className={styles.headerDivider}>/</span>
            <h2 id="decisions-scene-title" className={styles.headerTitle}>
              ALLOW / STEP-UP / DENY
            </h2>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.headerSub}>SAME RULES.</span>
            <span className={styles.headerMeta}>DIFFERENT OUTCOMES.</span>
          </div>
        </header>

        {/* 3 Horizontal Evaluation Lanes */}
        <div className={styles.lanesBoard} data-lanes-board>
          {/* ------------------------------------------------------------- */}
          {/* LANE A: ALLOW (Grocery ₹1,249) */}
          {/* ------------------------------------------------------------- */}
          <div
            className={`${styles.lane} ${styles.laneAllow}`}
            data-lane="allow"
            aria-label="Allow outcome: Grocery"
          >
            {/* Left Lane Identity */}
            <div className={styles.laneIdentity}>
              <span className={styles.laneLetter} data-lane-letter="allow">A</span>
              <div className={styles.laneTagWrap}>
                <strong className={styles.laneTag} data-lane-tag="allow">ALLOW</strong>
                <span className={styles.laneRule} data-lane-rule="allow">CONTINUITY</span>
              </div>
            </div>

            {/* Film Sprocket Perforations */}
            <div className={styles.sprocketTrack} data-lane-sprockets aria-hidden="true">
              <div className={styles.sprocketRow} />
            </div>

            {/* Travel Path & Receipt Carriage */}
            <div className={styles.trackContainer} data-lane-track>
              <div className={styles.trackLine} data-lane-track-line="allow" />
              <div className={styles.receiptCarriage} data-receipt-wrap="allow">
                <TransactionReceipt
                  id={decisionsDemo.allow.id}
                  agent={decisionsDemo.allow.agent}
                  category={decisionsDemo.allow.category}
                  amount={decisionsDemo.allow.amount}
                  mandateRef={decisionsDemo.allow.mandateRef}
                  status="approved"
                  stamp={
                    <div data-stamp="allow">
                      <DecisionStamp tone="ink">APPROVED</DecisionStamp>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Right Restrained Annotation */}
            <div className={styles.laneOutcome} data-note="allow">
              <span className={styles.outcomeLine}>CONTINUITY</span>
              <span className={styles.outcomeSub}>UNOBSTRUCTED PASSAGE</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* LANE B: STEP-UP (Travel ₹4,900) */}
          {/* ------------------------------------------------------------- */}
          <div
            className={`${styles.lane} ${styles.laneStepUp}`}
            data-lane="stepup"
            aria-label="Step-up outcome: Travel"
          >
            {/* Left Lane Identity */}
            <div className={styles.laneIdentity}>
              <span className={styles.laneLetter} data-lane-letter="stepup">B</span>
              <div className={styles.laneTagWrap}>
                <strong className={`${styles.laneTag} ${styles.tagStepUp}`} data-lane-tag="stepup">
                  STEP-UP
                </strong>
                <span className={styles.laneRule} data-lane-rule="stepup">INTERRUPTION</span>
              </div>
            </div>

            {/* Film Sprocket Perforations */}
            <div className={styles.sprocketTrack} data-lane-sprockets aria-hidden="true">
              <div className={styles.sprocketRow} />
            </div>

            {/* Travel Path & Receipt Carriage */}
            <div className={styles.trackContainer} data-lane-track>
              <div className={styles.trackLine} data-lane-track-line="stepup" />
              {/* Hold Gate Clamp (Physically arrests the slip) */}
              <div className={styles.holdGate} data-gate="stepup" aria-hidden="true">
                <span className={styles.gateBracketLeft}>[</span>
                <span className={styles.gateLabel}>HOLD FOR CLEARANCE</span>
                <span className={styles.gateBracketRight}>]</span>
              </div>
              <div className={styles.receiptCarriage} data-receipt-wrap="stepup">
                <TransactionReceipt
                  id={decisionsDemo.stepUp.id}
                  agent={decisionsDemo.stepUp.agent}
                  category={decisionsDemo.stepUp.category}
                  amount={decisionsDemo.stepUp.amount}
                  constraint={decisionsDemo.stepUp.constraint}
                  mandateRef={decisionsDemo.stepUp.mandateRef}
                  status="stepup"
                  stamp={
                    <div data-stamp="stepup">
                      <DecisionStamp tone="red">STEP-UP REQUIRED</DecisionStamp>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Right Restrained Annotation */}
            <div className={styles.laneOutcome} data-note="stepup">
              <span className={styles.outcomeLine}>INTERRUPTION</span>
              <span className={styles.outcomeSub}>HELD FOR PERMISSION</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* LANE C: DENY (Blocked Merchant ₹799) */}
          {/* ------------------------------------------------------------- */}
          <div
            className={`${styles.lane} ${styles.laneDeny}`}
            data-lane="deny"
            aria-label="Deny outcome: Blocked Merchant"
          >
            {/* Left Lane Identity */}
            <div className={styles.laneIdentity}>
              <span className={styles.laneLetter} data-lane-letter="deny">C</span>
              <div className={styles.laneTagWrap}>
                <strong className={`${styles.laneTag} ${styles.tagDeny}`} data-lane-tag="deny">
                  DENY
                </strong>
                <span className={styles.laneRule} data-lane-rule="deny">INCOMPLETION</span>
              </div>
            </div>

            {/* Film Sprocket Perforations */}
            <div className={styles.sprocketTrack} data-lane-sprockets aria-hidden="true">
              <div className={styles.sprocketRow} />
            </div>

            {/* Travel Path & Receipt Carriage */}
            <div className={styles.trackContainer} data-lane-track>
              {/* Terminated Route Track (route cut off before destination) */}
              <div className={styles.trackLineTerminated} data-lane-track-line="deny" />
              <div
                className={styles.trackRemainingVoid}
                data-track-remaining="deny"
                aria-hidden="true"
              />
              {/* Physical Route Sever Barrier */}
              <div className={styles.routeBarrier} data-barrier="deny" aria-hidden="true">
                <span className={styles.barrierTick} />
                <span className={styles.barrierLabel}>ROUTE TERMINATED</span>
                <span className={styles.barrierTick} />
              </div>
              <div className={styles.receiptCarriage} data-receipt-wrap="deny">
                <TransactionReceipt
                  id={decisionsDemo.deny.id}
                  agent={decisionsDemo.deny.agent}
                  category={decisionsDemo.deny.category}
                  amount={decisionsDemo.deny.amount}
                  constraint={decisionsDemo.deny.constraint}
                  mandateRef={decisionsDemo.deny.mandateRef}
                  status="denied"
                  stamp={
                    <div data-stamp="deny">
                      <DecisionStamp tone="red">DENIED</DecisionStamp>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Right Restrained Annotation */}
            <div className={styles.laneOutcome} data-note="deny">
              <span className={styles.outcomeLine}>INCOMPLETION</span>
              <span className={styles.outcomeSub}>UNAUTHORIZED ACTION</span>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Administrative Bar */}
        <footer className={styles.sceneFooter} data-decisions-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>FRAME BETTER CHOICES</span>
          <span className={styles.footerCode}>DECISION DISPATCH // 02</span>
        </footer>
      </div>
    </section>
  );
}
