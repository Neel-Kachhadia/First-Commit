"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { revocationDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { AuthorityRegisterRecord } from "@/components/documents/AuthorityRegisterRecord";
import styles from "./RevocationScene.module.css";

type RevocationSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function RevocationScene({ trackRef }: RevocationSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const barRecallStatusRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const prefersReduced = experienceStore.getState().reducedMotion;

      // Coordinate targets for mechanical spine withdrawal
      const spineWithdrawX = isMobile ? -180 : -280;
      const travelAdvanceX = isMobile ? 16 : 28;

      if (prefersReduced) {
        if (root.current) {
          root.current.style.visibility = "visible";
          root.current.style.pointerEvents = "auto";
        }
        if (stageRef.current) {
          stageRef.current.style.visibility = "visible";
        }

        // Reduced motion: Show complete final historical state
        gsap.set("[data-revocation-header]", { opacity: 1 });
        gsap.set("[data-revocation-footer]", { opacity: 1 });
        gsap.set("[data-register-station]", { opacity: 1, scale: 1 });
        gsap.set("[data-source-spine]", { x: spineWithdrawX, opacity: 0.8 });
        gsap.set("[data-notch-status]", { innerText: "WITHDRAWN" });
        gsap.set("[data-notch-bar]", { scaleY: 0.35, x: -3 });
        gsap.set("[data-stamp-revoked]", { opacity: 1, scale: 1 });
        gsap.set("[data-state-value='AUTH-0301']", {
          innerText: "REVOKED",
          color: "var(--kp-red)",
        });
        gsap.set("[data-inherited-register='AUTH-0302'], [data-inherited-register='AUTH-0303']", {
          x: -4,
          borderColor: "rgba(169, 42, 36, 0.6)",
        });
        gsap.set("[data-record='AUTH-0302']", { y: 3, rotate: -0.4 });
        gsap.set("[data-record='AUTH-0303']", { y: 3, rotate: 0.3 });
        gsap.set("[data-stamp-withdrawn='AUTH-0302'], [data-stamp-withdrawn='AUTH-0303']", {
          opacity: 1,
          scale: 1,
        });
        gsap.set("[data-state-value='AUTH-0302'], [data-state-value='AUTH-0303']", {
          innerText: "WITHDRAWN",
          color: "var(--kp-red-dark)",
        });
        gsap.set("[data-independent-register='travel']", { x: travelAdvanceX });
        gsap.set("[data-state-value='TX-1082']", {
          innerText: "ACTIVE",
          color: "var(--kp-ink)",
        });
        return;
      }

      if (!root.current || !stageRef.current) return;

      const isPersistent = Boolean(trackRef);
      const triggerEl =
        trackRef?.current ?? (isPersistent ? "[data-track='revocation']" : root.current);

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
          end: isPersistent ? "bottom top" : "+=294%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("revocation", self.progress);
          },
        },
      });

      const travelRecord = root.current.querySelector<HTMLElement>("[data-record='TX-1082']");
      const travelLineage = root.current.querySelector<HTMLElement>(
        "[data-independent-register='travel']",
      );
      const setTravelRecordOwned = (owned: boolean) => {
        if (!travelRecord) return;
        gsap.set([travelRecord, travelLineage], {
          visibility: owned ? "inherit" : "hidden",
          opacity: owned ? 1 : 0,
        });
        if (owned) travelRecord.removeAttribute("aria-hidden");
        else travelRecord.setAttribute("aria-hidden", "true");
      };

      // Body visibility stays exact. Chapter chrome remains scene-owned.
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
          setTravelRecordOwned(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "revocation" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          setTravelRecordOwned(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "revocation" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) {
            applyVisibility(false);
            setTravelRecordOwned(false);
          }
        },
        onLeaveBack: () => {
          applyVisibility(false);
          setTravelRecordOwned(false);
        },
      });

      // Incoming 04->05 transition already lands on the fully intact,
      // registered authority lineage (its own terminal content): Shopping,
      // Grocery, Delivery all IN FORCE, Travel ACTIVE. The live scene begins
      // there — no register-unfolding entry to replay — and performs only
      // the remaining product story: targeting, revocation, propagation,
      // selectivity proof.
      gsap.set("[data-revocation-header]", { opacity: 1, y: 0 });
      gsap.set("[data-revocation-footer]", { opacity: 1 });
      gsap.set("[data-register-station]", { opacity: 1, scale: 1, y: 0 });
      gsap.set("[data-record]", { opacity: 1 });
      setTravelRecordOwned(true);
      gsap.set(travelRecord, { pointerEvents: "none" });

      // =========================================================================
      // STAGE A — OPENING HOLD (0.00 - 0.06)
      // All four records established and legible, matching the transition's
      // terminal frame exactly.
      // =========================================================================
      timeline.set({}, {}, 0.06);

      // =========================================================================
      // STAGE B — SHOPPING RECALL TARGETING (0.06 - 0.22)
      // Shopping is selected into Authority Recall Aperture / Datum 05
      // =========================================================================
      timeline
        .to(
          "[data-recall-aperture]",
          { opacity: 1, duration: 0.10, ease: "power1.inOut" },
          0.06,
        )
        .to(
          "[data-record='AUTH-0301']",
          {
            scale: 1.012,
            boxShadow: "0 14px 36px rgba(0, 0, 0, 0.65), 0 3px 8px rgba(0, 0, 0, 0.4)",
            duration: 0.10,
            ease: "power1.out",
          },
          0.10,
        );

      // =========================================================================
      // STAGE C — SOURCE SPINE UNLOCK (0.22 - 0.25)
      // A small, precise registration release — the datum pin retracts fractionally
      // before any sliding motion begins. No bounce, no mechanism, just a release.
      // =========================================================================
      timeline
        .to("[data-notch-bar]", { scaleY: 0.35, duration: 0.015, ease: "power1.in" }, 0.22)
        .to("[data-notch-bar]", { x: -3, duration: 0.015, ease: "power1.out" }, 0.235);

      // =========================================================================
      // STAGE D — HERO MOMENT: SOURCE SPINE WITHDRAWAL (0.25 - 0.46)
      // The mechanical spine unlocks and physically slides out of Shopping.
      // Partway through, inherited registration in Grocery/Delivery starts to waver.
      // =========================================================================
      timeline
        .to(
          "[data-source-spine]",
          { x: spineWithdrawX * 0.5, duration: 0.10, ease: "power2.in" },
          0.25,
        )
        .to(
          "[data-inherited-register='AUTH-0302']",
          { x: -2, duration: 0.07, ease: "power1.out" },
          0.33,
        )
        .to(
          "[data-inherited-register='AUTH-0303']",
          { x: -2, duration: 0.07, ease: "power1.out" },
          0.34,
        )
        .to(
          "[data-source-spine]",
          { x: spineWithdrawX, opacity: 0.85, duration: 0.10, ease: "power2.out" },
          0.36,
        );

      // =========================================================================
      // STAGE E — SHOPPING REVOCATION REGISTRATION (0.46 - 0.58)
      // Official administrative REVOKED stamp records the event.
      // =========================================================================
      timeline
        .to(
          "[data-stamp-revoked]",
          { opacity: 1, scale: 1, duration: 0.07, ease: "back.out(1.6)" },
          0.46,
        )
        .to(
          "[data-record='AUTH-0301']",
          { borderColor: "rgba(169, 42, 36, 0.7)", duration: 0.06 },
          0.46,
        );

      // =========================================================================
      // STAGE F — SIBLING MISREGISTRATION PROPAGATION (0.58 - 0.76)
      // Grocery and Delivery react as parallel sibling consequences of Shopping.
      // =========================================================================
      timeline
        .to(
          "[data-inherited-register='AUTH-0302']",
          { x: -4.5, borderColor: "rgba(169, 42, 36, 0.75)", duration: 0.07, ease: "power2.inOut" },
          0.58,
        )
        .to(
          "[data-inherited-register='AUTH-0303']",
          { x: -4.5, borderColor: "rgba(169, 42, 36, 0.75)", duration: 0.07, ease: "power2.inOut" },
          0.60,
        )
        .to(
          "[data-record='AUTH-0302']",
          { y: 3.5, rotate: -0.4, borderColor: "rgba(127, 29, 25, 0.6)", duration: 0.07, ease: "power1.out" },
          0.62,
        )
        .to(
          "[data-record='AUTH-0303']",
          { y: 3.5, rotate: 0.3, borderColor: "rgba(127, 29, 25, 0.6)", duration: 0.07, ease: "power1.out" },
          0.64,
        )
        .to(
          "[data-stamp-withdrawn='AUTH-0302']",
          { opacity: 1, scale: 1, duration: 0.06, ease: "power2.out" },
          0.66,
        )
        .to(
          "[data-stamp-withdrawn='AUTH-0303']",
          { opacity: 1, scale: 1, duration: 0.06, ease: "power2.out" },
          0.70,
        );

      // =========================================================================
      // STAGE G — TRAVEL SELECTIVITY PROOF (0.76 - 0.90)
      // Travel record advances independently — proving selectivity.
      // =========================================================================
      timeline
        .to(
          "[data-independent-register='travel']",
          { x: travelAdvanceX * 0.65, duration: 0.07, ease: "power1.inOut" },
          0.76,
        )
        .to(
          "[data-independent-register='travel']",
          { x: travelAdvanceX, duration: 0.07, ease: "power1.out" },
          0.83,
        );

      // =========================================================================
      // STAGE H — TERMINAL HOLD (0.90 - 1.00)
      // Final archival state holds generously with all 4 records present —
      // this is the frame the 05->06 transition begins from.
      // =========================================================================
      timeline.set({}, {}, 1.00);

      // Dynamic text updates for status chambers during scrub (forward & reverse)
      timeline.eventCallback("onUpdate", () => {
        const p = timeline.progress();
        const barStatusEl = barRecallStatusRef.current;

        const notchStatusVal = document.querySelector<HTMLElement>("[data-notch-status]");
        if (notchStatusVal) {
          if (p < 0.35) {
            notchStatusVal.textContent = "LOCKED";
          } else if (p < 0.46) {
            notchStatusVal.textContent = "RELEASED";
          } else {
            notchStatusVal.textContent = "WITHDRAWN";
          }
        }

        const shopStatusVal = document.querySelector<HTMLElement>(
          "[data-state-value='AUTH-0301']",
        );
        const grocStatusVal = document.querySelector<HTMLElement>(
          "[data-state-value='AUTH-0302']",
        );
        const delvStatusVal = document.querySelector<HTMLElement>(
          "[data-state-value='AUTH-0303']",
        );

        if (shopStatusVal) {
          if (p < 0.54) {
            shopStatusVal.textContent = "IN FORCE";
            shopStatusVal.style.color = "var(--kp-ink)";
          } else {
            shopStatusVal.textContent = "REVOKED";
            shopStatusVal.style.color = "var(--kp-red)";
          }
        }

        if (grocStatusVal) {
          if (p < 0.68) {
            grocStatusVal.textContent = "IN FORCE";
            grocStatusVal.style.color = "var(--kp-ink)";
          } else {
            grocStatusVal.textContent = "WITHDRAWN";
            grocStatusVal.style.color = "var(--kp-red-dark)";
          }
        }

        if (delvStatusVal) {
          if (p < 0.72) {
            delvStatusVal.textContent = "IN FORCE";
            delvStatusVal.style.color = "var(--kp-ink)";
          } else {
            delvStatusVal.textContent = "WITHDRAWN";
            delvStatusVal.style.color = "var(--kp-red-dark)";
          }
        }

        if (barStatusEl) {
          if (p < 0.26) {
            barStatusEl.textContent = "ALL AUTHORITIES REGISTERED // IN FORCE";
          } else if (p < 0.38) {
            barStatusEl.textContent = "RECALL APERTURE: AUTH-0301 (SHOPPING AGENT)";
          } else if (p < 0.54) {
            barStatusEl.textContent = "SOURCE SPINE WITHDRAWING // INTEGRITY FAILING";
          } else if (p < 0.72) {
            barStatusEl.textContent = "AUTH-0301 REVOKED // SIBLINGS WITHDRAWN";
          } else {
            barStatusEl.textContent = "SELECTIVE REVOCATION // TRAVEL UNAFFECTED";
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
      data-scene="revocation"
      aria-labelledby="revocation-scene-title"
    >
      <div ref={stageRef} className={styles.stage} data-revocation-stage>
        {/* Scene-owned chapter header. Physical continuity lives in TX-1082. */}
        <div className={styles.topArea}>
          <header className={styles.sceneHeader} data-revocation-header>
            <div className={styles.headerLeft}>
              <span className={styles.sceneIndex}>{revocationDemo.header.index}</span>
              <span className={styles.headerDivider}>/</span>
              <h2 id="revocation-scene-title" className={styles.headerTitle}>
                {revocationDemo.header.title}
              </h2>
            </div>
            <div className={styles.headerRight}>
              <span>{revocationDemo.header.microcopy.split(".")[0]}.</span>
              <span>{revocationDemo.header.microcopy.split(".")[1]?.trim() || "PRESERVED AUDIT TRAIL."}</span>
            </div>
          </header>
        </div>

        {/* Main Composition Arena: Authority Register Station */}
        <div className={styles.arena} data-revocation-arena>
          <div className={styles.registerStation} data-register-station>
            {/* Left & Right Datum Alignment Calipers */}
            <div className={styles.datumCaliperLeft} aria-hidden="true" />
            <div className={styles.datumCaliperRight} aria-hidden="true" />

            {/* Top Registration Station Bar */}
            <div className={styles.stationBar}>
              <span className={styles.barDatumNotice}>
                LINEAGE REGISTRATION DATUM // DATUM 05 ACTIVE
              </span>
              <span
                ref={barRecallStatusRef}
                className={styles.barRecallStatus}
                data-revocation-bar-status
              >
                ALL AUTHORITIES REGISTERED // IN FORCE
              </span>
            </div>

            {/* The 4-Record Stack */}
            <div className={styles.recordStack} data-record-stack>
              {/* Recall Aperture Highlight Bracket */}
              <div
                className={styles.recallApertureBracket}
                data-recall-aperture
                aria-hidden="true"
              />

              {/* 1. SHOPPING (Source Authority) */}
              <AuthorityRegisterRecord
                variant="source"
                id={revocationDemo.source.id}
                agent={revocationDemo.source.agent}
                category={revocationDemo.source.category}
                limit={revocationDemo.source.limit}
                mandateRef={revocationDemo.source.mandateRef}
                role={revocationDemo.source.role}
                initialStatus={revocationDemo.source.statusInitial}
                serialKey={revocationDemo.source.serialKey}
              />

              {/* 2. GROCERY (Sibling A - Derived from Shopping) */}
              <AuthorityRegisterRecord
                variant="dependent"
                id={revocationDemo.dependents.grocery.id}
                agent={revocationDemo.dependents.grocery.agent}
                category={revocationDemo.dependents.grocery.category}
                limit={revocationDemo.dependents.grocery.limit}
                mandateRef={revocationDemo.source.mandateRef}
                derivedFrom={revocationDemo.dependents.grocery.derivedFrom}
                role={revocationDemo.dependents.grocery.role}
                initialStatus={revocationDemo.dependents.grocery.statusInitial}
                serialKey={revocationDemo.dependents.grocery.serialKey}
              />

              {/* 3. DELIVERY (Sibling B - Derived from Shopping) */}
              <AuthorityRegisterRecord
                variant="dependent"
                id={revocationDemo.dependents.delivery.id}
                agent={revocationDemo.dependents.delivery.agent}
                category={revocationDemo.dependents.delivery.category}
                limit={revocationDemo.dependents.delivery.limit}
                mandateRef={revocationDemo.source.mandateRef}
                derivedFrom={revocationDemo.dependents.delivery.derivedFrom}
                role={revocationDemo.dependents.delivery.role}
                initialStatus={revocationDemo.dependents.delivery.statusInitial}
                serialKey={revocationDemo.dependents.delivery.serialKey}
              />

              {/* 4. TRAVEL (Control Case - Independent Authority) */}
              <AuthorityRegisterRecord
                variant="control"
                id={revocationDemo.control.reference}
                displayId={revocationDemo.control.requestRef}
                secondaryRef={revocationDemo.control.reference}
                agent={revocationDemo.control.agent}
                category={revocationDemo.control.category}
                limit={revocationDemo.control.amount}
                mandateRef={revocationDemo.control.mandateRef}
                role={revocationDemo.control.role}
                initialStatus="ACTIVE"
                serialKey={revocationDemo.control.serialKey}
              />
            </div>

            {/* Bottom Station Clearance Bracket */}
            <div className={styles.stationFooterBracket} data-station-bracket>
              <span>LINEAGE INTEGRITY MONITORED // SIBLING DERIVATION COUPLING</span>
              <span>DATUM 05 // AUTHORITY AUDIT ARCHIVE</span>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Administrative Bar */}
        <footer className={styles.sceneFooter} data-revocation-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>
            {revocationDemo.footer.tagline}
          </span>
          <span className={styles.footerCode}>
            {revocationDemo.footer.code}
          </span>
        </footer>
      </div>
    </section>
  );
}
