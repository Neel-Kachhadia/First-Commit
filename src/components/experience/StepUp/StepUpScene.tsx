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

      // Single Travel Artifact, compact slip form at scene start.
      gsap.set("[data-travel-artifact]", { opacity: 1, width: compactWidth });
      // Desktop: the 03->04 film parks the slip at the far-left of the frame
      // (right edge at ~26.4% of the 1280px video frame, object-fit: cover).
      // Mirror that geometry so the live slip starts exactly under the video's
      // last frame. Mobile bypasses the film, so it starts at its own rest.
      // Film geometry (measured from the approved 03->04 / 04->05 clips) that
      // the live slip must line up with at each seam. Desktop only: mobile
      // bypasses the films entirely.
      const IN_FILM = { w: 1280, h: 720, slipRight: 338, slipCy: 366, slipH: 274, key: "03-04" };
      const OUT_FILM = { w: 1920, h: 1080, slipLeft: 1365, slipW: 506, slipCy: 566.4, key: "04-05" };
      const LIVE_COMPACT_H = 302; // compact slip box height, css px
      const LIVE_PAPER_H = 289; // visible paper height of the compact slip
      const CLEARED_BADGE_H = 28;

      // Real film box: the layer sits under the navbar, so its cover-fit
      // differs from the raw viewport. Values are measured at refresh time.
      const filmBox = (key: string, fw: number, fh: number) => {
        const box = document.querySelector<HTMLElement>(`video[src*="${key}"]`)?.getBoundingClientRect();
        const bw = box?.width || window.innerWidth;
        const bh = box?.height || window.innerHeight;
        const s = Math.max(bw / fw, bh / fh);
        return {
          s,
          ox: (box?.left ?? 0) - (fw * s - bw) / 2,
          oy: (box?.top ?? 0) - (fh * s - bh) / 2,
        };
      };
      // The station is untransformed static layout; the compact slip is
      // centred on it. GSAP scales the carrier about its top-left corner, so
      // targets are expressed as that corner's displacement.
      const stationCenter = () => {
        const r = root.current?.querySelector<HTMLElement>("[data-clearance-station]")?.getBoundingClientRect();
        return {
          cx: r ? r.left + r.width / 2 : window.innerWidth / 2,
          cy: r ? r.top + r.height / 2 : window.innerHeight / 2,
        };
      };
      // Live slip laid exactly over the 03->04 film's last frame.
      const parkedFrame = () => {
        // No film on mobile: the slip slides in level with the datum from the
        // left edge, never crossing the registration bar.
        if (isMobile) return { x: -(compactWidth - 50), y: 0, scale: 1 };
        const f = filmBox(IN_FILM.key, IN_FILM.w, IN_FILM.h);
        const c = stationCenter();
        const scale = (IN_FILM.slipH * f.s) / LIVE_PAPER_H;
        return {
          x: f.ox + IN_FILM.slipRight * f.s - scale * compactWidth - (c.cx - compactWidth / 2),
          y: f.oy + IN_FILM.slipCy * f.s - scale * (LIVE_COMPACT_H / 2) - (c.cy - LIVE_COMPACT_H / 2),
          scale,
        };
      };
      // Cleared slip (compact + badge) laid over the 04->05 film's first frame.
      const releasedFrame = () => {
        const c = stationCenter();
        const h = LIVE_COMPACT_H + CLEARED_BADGE_H;
        // No film on mobile: release the cleared slip straight down and fully
        // out of frame, rather than parking it half-cropped over the footer.
        if (isMobile) return { x: 0, y: window.innerHeight - (c.cy - h / 2) + 8, scale: 1 };
        const f = filmBox(OUT_FILM.key, OUT_FILM.w, OUT_FILM.h);
        const scale = (OUT_FILM.slipW * f.s) / compactWidth;
        return {
          x: f.ox + OUT_FILM.slipLeft * f.s - (c.cx - compactWidth / 2),
          y: f.oy + OUT_FILM.slipCy * f.s - scale * (h / 2) - (c.cy - h / 2),
          scale,
        };
      };

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

      // The live slip starts parked where the 03->04 film leaves it and is
      // caught at the datum by the interception beat below.
      //
      // =========================================================================
      // STAGE A — OPENING HOLD (0.00 - 0.05)
      // =========================================================================
      timeline.set({}, {}, 0.05);

      // =========================================================================
      // STAGE B — CLEARANCE BOUNDARY ENCOUNTER & PHYSICAL INTERCEPTION (0.05 - 0.17)
      // Controlled deceleration into datum. Physical catch: registration bar engages.
      // =========================================================================
      timeline
        .fromTo(
          "[data-stepup-travel-carrier]",
          {
            x: () => parkedFrame().x,
            y: () => parkedFrame().y,
            scaleX: () => parkedFrame().scale,
            scaleY: () => parkedFrame().scale,
          },
          { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.12, ease: "power2.inOut", immediateRender: true },
          0.05,
        )
        .to(
          "[data-registration-bar]",
          { borderColor: "rgba(169, 42, 36, 0.95)", boxShadow: "0 0 12px rgba(169, 42, 36, 0.35)", duration: 0.05 },
          0.12,
        );

      // =========================================================================
      // STAGE C — DOCUMENT BACKING EXPANSION AROUND OPTICALLY FIXED SPINE (0.17 - 0.37)
      // Official backing stock unrolls above and below the shared identity spine
      // (TRAVEL AGENT, TX-1082, ₹4,900), which stays optically fixed and centered.
      // =========================================================================
      timeline
        .to(
          "[data-travel-artifact]",
          { width: expandedWidth, duration: 0.18, ease: "power2.inOut" },
          0.17,
        )
        .to(
          "[data-doc-top-extension]",
          { height: topTargetHeight, opacity: 1, duration: 0.16, ease: "power2.inOut" },
          0.18,
        )
        .to(
          "[data-doc-bottom-extension]",
          { height: bottomTargetHeight, opacity: 1, duration: 0.18, ease: "power2.inOut" },
          0.18,
        )
        .to(
          "[data-compact-doc-type]",
          { opacity: 0, duration: 0.06 },
          0.19,
        )
        .to(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider]",
          { opacity: 1, y: 0, duration: 0.10, ease: "power2.out" },
          0.23,
        )
        .to(
          "[data-comparison-ledger]",
          { opacity: 1, y: 0, duration: 0.10, ease: "power2.out" },
          0.25,
        )
        .to(
          "[data-doc-footer], [data-corner-mark]",
          { opacity: 1, duration: 0.08, ease: "power1.out" },
          0.29,
        );

      // Mobile only: the expanded document fills the viewport and pushes the
      // registration bar / bracket into the chapter chrome, so the header and
      // footer yield while it is open (the navbar keeps the chapter label).
      if (isMobile) {
        timeline
          .to("[data-stepup-header], [data-stepup-footer]", { opacity: 0, duration: 0.05, ease: "power1.out" }, 0.17)
          .to("[data-stepup-header], [data-stepup-footer]", { opacity: 1, duration: 0.05, ease: "power1.in" }, 0.80);
      }

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
        );

      // =========================================================================
      // STAGE E — ACTION CONTROLS & CLEAR ONCE AUTHORIZATION (0.45 - 0.68; seal stays readable 0.61 - 0.68)
      // Controls resolve. CLEAR ONCE seal strikes onto the document.
      // =========================================================================
      timeline
        .fromTo(
          "[data-action-controls]",
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.08, ease: "power2.out" },
          0.45,
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
        );

      // =========================================================================
      // STAGE F — RELEASE CAUSALITY & RECONTRACTION (0.68 - 0.82)
      // 1. Bracket unlocks & lifts
      // 2. Secondary administrative fields retract
      // 3. Backing stock recedes back around the identity spine into compact slip
      // 4. Stamped clearance badge appears on the compact slip
      // =========================================================================
      timeline
        .to(
          "[data-registration-bar]",
          { y: -14, opacity: 0.35, borderColor: "rgba(235, 225, 201, 0.2)", duration: 0.05, ease: "power2.in" },
          0.68,
        )
        .to(
          "[data-clearance-bracket]",
          { y: 14, opacity: 0.35, borderColor: "rgba(235, 225, 201, 0.2)", duration: 0.05, ease: "power2.in" },
          0.68,
        )
        .to(
          "[data-doc-header-title], [data-doc-pictogram], [data-doc-divider], [data-comparison-ledger], [data-action-controls], [data-doc-footer], [data-corner-mark], [data-referral-notice]",
          { opacity: 0, y: -4, duration: 0.04, ease: "power1.in" },
          0.69,
        )
        .to(
          "[data-doc-top-extension]",
          { height: 0, opacity: 0, duration: 0.11, ease: "power2.inOut" },
          0.70,
        )
        .to(
          "[data-doc-bottom-extension]",
          { height: 0, opacity: 0, duration: 0.11, ease: "power2.inOut" },
          0.70,
        )
        .to(
          "[data-travel-artifact]",
          { width: compactWidth, duration: 0.11, ease: "power2.inOut" },
          0.70,
        )
        .to(
          "[data-compact-cleared-badge]",
          { height: 28, opacity: 1, duration: 0.05, ease: "power2.out" },
          0.77,
        );

      // =========================================================================
      // STAGE G — DOWNSTREAM RELEASE (0.80 - 0.92)
      // Retained tension releases -> SAME compact card accelerates downstream
      // toward the 04->05 transition's own opening frame.
      // =========================================================================
      timeline.to(
        "[data-stepup-travel-carrier]",
        {
          x: () => releasedFrame().x,
          y: () => releasedFrame().y,
          scaleX: () => releasedFrame().scale,
          scaleY: () => releasedFrame().scale,
          duration: 0.12,
          ease: "power2.inOut",
        },
        0.80,
      );

      // =========================================================================
      // STAGE H — TERMINAL HOLD (0.92 - 1.00)
      // =========================================================================
      timeline.set({}, {}, 1.0);

      // Status text: single writer, a pure function of timeline progress so it
      // stays coherent under reverse scrub and direct jumps.
      timeline.eventCallback("onUpdate", () => {
        if (!barStatusEl) return;
        const p = timeline.progress();
        barStatusEl.textContent =
          p < 0.12
            ? "CLEARANCE DATUM // READY"
            : p < 0.37
              ? "HELD AT DATUM // LIMIT EXCEEDED"
              : p < 0.45
                ? "HELD FOR CLEARANCE // ₹4,900 > ₹3,000"
                : p < 0.55
                  ? "REFER FOR APPROVAL // ROUTE OPEN"
                  : "ONE-TIME CLEARANCE GRANTED // RELEASED";
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
