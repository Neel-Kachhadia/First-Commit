"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { concurrencyDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { ConcurrencySlip } from "@/components/documents/ConcurrencySlip";
import styles from "./ConcurrencyScene.module.css";

type ConcurrencySceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function ConcurrencyScene({ trackRef }: ConcurrencySceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const balanceInitialRef = useRef<HTMLSpanElement>(null);
  const balanceFinalRef = useRef<HTMLSpanElement>(null);
  const datumStatusRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const prefersReduced = experienceStore.getState().reducedMotion;

      if (prefersReduced) {
        if (!root.current || !stageRef.current) return;

        const triggerEl = trackRef?.current ?? "[data-track='concurrency']";
        const applyReducedVisibility = (visible: boolean) => {
          if (!root.current || !stageRef.current) return;
          root.current.style.visibility = visible ? "visible" : "hidden";
          root.current.style.pointerEvents = visible ? "auto" : "none";
          root.current.setAttribute("aria-hidden", visible ? "false" : "true");
          stageRef.current.style.visibility = visible ? "visible" : "hidden";
        };
        applyReducedVisibility(false);

        const reducedVisibilityTrigger = ScrollTrigger.create({
          trigger: triggerEl,
          start: "top top+=1px",
          end: "bottom top",
          onEnter: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "concurrency" } }));
          },
          onEnterBack: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "concurrency" } }));
          },
          onLeave: () => applyReducedVisibility(false),
          onLeaveBack: () => applyReducedVisibility(false),
        });

        // Reduced motion: Show complete final resolved state
        gsap.set("[data-concurrency-header]", { opacity: 1 });
        gsap.set("[data-concurrency-footer]", { opacity: 1 });
        gsap.set("[data-ledger-station]", { opacity: 1, y: 0 });
        gsap.set("[data-balance-initial]", { opacity: 0, y: -20 });
        gsap.set("[data-balance-final]", { opacity: 1, y: 0 });
        gsap.set("[data-authority-stock]", { opacity: 1, x: isMobile ? 0 : -160, y: 0 });
        gsap.set("[data-commit-datum]", { opacity: 1 });
        gsap.set("[data-slip-lane='left']", { opacity: 1, x: isMobile ? 0 : -40, y: isMobile ? -65 : 0, rotate: 0 });
        gsap.set("[data-slip-lane='right']", { opacity: 1, x: isMobile ? 0 : 40, y: isMobile ? 65 : 0, rotate: 0 });
        gsap.set("[data-stamp-reserved]", { opacity: 1, scale: 1, rotate: -3.5 });
        gsap.set("[data-stamp-unavailable]", { opacity: 1, scale: 1, rotate: 2.2 });
        gsap.set("[data-terminal-ledger]", { opacity: 1, y: 0 });
        return () => reducedVisibilityTrigger.kill();
      }

      if (!root.current || !stageRef.current) return;

      const isPersistent = Boolean(trackRef);
      const triggerEl =
        trackRef?.current ?? (isPersistent ? "[data-track='concurrency']" : root.current);

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
          end: isPersistent ? "bottom top" : "+=340%",
          pin: false,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("concurrency", self.progress);
          },
        },
      });

      const incomingCarrier = "[data-ledger-station]";
      const outgoingCarrier = "[data-terminal-ledger]";

      // Strict Zero-Slack Scene Ownership Trigger
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          applyVisibility(true);
          gsap.set(incomingCarrier, { opacity: 1, visibility: "visible" });
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "concurrency" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          gsap.set(incomingCarrier, { opacity: 1, visibility: "visible" });
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "concurrency" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) {
            applyVisibility(false);
            gsap.set(incomingCarrier, { opacity: 0, visibility: "hidden" });
            gsap.set(outgoingCarrier, { opacity: 0 });
          }
        },
        onLeaveBack: () => {
          applyVisibility(false);
          gsap.set(incomingCarrier, { opacity: 0, visibility: "hidden" });
        },
      });

      // incomingCarrier's boundary is now owned by the 06 -> 07 video transition
      // layer; outgoingCarrier's 07 -> 08 boundary intentionally has no video
      // transition, so both carriers now rely only on the ownership trigger above.
      gsap.set(incomingCarrier, {
        opacity: 0,
        visibility: "visible",
        pointerEvents: "none",
      });

      // Incoming 06->07 transition already lands with both ₹500 claims
      // established and flanking the shared ledger (its own terminal
      // content). The live scene begins there — no arrival animation to
      // replay — and performs only the remaining product story: convergence,
      // atomic serialization, one reservation, one rejection.
      const leftRest = isMobile
        ? { x: 0, y: -75, scale: 0.96, rotate: -0.8 }
        : { x: -230, y: 5, scale: 1, rotate: -2 };
      const rightRest = isMobile
        ? { x: 0, y: 75, scale: 0.96, rotate: 0.8 }
        : { x: 230, y: -5, scale: 1, rotate: 1.5 };

      gsap.set("[data-slip-lane='left']", { ...leftRest, opacity: 1 });
      gsap.set("[data-slip-lane='right']", { ...rightRest, opacity: 1 });
      gsap.set("[data-balance-initial]", { opacity: 1, y: 0 });
      gsap.set("[data-balance-final]", { opacity: 0, y: 15 });
      gsap.set("[data-authority-stock]", { opacity: 1, y: 0 });
      gsap.set("[data-commit-datum]", { opacity: 1, scaleY: 1 });
      gsap.set("[data-stamp-reserved]", { opacity: 0, scale: 1.5, rotate: -8 });
      gsap.set("[data-stamp-unavailable]", { opacity: 0, scale: 1.5, rotate: 6 });
      gsap.set("[data-terminal-ledger]", { opacity: 0, y: 20 });
      gsap.set("[data-concurrency-footer]", { opacity: 1 });
      gsap.set("[data-ledger-station]", { y: 0 });

      // =========================================================================
      // STAGE A — OPENING HOLD: BOTH VALID, QUIET CONTENTION (0.00 - 0.08)
      // Composition stays at the transition's terminal frame: two individually
      // legitimate claims flanking one ₹500 ledger. The tension is the point.
      // =========================================================================
      timeline.set({}, {}, 0.08);

      // =========================================================================
      // STAGE B — CONVERGENCE TOWARD THE COMMIT DATUM (0.08 - 0.26)
      // Both slips translate toward the central registration axis.
      // =========================================================================
      timeline
        .to(
          "[data-slip-lane='left']",
          { x: isMobile ? 0 : -130, y: isMobile ? -60 : 0, rotate: 0, duration: 0.16, ease: "power2.inOut" },
          0.08,
        )
        .to(
          "[data-slip-lane='right']",
          { x: isMobile ? 0 : 130, y: isMobile ? 60 : 0, rotate: 0, duration: 0.16, ease: "power2.inOut" },
          0.08,
        );

      // =========================================================================
      // STAGE C — ATOMIC SERIALIZATION AT COMMIT DATUM (0.26 - 0.44)
      // Only ONE slip can cross the registration datum. TX-1094 crosses into
      // the active reservation slot; TX-1095 is held fractionally behind it.
      // =========================================================================
      timeline
        .to(
          "[data-slip-lane='left']",
          { x: isMobile ? 0 : -35, y: isMobile ? -45 : 0, scale: 1, duration: 0.16, ease: "power2.out" },
          0.26,
        )
        .to(
          "[data-slip-lane='right']",
          {
            x: isMobile ? 0 : 55,
            y: isMobile ? 80 : 0,
            scale: isMobile ? 0.92 : 1,
            opacity: isMobile ? 0.75 : 1,
            duration: 0.16,
            ease: "power2.out",
          },
          0.26,
        );

      // =========================================================================
      // STAGE D — PHYSICAL AUTHORITY STOCK TRANSFERS & RESERVED STAMP (0.44 - 0.56)
      // The physical ₹500 authority stock coupon translates into TX-1094's slot.
      // Bold red RESERVED stamp strikes onto TX-1094 with micro-impact shudder.
      // =========================================================================
      timeline
        .to(
          "[data-authority-stock]",
          { x: isMobile ? 0 : -140, y: isMobile ? -30 : 60, duration: 0.08, ease: "power3.inOut" },
          0.44,
        )
        .to(
          "[data-stamp-reserved]",
          { opacity: 1, scale: 1, rotate: -3.5, duration: 0.05, ease: "back.out(2.2)" },
          0.49,
        )
        .call(
          () => {
            const statusEl = document.querySelector(
              "[data-concurrency-slip='TX-1094'] [data-slip-status]",
            );
            if (statusEl) statusEl.textContent = "RESERVED // CONFIRMED";
          },
          undefined,
          0.50,
        );

      // =========================================================================
      // STAGE E — AUTHORITATIVE BALANCE PHYSICAL UPDATE (0.56 - 0.64)
      // The ₹500 numeral physically shifts out and the registered ₹0 drops into
      // place. Dominant authoritative state: CURRENT REMAINING: ₹0.
      // =========================================================================
      timeline
        .to(
          "[data-balance-initial]",
          { opacity: 0, y: -18, duration: 0.05, ease: "power2.in" },
          0.56,
        )
        .to(
          "[data-balance-final]",
          { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" },
          0.58,
        )
        .call(
          () => {
            if (datumStatusRef.current) {
              datumStatusRef.current.textContent = concurrencyDemo.datum.postReservationStatus;
            }
          },
          undefined,
          0.60,
        );

      // =========================================================================
      // STAGE F — TX-1095 VISIBLY RE-EVALUATES AGAINST NEW REALITY (0.64 - 0.80)
      // TX-1095 confronts CURRENT REMAINING: ₹0. Requested ₹500 exceeds
      // available ₹0. Restrained red UNAVAILABLE mark records; slip recedes.
      // =========================================================================
      timeline
        .to(
          "[data-slip-lane='right']",
          { x: isMobile ? 0 : 75, scale: 0.97, duration: 0.08, ease: "power1.out" },
          0.64,
        )
        .to(
          "[data-stamp-unavailable]",
          { opacity: 1, scale: 1, rotate: 2.2, duration: 0.06, ease: "power2.out" },
          0.70,
        )
        .call(
          () => {
            const statusEl = document.querySelector(
              "[data-concurrency-slip='TX-1095'] [data-slip-status]",
            );
            if (statusEl) statusEl.textContent = "UNAVAILABLE // ₹0 REMAINING";
          },
          undefined,
          0.72,
        );

      // =========================================================================
      // STAGE G — TERMINAL CONSERVATION LEDGER PLATE LOCKS (0.80 - 0.92)
      // Complete institutional accounting plate verifies conservation formula:
      // ₹3,500 PRIOR + ₹500 RESERVED + ₹0 REMAINING = ₹4,000 MANDATE CAP.
      // =========================================================================
      timeline.to(
        "[data-terminal-ledger]",
        { opacity: 1, y: 0, duration: 0.08, ease: "power2.out" },
        0.80,
      );

      // =========================================================================
      // STAGE H — TERMINAL RESTING HOLD (0.92 - 1.00)
      // Stable, portfolio-quality terminal composition. There is no 07 -> 08
      // video transition — Scene 08 takes over from here with its own entrance.
      // =========================================================================
      timeline.set({}, {}, 1.00);

      return () => {
        visibilityTrigger.kill();
        timeline.kill();
      };
    },
    { scope: root, dependencies: [trackRef] },
  );

  return (
    <section
      ref={root}
      className={styles.concurrencySection}
      data-scene="concurrency"
      aria-label="Scene 07: Budget and Concurrency Control"
    >
      <div ref={stageRef} className={styles.stage}>
        {/* Editorial Scene Header */}
        <header className={styles.sceneHeader} data-concurrency-header>
          <div className={styles.headerIndexWrap}>
            <span className={styles.sceneIndex}>{concurrencyDemo.header.index}</span>
            <div className={styles.headerText}>
              <h2 className={styles.sceneTitle}>{concurrencyDemo.header.title}</h2>
              <span className={styles.sceneMicrocopy}>{concurrencyDemo.header.microcopy}</span>
            </div>
          </div>
          <div className={styles.headerMeta}>
            <div>SHARED CAPACITY CONTROLLERS</div>
            <div>MONETARY CONSERVATION // EXACT ZERO LEAK</div>
          </div>
        </header>

        {/* Central Physical Arena */}
        <div className={styles.arena}>
          {/* Central Authoritative Budget Station matching Panel 07 */}
          <div className={styles.ledgerStation} data-ledger-station>
            <div className={styles.balanceRegister}>
              <div className={styles.balanceNumeralWrap}>
                <span
                  ref={balanceInitialRef}
                  className={`${styles.balanceNumeral} ${styles.numeralInitial}`}
                  data-balance-initial
                >
                  {concurrencyDemo.initialRemaining}
                </span>
                <span
                  ref={balanceFinalRef}
                  className={`${styles.balanceNumeral} ${styles.numeralFinal}`}
                  data-balance-final
                >
                  {concurrencyDemo.finalRemaining}
                </span>
              </div>
              <span className={styles.balanceLabel} data-balance-label>
                REMAINING
              </span>
            </div>

            {/* Physical Spendable Authority Stock Coupon */}
            <div className={styles.authorityStock} data-authority-stock>
              <span className={styles.stockBadge}>AUTHORITY STOCK</span>
              <span className={styles.stockAmount}>₹500 SPENDABLE</span>
            </div>
          </div>

          {/* Central Commit Datum Registration Axis */}
          <div className={styles.commitDatumAxis} data-commit-datum aria-hidden="true">
            <span className={styles.datumLabelTop}>COMMIT DATUM // REG-AXIS-07</span>
            <div className={styles.datumLine} />
            <div className={styles.datumAperture} data-reservation-aperture>
              <div className={styles.datumTick} />
            </div>
            <span ref={datumStatusRef} className={styles.datumLabelBottom} data-datum-status>
              {concurrencyDemo.datum.preCommitStatus}
            </span>
          </div>

          {/* Slips Container: Left (TX-1094 Cafe) and Right (TX-1095 Books) */}
          <div className={styles.slipsContainer}>
            {/* Left Slip Lane: TX-1094 Cafe */}
            <div
              className={`${styles.slipLane} ${styles.slipLaneLeft}`}
              data-slip-lane="left"
            >
              <div className={styles.laneIndicatorLeft} aria-hidden="true">
                CLAIM A →
              </div>
              <ConcurrencySlip
                id={concurrencyDemo.leftRequest.id}
                amount={concurrencyDemo.leftRequest.amount}
                purpose={concurrencyDemo.leftRequest.purpose}
                merchant={concurrencyDemo.leftRequest.merchant}
                agent={concurrencyDemo.leftRequest.agent}
                time={concurrencyDemo.leftRequest.time}
                serial={concurrencyDemo.leftRequest.serial}
                mandateRef={concurrencyDemo.mandateRef}
                status={concurrencyDemo.leftRequest.statusInitial}
                side="left"
                stamp={
                  <div
                    className={styles.stampReserved}
                    data-stamp-reserved
                    data-stamp="reserved"
                  >
                    <strong className={styles.stampReservedText}>
                      {concurrencyDemo.stamps.reserved}
                    </strong>
                    <span className={styles.stampReservedRef}>
                      ATOMIC REGISTRATION // 10:14:02.110
                    </span>
                  </div>
                }
              />
            </div>

            {/* Right Slip Lane: TX-1095 Books */}
            <div
              className={`${styles.slipLane} ${styles.slipLaneRight}`}
              data-slip-lane="right"
            >
              <div className={styles.laneIndicatorRight} aria-hidden="true">
                ← CLAIM B
              </div>
              <ConcurrencySlip
                id={concurrencyDemo.rightRequest.id}
                amount={concurrencyDemo.rightRequest.amount}
                purpose={concurrencyDemo.rightRequest.purpose}
                merchant={concurrencyDemo.rightRequest.merchant}
                agent={concurrencyDemo.rightRequest.agent}
                time={concurrencyDemo.rightRequest.time}
                serial={concurrencyDemo.rightRequest.serial}
                mandateRef={concurrencyDemo.mandateRef}
                status={concurrencyDemo.rightRequest.statusInitial}
                side="right"
                stamp={
                  <div
                    className={styles.stampUnavailable}
                    data-stamp-unavailable
                    data-stamp="unavailable"
                  >
                    <span className={styles.stampUnavailableCross}>✕</span>
                    <strong className={styles.stampUnavailableText}>
                      {concurrencyDemo.stamps.unavailable}
                    </strong>
                    <span className={styles.stampUnavailableRef}>
                      INSUFFICIENT REMAINING CAPACITY
                    </span>
                  </div>
                }
              />
            </div>
          </div>

          {/* Terminal Conservation Ledger Summary Plate */}
          <div className={styles.terminalLedger} data-terminal-ledger>
            <div className={styles.ledgerHeader}>
              <span className={styles.ledgerTitle}>
                CONSERVATION AUDIT // MANDATE {concurrencyDemo.mandateRef}
              </span>
              <span className={styles.ledgerRef}>CAP: {concurrencyDemo.accounting.mandateCap}</span>
            </div>
            <div className={styles.ledgerGrid}>
              <div className={styles.ledgerCell}>
                <span className={styles.cellLabel}>PRIOR CUMULATIVE</span>
                <span className={styles.cellValue}>{concurrencyDemo.accounting.priorSpend}</span>
              </div>
              <div className={styles.ledgerCell}>
                <span className={styles.cellLabel}>TX-1094 [CAFE]</span>
                <span className={`${styles.cellValue} ${styles.cellValueCommitted}`}>
                  {concurrencyDemo.accounting.currentReservation} (RESERVED)
                </span>
              </div>
              <div className={styles.ledgerCell}>
                <span className={styles.cellLabel}>CURRENT REMAINING</span>
                <span className={`${styles.cellValue} ${styles.cellValueRemaining}`}>
                  {concurrencyDemo.accounting.currentRemaining}
                </span>
              </div>
              <div className={styles.ledgerCell}>
                <span className={styles.cellLabel}>TX-1095 [BOOKS]</span>
                <span className={`${styles.cellValue} ${styles.cellValueRejected}`}>
                  {concurrencyDemo.accounting.unfulfilledClaim} (UNFULFILLED)
                </span>
              </div>
            </div>
            <div className={styles.ledgerProof}>
              <span className={styles.proofFormula} data-conservation-proof>
                {concurrencyDemo.accounting.conservationProof}
              </span>
              <span className={styles.proofTag}>[✓ CONSERVED // ZERO OVERSPEND]</span>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Administrative Footer */}
        <footer className={styles.sceneFooter} data-concurrency-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>{concurrencyDemo.footer.tagline}</span>
          <span>{concurrencyDemo.footer.code}</span>
        </footer>
      </div>
    </section>
  );
}
