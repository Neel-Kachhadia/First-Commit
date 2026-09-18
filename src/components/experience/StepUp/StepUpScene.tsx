"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { stepUpDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { ClearanceDocument } from "@/components/documents/ClearanceDocument";
import styles from "./StepUpScene.module.css";

type StepUpSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function StepUpScene({ trackRef }: StepUpSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const prefersReduced = experienceStore.getState().reducedMotion;

      // Coordinate target for the outgoing 04->05 exit only (see travelGeometry).
      const fallbackExitX = isMobile ? 0 : 550;
      const fallbackExitY = isMobile ? 320 : 0;

      if (prefersReduced) {
        if (root.current) {
          root.current.style.visibility = "visible";
          root.current.style.pointerEvents = "auto";
        }
        if (stageRef.current) {
          stageRef.current.style.visibility = "visible";
        }

        // Reduced motion: Show complete static record with full document, stamps, and route
        gsap.set("[data-stepup-header]", { opacity: 1, y: 0 });
        gsap.set("[data-stepup-footer]", { opacity: 1, y: 0 });
        gsap.set("[data-execution-route]", { opacity: 1 });
        gsap.set("[data-stepup-travel-carrier]", { opacity: 1, scale: 1, x: 0, y: 0 });
        gsap.set("[data-travel-artifact]", { opacity: 1, width: isMobile ? 360 : 560 });
        gsap.set("[data-doc-top-extension]", { height: isMobile ? 85 : 95, opacity: 1 });
        gsap.set("[data-doc-bottom-extension]", { height: isMobile ? 410 : 360, opacity: 1 });
        gsap.set(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider], [data-comparison-ledger], [data-action-controls], [data-doc-footer], [data-corner-mark]",
          { opacity: 1, y: 0 },
        );
        gsap.set("[data-compact-doc-type]", { opacity: 0 });
        gsap.set("[data-compact-cleared-badge]", { height: 0, opacity: 0 });
        gsap.set("[data-registration-bar]", { opacity: 1, y: 0 });
        gsap.set("[data-clearance-bracket]", { opacity: 1, y: 0 });
        gsap.set("[data-hold-stamp]", { opacity: 1, scale: 1 });
        gsap.set("[data-referral-notice]", { opacity: 1 });
        gsap.set("[data-action-controls]", { opacity: 1 });
        gsap.set("[data-clear-seal]", { opacity: 1, scale: 1 });
        return;
      }

      if (!root.current || !stageRef.current) return;

      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='step-up']" : root.current);

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
          end: isPersistent ? "bottom top" : "+=320%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("stepUp", self.progress);
          },
        },
      });

      const travelCarrier = root.current.querySelector<HTMLElement>(
        "[data-stepup-travel-carrier]",
      );
      function setTravelCarrierOwned(owned: boolean) {
        if (!travelCarrier) return;
        gsap.set(travelCarrier, {
          visibility: owned ? "inherit" : "hidden",
          opacity: owned ? 1 : 0,
        });
      }

      // Body visibility stays exact; chapter chrome remains scene-owned.
      // start uses a 1px epsilon (not an authored overlap) — GSAP's onEnter for a
      // non-scrubbed trigger requires progress to strictly exceed 0, so landing
      // exactly on the boundary pixel would otherwise leave the body hidden until
      // 1px of further scroll (confirmed via direct probing; refresh() alone
      // does not fix it).
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          applyVisibility(true);
          setTravelCarrierOwned(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "stepUp" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          setTravelCarrierOwned(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "stepUp" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) {
            applyVisibility(false);
            setTravelCarrierOwned(false);
          }
        },
        onLeaveBack: () => {
          applyVisibility(false);
          setTravelCarrierOwned(false);
        },
      });

      // Exit offset only: the incoming 03->04 transition already lands with
      // the compact travel slip arrived and centered at the clearance datum
      // (its own terminal content) — the live scene begins there, not
      // off-screen. Only the OUTGOING 04->05 hop still uses a fixed offset,
      // since that boundary's own video owns the departure look.
      const travelGeometry = {
        exitX: fallbackExitX,
        exitY: fallbackExitY,
        exitScaleX: 1,
        exitScaleY: 1,
      };
      setTravelCarrierOwned(false);

      // Dynamic text targets for status bar
      const barStatusEl = root.current.querySelector<HTMLElement>("[data-bar-status]");

      // Dimensions for responsive compact slip and expanded document
      const compactWidth = isMobile ? 340 : 410;
      const expandedWidth = isMobile ? 360 : 560;
      const topTargetHeight = isMobile ? 85 : 95;
      const bottomTargetHeight = isMobile ? 410 : 360;

      // Initial state setup for deterministic scrub:
      // Scene title is ordinary scene-owned typography, never a carrier.
      gsap.set("[data-stepup-header]", { opacity: 1, y: 0 });
      gsap.set("[data-stepup-footer]", { opacity: 1, y: 0 });
      gsap.set("[data-execution-route]", { opacity: 1 });
      gsap.set("[data-registration-bar]", { opacity: 1, y: 0 });
      gsap.set("[data-clearance-bracket]", { opacity: 1, y: 0 });

      // Single Travel Artifact: incoming 03->04 transition already lands with
      // the compact slip arrived and centered at the clearance datum — start
      // there, matching the transition's terminal frame exactly.
      gsap.set("[data-travel-artifact]", { opacity: 1, width: compactWidth });
      gsap.set("[data-stepup-travel-carrier]", {
        x: isMobile ? 0 : -80,
        y: isMobile ? -60 : 0,
        scaleX: 1,
        scaleY: 1,
      });

      // Top and bottom extensions start collapsed into the compact slip format
      gsap.set("[data-doc-top-extension]", {
        height: 0,
        opacity: 0,
        overflow: "hidden",
      });
      gsap.set("[data-doc-bottom-extension]", {
        height: 0,
        opacity: 0,
        overflow: "hidden",
      });
      gsap.set("[data-compact-cleared-badge]", {
        height: 0,
        opacity: 0,
        overflow: "hidden",
      });
      gsap.set("[data-compact-doc-type]", {
        opacity: 1,
      });

      // Secondary administrative fields start hidden inside their extensions
      gsap.set(
        "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider], [data-comparison-ledger], [data-action-controls], [data-doc-footer], [data-corner-mark]",
        {
          opacity: 0,
          y: -4,
        },
      );
      gsap.set("[data-hold-stamp]", {
        opacity: 0,
        scale: 1.35,
        rotation: -5,
      });
      gsap.set("[data-referral-notice]", { opacity: 0, y: 4 });
      gsap.set("[data-clear-seal]", { opacity: 0, scale: 1.25 });

      // Incoming 03->04 transition already lands with the compact slip
      // arrived at the clearance datum (its own terminal content) — no entry
      // animation to replay. Live scene begins at the physical interception.
      //
      // =========================================================================
      // STAGE A — OPENING HOLD (0.00 - 0.05)
      // =========================================================================
      timeline.set({}, {}, 0.05);

      // =========================================================================
      // STAGE B — CLEARANCE BOUNDARY ENCOUNTER & PHYSICAL INTERCEPTION (0.05 - 0.15)
      // Controlled deceleration into datum. Physical catch: registration bar engages.
      // =========================================================================
      timeline
        .to(
          "[data-stepup-travel-carrier]",
          { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.08, ease: "power3.out" },
          0.05,
        )
        .to(
          "[data-registration-bar]",
          { borderColor: "rgba(169, 42, 36, 0.95)", boxShadow: "0 0 12px rgba(169, 42, 36, 0.35)", duration: 0.05 },
          0.09,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "HELD AT DATUM // LIMIT EXCEEDED";
          },
          undefined,
          0.11,
        );

      // =========================================================================
      // STAGE C — DOCUMENT BACKING EXPANSION AROUND OPTICALLY FIXED SPINE (0.15 - 0.37)
      // Official backing stock unrolls above and below the shared identity spine
      // (TRAVEL AGENT, TX-1082, ₹4,900), which stays optically fixed and centered.
      // =========================================================================
      timeline
        .to(
          "[data-travel-artifact]",
          { width: expandedWidth, duration: 0.18, ease: "power2.inOut" },
          0.15,
        )
        .to(
          "[data-doc-top-extension]",
          { height: topTargetHeight, opacity: 1, duration: 0.16, ease: "power2.inOut" },
          0.16,
        )
        .to(
          "[data-doc-bottom-extension]",
          { height: bottomTargetHeight, opacity: 1, duration: 0.18, ease: "power2.inOut" },
          0.16,
        )
        .to(
          "[data-compact-doc-type]",
          { opacity: 0, duration: 0.06 },
          0.17,
        )
        .to(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider]",
          { opacity: 1, y: 0, duration: 0.10, ease: "power2.out" },
          0.21,
        )
        .to(
          "[data-comparison-ledger]",
          { opacity: 1, y: 0, duration: 0.10, ease: "power2.out" },
          0.23,
        )
        .to(
          "[data-doc-footer], [data-corner-mark]",
          { opacity: 1, duration: 0.08, ease: "power1.out" },
          0.27,
        );

      // =========================================================================
      // STAGE D — HOLD STAMP IMPACT ON SETTLED BACKING STOCK (0.37 - 0.45)
      // Stamp impacts firmly. Backing stock is already physically resting.
      // =========================================================================
      timeline
        .fromTo(
          "[data-hold-stamp]",
          { opacity: 0, scale: 1.35, rotation: -6 },
          { opacity: 1, scale: 1, rotation: -3, duration: 0.04, ease: "power3.out" },
          0.37,
        )
        .fromTo(
          "[data-referral-notice]",
          { opacity: 0, y: 4 },
          { opacity: 1, y: 0, duration: 0.04, ease: "power2.out" },
          0.41,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "HELD FOR CLEARANCE // ₹4,900 > ₹3,000";
          },
          undefined,
          0.39,
        );

      // =========================================================================
      // STAGE E — ACTION CONTROLS & CLEAR ONCE AUTHORIZATION (0.45 - 0.63)
      // Controls resolve. CLEAR ONCE seal strikes onto the document.
      // =========================================================================
      timeline
        .fromTo(
          "[data-action-controls]",
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.08, ease: "power2.out" },
          0.45,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "REFER FOR APPROVAL // ROUTE OPEN";
          },
          undefined,
          0.51,
        )
        .fromTo(
          "[data-clear-seal]",
          { opacity: 0, scale: 1.3 },
          { opacity: 1, scale: 1, duration: 0.06, ease: "power2.out" },
          0.55,
        )
        .to(
          "[data-action-clear-box]",
          { backgroundColor: "rgba(169, 42, 36, 0.14)", borderColor: "var(--kp-red)", duration: 0.04 },
          0.59,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "ONE-TIME CLEARANCE GRANTED // RELEASED";
          },
          undefined,
          0.61,
        );

      // =========================================================================
      // STAGE F — RELEASE CAUSALITY & RECONTRACTION (0.63 - 0.73)
      // 1. Bracket unlocks & lifts
      // 2. Secondary administrative fields retract
      // 3. Backing stock recedes back around the identity spine into compact slip
      // 4. Stamped clearance badge appears on the compact slip
      // =========================================================================
      timeline
        .to(
          "[data-registration-bar]",
          { y: -14, opacity: 0.35, borderColor: "rgba(235, 225, 201, 0.2)", duration: 0.05, ease: "power2.in" },
          0.63,
        )
        .to(
          "[data-clearance-bracket]",
          { y: 14, opacity: 0.35, borderColor: "rgba(235, 225, 201, 0.2)", duration: 0.05, ease: "power2.in" },
          0.63,
        )
        .to(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider], [data-comparison-ledger], [data-action-controls], [data-doc-footer], [data-corner-mark], [data-referral-notice]",
          { opacity: 0, y: -4, duration: 0.04, ease: "power1.in" },
          0.64,
        )
        .to(
          "[data-doc-top-extension]",
          { height: 0, opacity: 0, duration: 0.07, ease: "power2.inOut" },
          0.66,
        )
        .to(
          "[data-doc-bottom-extension]",
          { height: 0, opacity: 0, duration: 0.07, ease: "power2.inOut" },
          0.66,
        )
        .to(
          "[data-travel-artifact]",
          { width: compactWidth, duration: 0.07, ease: "power2.inOut" },
          0.66,
        )
        .to(
          "[data-compact-cleared-badge]",
          { height: 28, opacity: 1, duration: 0.04, ease: "power2.out" },
          0.70,
        );

      // =========================================================================
      // STAGE G — DOWNSTREAM ACCELERATION (0.73 - 0.83)
      // Retained tension releases -> SAME compact card accelerates downstream
      // toward the 04->05 transition's own opening frame.
      // =========================================================================
      timeline.to(
        "[data-stepup-travel-carrier]",
        {
          x: () => travelGeometry.exitX,
          y: () => travelGeometry.exitY,
          scaleX: () => travelGeometry.exitScaleX,
          scaleY: () => travelGeometry.exitScaleY,
          duration: 0.10,
          ease: "power2.in",
        },
        0.73,
      );

      // =========================================================================
      // STAGE H — TERMINAL HOLD (0.83 - 1.00)
      // =========================================================================
      timeline.set({}, {}, 1.0);

      // Deterministic reverse scrub status text updates
      timeline.eventCallback("onUpdate", () => {
        const p = timeline.progress();
        if (barStatusEl) {
          if (p < 0.07) {
            barStatusEl.textContent = "CLEARANCE DATUM // READY";
          } else if (p < 0.37) {
            barStatusEl.textContent = "HELD AT DATUM // LIMIT EXCEEDED";
          } else if (p < 0.55) {
            barStatusEl.textContent = "REFER FOR APPROVAL // ROUTE OPEN";
          } else {
            barStatusEl.textContent = "ONE-TIME CLEARANCE GRANTED // RELEASED";
          }
        }
      });

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
      data-scene="step-up"
      aria-labelledby="stepup-scene-title"
    >
      <div ref={stageRef} className={styles.stage} data-stepup-stage>
        {/* Scene-owned chapter header. Physical transition continuity lives in TX-1082. */}
        <div className={styles.topArea}>
          <header className={styles.sceneHeader} data-stepup-header>
            <div className={styles.headerLeft}>
              <span className={styles.sceneIndex}>04</span>
              <span className={styles.headerDivider}>/</span>
              <h2 id="stepup-scene-title" className={styles.headerTitle}>
                STEP-UP
              </h2>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.headerSub}>{stepUpDemo.clearance.microcopy.split(".")[0]}.</span>
              <span className={styles.headerMeta}>{stepUpDemo.clearance.microcopy.split(".")[1]?.trim() || "HUMAN CLEARANCE."}</span>
            </div>
          </header>
        </div>

        {/* Main Composition Arena: Execution Rails & Clearance Station */}
        <div className={styles.arena} data-stepup-arena>
          {/* Persistent Execution Rails (Never removed — proves STEP-UP ≠ DENY) */}
          <div className={styles.executionRoute} data-execution-route aria-hidden="true">
            <div className={styles.routeTrack}>
              <div className={`${styles.railLine} ${styles.railLineTop}`} />
              <div className={styles.railCenterDashes} />
              <div className={`${styles.railLine} ${styles.railLineBottom}`} />
              <span className={styles.trackLabelUpstream}>UPSTREAM ENTRY // INTENT DISPATCH</span>
              <div className={styles.trackLabelDownstream}>
                <span className={styles.downstreamActivePulse} />
                <span>DOWNSTREAM EXECUTION PATH // ROUTE INTACT</span>
              </div>
            </div>
          </div>

          {/* Administrative Clearance Station (Registration Bar & Locking Datum) */}
          <div className={styles.clearanceStation} data-clearance-station>
            <div className={styles.lockingDatumLeft} />
            <div className={styles.lockingDatumRight} />

            {/* Top Registration Bar (The Paper Hold Gate) */}
            <div className={styles.registrationBar} data-registration-bar>
              <span className={styles.barTag}>LIMIT DATUM // ₹3,000 AUTO-CLEARANCE</span>
              <span className={styles.barStatus} data-bar-status>
                CLEARANCE DATUM // READY
              </span>
            </div>

            {/* The Travel Artifact: Single continuous document that unfolds around its shared identity spine */}
            <div className={styles.travelArtifactContainer} data-stepup-travel-carrier>
              <div className={styles.fullDocumentWrap} data-travel-artifact data-active-slip data-full-doc-wrap>
                <ClearanceDocument
                  id={stepUpDemo.request.id}
                  agent={stepUpDemo.request.agent}
                  category={stepUpDemo.request.category}
                  amount={stepUpDemo.request.amount}
                  limit={stepUpDemo.clearance.automaticLimit}
                  requestedAuthority={stepUpDemo.clearance.requestedAuthority}
                  autoClearanceLimit={stepUpDemo.clearance.autoClearanceLimit}
                  excessAmount={stepUpDemo.clearance.excessAmount}
                  reference={stepUpDemo.request.reference}
                  mandateRef={stepUpDemo.request.mandateRef}
                  route={stepUpDemo.request.route}
                  holdStamp={
                    <div className={styles.stampHold} data-hold-stamp>
                      <span className={styles.stampHoldText}>{stepUpDemo.clearance.holdStamp}</span>
                    </div>
                  }
                  clearOnceSeal={
                    <div className={styles.clearOnceToken} data-clear-seal>
                      <span>CLEARED // SINGLE USE</span>
                      <span>{stepUpDemo.request.id} (₹4,900)</span>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Bottom Clearance Bracket / Locking Datum */}
            <div className={styles.clearanceBracket} data-clearance-bracket>
              <span>AUTONOMOUS EXECUTION SUSPENDED</span>
              <span>DATUM 04 // CLEARANCE LEVEL REQUIRED</span>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Administrative Bar */}
        <footer className={styles.sceneFooter} data-stepup-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>MONETARY CONTROL PLANE</span>
          <span className={styles.footerCode}>STEP-UP CLEARANCE // 04</span>
        </footer>
      </div>
    </section>
  );
}
