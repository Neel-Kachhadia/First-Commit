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

      // Coordinate targets for entry and exit
      const entryStartX = isMobile ? 0 : -550;
      const entryStartY = isMobile ? -320 : 0;
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
      function setTravelCarrierMode(mode: "hidden" | "bridge" | "scene") {
        if (!travelCarrier) return;
        if (mode === "hidden") {
          gsap.set(travelCarrier, { visibility: "hidden", opacity: 0 });
          return;
        }
        gsap.set(travelCarrier, {
          visibility: mode === "bridge" ? "visible" : "inherit",
          opacity: 1,
        });
      }

      // Body visibility stays exact. Only the physical Travel request carrier may
      // cross the adjacent ownership boundaries; chapter chrome remains scene-owned.
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
          setTravelCarrierMode("scene");
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "stepUp" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          setTravelCarrierMode("scene");
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "stepUp" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) {
            applyVisibility(false);
            setTravelCarrierMode("hidden");
          }
        },
        onLeaveBack: () => {
          applyVisibility(false);
          setTravelCarrierMode("bridge");
        },
      });

      const incomingTravel = document.querySelector<HTMLElement>("[data-delegation-grocery]");
      const downstreamTravel = document.querySelector<HTMLElement>("[data-record='TX-1082']");
      const travelGeometry = {
        entryX: entryStartX,
        entryY: entryStartY,
        entryScaleX: 1,
        entryScaleY: 1,
        exitX: fallbackExitX,
        exitY: fallbackExitY,
        exitScaleX: 1,
        exitScaleY: 1,
      };

      const cacheTravelGeometry = () => {
        if (!travelCarrier) return;

        gsap.set(travelCarrier, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          transformOrigin: "top left",
        });
        const base = travelCarrier.getBoundingClientRect();
        if (base.width <= 0 || base.height <= 0) return;

        if (incomingTravel) {
          const source = incomingTravel.getBoundingClientRect();
          travelGeometry.entryX = source.left - base.left;
          travelGeometry.entryY = source.top - base.top;
          travelGeometry.entryScaleX = source.width / base.width;
          travelGeometry.entryScaleY = source.height / base.height;
        }

        if (downstreamTravel) {
          const target = downstreamTravel.getBoundingClientRect();
          travelGeometry.exitX = target.left - base.left;
          travelGeometry.exitY = target.top - base.top;
          travelGeometry.exitScaleX = target.width / base.width;
          travelGeometry.exitScaleY = target.height / base.height;
        }
      };

      cacheTravelGeometry();
      ScrollTrigger.addEventListener("refreshInit", cacheTravelGeometry);

      // Incoming 03 -> 04 bridge. Geometry is measured only at init/refresh; the
      // compact TX-1082 copy occupies the outgoing pass's exact stage rectangle.
      gsap.set("[data-stepup-travel-carrier]", {
        opacity: 0,
        visibility: "hidden",
        pointerEvents: "none",
        transformOrigin: "top left",
      });
      const artifactBridgeIn = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=100px",
        end: "top top",
        scrub: true,
        onEnter: () => setTravelCarrierMode("bridge"),
        onEnterBack: () => setTravelCarrierMode("bridge"),
        onLeave: () => setTravelCarrierMode("scene"),
        onLeaveBack: () => setTravelCarrierMode("hidden"),
        onUpdate: (self) => {
          gsap.set("[data-stepup-travel-carrier]", { opacity: self.progress });
        },
      });

      // Outgoing 04 -> 05 bridge. Incoming Revocation copy is registered to this
      // terminal rectangle, making the technical DOM swap visually invisible.
      const artifactBridgeOut = ScrollTrigger.create({
        trigger: triggerEl,
        start: "bottom top+=120px",
        end: "bottom top",
        scrub: true,
        onEnter: () => setTravelCarrierMode("bridge"),
        onEnterBack: () => setTravelCarrierMode("bridge"),
        onLeave: () => setTravelCarrierMode("hidden"),
        onLeaveBack: () => setTravelCarrierMode("scene"),
        onUpdate: (self) => {
          gsap.set("[data-stepup-travel-carrier]", { opacity: 1 - self.progress });
        },
      });

      const syncTravelCarrierVisibility = () => {
        if (visibilityTrigger.isActive) {
          setTravelCarrierMode("scene");
        } else if (artifactBridgeIn.isActive || artifactBridgeOut.isActive) {
          setTravelCarrierMode("bridge");
        } else {
          setTravelCarrierMode("hidden");
        }
      };
      ScrollTrigger.addEventListener("refresh", syncTravelCarrierVisibility);

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

      // Single Travel Artifact: Starts as crisp, fully opaque compact request slip
      gsap.set("[data-travel-artifact]", { opacity: 1, width: compactWidth });
      gsap.set("[data-stepup-travel-carrier]", {
        x: travelGeometry.entryX,
        y: travelGeometry.entryY,
        scaleX: travelGeometry.entryScaleX,
        scaleY: travelGeometry.entryScaleY,
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

      // =========================================================================
      // BEAT 1: SCENE 03 → 04 REGISTRATION (0.00 - 0.04)
      // =========================================================================
      timeline
        .to(
          "[data-registration-bar]",
          { borderColor: "rgba(169, 42, 36, 0.75)", duration: 0.04, ease: "power1.out" },
          0.01,
        );

      // =========================================================================
      // BEAT 2: INCOMING TRAVEL REQUEST ENTERS WITH MOMENTUM (0.00 - 0.22)
      // Compact execution slip enters along upstream rail with crisp visibility and momentum.
      // =========================================================================
      timeline
        .fromTo(
          "[data-stepup-travel-carrier]",
          {
            x: () => travelGeometry.entryX,
            y: () => travelGeometry.entryY,
            scaleX: () => travelGeometry.entryScaleX,
            scaleY: () => travelGeometry.entryScaleY,
          },
          {
            x: isMobile ? 0 : -80,
            y: isMobile ? -60 : 0,
            scaleX: 1,
            scaleY: 1,
            duration: 0.22,
            ease: "power1.inOut",
          },
          0.00,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "CLEARANCE DATUM // READY";
          },
          undefined,
          0.06,
        );

      // =========================================================================
      // BEAT 3: CLEARANCE BOUNDARY ENCOUNTER & PHYSICAL INTERCEPTION (0.22 - 0.32)
      // Controlled deceleration into datum. Physical catch: registration bar engages.
      // =========================================================================
      timeline
        .to(
          "[data-stepup-travel-carrier]",
          {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            duration: 0.08,
            ease: "power3.out",
          },
          0.22,
        )
        .to(
          "[data-registration-bar]",
          {
            borderColor: "rgba(169, 42, 36, 0.95)",
            boxShadow: "0 0 12px rgba(169, 42, 36, 0.35)",
            duration: 0.05,
          },
          0.26,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "HELD AT DATUM // LIMIT EXCEEDED";
          },
          undefined,
          0.28,
        );

      // =========================================================================
      // BEAT 4: DOCUMENT BACKING EXPANSION AROUND OPTICALLY FIXED SPINE (0.32 - 0.54)
      // Official backing stock unrolls above and below the shared identity spine
      // (TRAVEL AGENT, TX-1082, ₹4,900), which stays optically fixed and centered.
      // By 0.52, the backing stock is completely settled before stamp impact.
      // =========================================================================
      timeline
        .to(
          "[data-travel-artifact]",
          {
            width: expandedWidth,
            duration: 0.18,
            ease: "power2.inOut",
          },
          0.32,
        )
        .to(
          "[data-doc-top-extension]",
          {
            height: topTargetHeight,
            opacity: 1,
            duration: 0.16,
            ease: "power2.inOut",
          },
          0.33,
        )
        .to(
          "[data-doc-bottom-extension]",
          {
            height: bottomTargetHeight,
            opacity: 1,
            duration: 0.18,
            ease: "power2.inOut",
          },
          0.33,
        )
        .to(
          "[data-compact-doc-type]",
          {
            opacity: 0,
            duration: 0.06,
          },
          0.34,
        )
        .to(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider]",
          {
            opacity: 1,
            y: 0,
            duration: 0.10,
            ease: "power2.out",
          },
          0.38,
        )
        .to(
          "[data-comparison-ledger]",
          {
            opacity: 1,
            y: 0,
            duration: 0.10,
            ease: "power2.out",
          },
          0.40,
        )
        .to(
          "[data-doc-footer], [data-corner-mark]",
          {
            opacity: 1,
            duration: 0.08,
            ease: "power1.out",
          },
          0.44,
        );

      // =========================================================================
      // BEAT 5: HOLD STAMP IMPACT ON SETTLED BACKING STOCK (0.54 - 0.62)
      // Stamp impacts firmly. Backing stock is already physically resting.
      // =========================================================================
      timeline
        .fromTo(
          "[data-hold-stamp]",
          { opacity: 0, scale: 1.35, rotation: -6 },
          { opacity: 1, scale: 1, rotation: -3, duration: 0.04, ease: "power3.out" },
          0.54,
        )
        .fromTo(
          "[data-referral-notice]",
          { opacity: 0, y: 4 },
          { opacity: 1, y: 0, duration: 0.04, ease: "power2.out" },
          0.58,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "HELD FOR CLEARANCE // ₹4,900 > ₹3,000";
          },
          undefined,
          0.56,
        );

      // =========================================================================
      // BEAT 6: ACTION CONTROLS & CLEAR ONCE AUTHORIZATION (0.62 - 0.80)
      // Controls resolve. CLEAR ONCE seal strikes onto the document.
      // =========================================================================
      timeline
        .fromTo(
          "[data-action-controls]",
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.08, ease: "power2.out" },
          0.62,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "REFER FOR APPROVAL // ROUTE OPEN";
          },
          undefined,
          0.68,
        )
        .fromTo(
          "[data-clear-seal]",
          { opacity: 0, scale: 1.3 },
          { opacity: 1, scale: 1, duration: 0.06, ease: "power2.out" },
          0.72,
        )
        .to(
          "[data-action-clear-box]",
          {
            backgroundColor: "rgba(169, 42, 36, 0.14)",
            borderColor: "var(--kp-red)",
            duration: 0.04,
          },
          0.76,
        )
        .call(
          () => {
            if (barStatusEl) barStatusEl.textContent = "ONE-TIME CLEARANCE GRANTED // RELEASED";
          },
          undefined,
          0.78,
        );

      // =========================================================================
      // BEAT 7: RELEASE CAUSALITY & RECONTRACTION (0.80 - 0.90)
      // 1. Bracket unlocks & lifts
      // 2. Secondary administrative fields retract
      // 3. Backing stock recedes back around the identity spine into compact slip
      // 4. Stamped clearance badge appears on the compact slip
      // =========================================================================
      timeline
        // 1. Bracket unlocks & lifts
        .to(
          "[data-registration-bar]",
          {
            y: -14,
            opacity: 0.35,
            borderColor: "rgba(235, 225, 201, 0.2)",
            duration: 0.05,
            ease: "power2.in",
          },
          0.80,
        )
        .to(
          "[data-clearance-bracket]",
          {
            y: 14,
            opacity: 0.35,
            borderColor: "rgba(235, 225, 201, 0.2)",
            duration: 0.05,
            ease: "power2.in",
          },
          0.80,
        )
        // 2. Secondary fields retract
        .to(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider], [data-comparison-ledger], [data-action-controls], [data-doc-footer], [data-corner-mark], [data-referral-notice]",
          {
            opacity: 0,
            y: -4,
            duration: 0.04,
            ease: "power1.in",
          },
          0.81,
        )
        // 3. Extensions collapse & width contracts back
        .to(
          "[data-doc-top-extension]",
          {
            height: 0,
            opacity: 0,
            duration: 0.07,
            ease: "power2.inOut",
          },
          0.83,
        )
        .to(
          "[data-doc-bottom-extension]",
          {
            height: 0,
            opacity: 0,
            duration: 0.07,
            ease: "power2.inOut",
          },
          0.83,
        )
        .to(
          "[data-travel-artifact]",
          {
            width: compactWidth,
            duration: 0.07,
            ease: "power2.inOut",
          },
          0.83,
        )
        // 4. Stamped clearance badge appears on the compact slip
        .to(
          "[data-compact-cleared-badge]",
          {
            height: 28,
            opacity: 1,
            duration: 0.04,
            ease: "power2.out",
          },
          0.87,
        );

      // =========================================================================
      // BEAT 8: DOWNSTREAM ACCELERATION (0.90 - 1.00)
      // Retained tension releases -> SAME compact card accelerates downstream!
      // =========================================================================
      timeline
        .to(
          "[data-stepup-travel-carrier]",
          {
            x: () => travelGeometry.exitX,
            y: () => travelGeometry.exitY,
            scaleX: () => travelGeometry.exitScaleX,
            scaleY: () => travelGeometry.exitScaleY,
            duration: 0.10,
            ease: "power2.in",
          },
          0.90,
        )
        .set({}, {}, 1.0);

      // Deterministic reverse scrub status text updates
      timeline.eventCallback("onUpdate", () => {
        const p = timeline.progress();
        if (barStatusEl) {
          if (p < 0.24) {
            barStatusEl.textContent = "CLEARANCE DATUM // READY";
          } else if (p < 0.54) {
            barStatusEl.textContent = "HELD AT DATUM // LIMIT EXCEEDED";
          } else if (p < 0.72) {
            barStatusEl.textContent = "REFER FOR APPROVAL // ROUTE OPEN";
          } else {
            barStatusEl.textContent = "ONE-TIME CLEARANCE GRANTED // RELEASED";
          }
        }
      });

      return () => {
        visibilityTrigger.kill();
        artifactBridgeIn.kill();
        artifactBridgeOut.kill();
        ScrollTrigger.removeEventListener("refreshInit", cacheTravelGeometry);
        ScrollTrigger.removeEventListener("refresh", syncTravelCarrierVisibility);
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
