"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { splitDefenseDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { SplitReceipt } from "@/components/documents/SplitReceipt";
import styles from "./SplitDefenseScene.module.css";

type SplitDefenseSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function SplitDefenseScene({ trackRef }: SplitDefenseSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const apertureStatusRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const prefersReduced = experienceStore.getState().reducedMotion;

      if (prefersReduced) {
        if (!root.current || !stageRef.current) return;

        const triggerEl = trackRef?.current ?? "[data-track='split-defense']";
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
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "splitDefense" } }));
          },
          onEnterBack: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "splitDefense" } }));
          },
          onLeave: () => applyReducedVisibility(false),
          onLeaveBack: () => applyReducedVisibility(false),
        });

        // Reduced motion: Show complete final correlation and blocked state
        gsap.set("[data-split-header]", { opacity: 1 });
        gsap.set("[data-split-footer]", { opacity: 1 });
        gsap.set("[data-split-receipt]", {
          opacity: 1,
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
        });
        gsap.set("[data-temporal-aperture]", { opacity: 1, scaleX: 1 });
        gsap.set("[data-registration-datum]", { opacity: 1, scaleX: 1 });
        gsap.set("[data-ledger-tally]", { opacity: 1, y: 0 });
        gsap.set("[data-dossier-backing]", { opacity: 1, scale: 1 });
        gsap.set("[data-stamp-economic-action]", { opacity: 1, scale: 1, rotate: -2.5 });
        gsap.set("[data-stamp-blocked]", { opacity: 1, scale: 1, rotate: 1.2 });
        return () => reducedVisibilityTrigger.kill();
      }

      if (!root.current || !stageRef.current) return;

      const isPersistent = Boolean(trackRef);
      const triggerEl =
        trackRef?.current ?? (isPersistent ? "[data-track='split-defense']" : root.current);

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
            progressBus.set("splitDefense", self.progress);
          },
        },
      });

      // Strict Zero-Slack Scene Ownership Trigger
      // 1px epsilon on start prevents GSAP onEnter dead-zone at integer 0px
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          applyVisibility(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "splitDefense" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "splitDefense" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) applyVisibility(false);
        },
        onLeaveBack: () => {
          applyVisibility(false);
        },
      });

      // Initial Receipt Spatial Coordinates
      const rec1Start = isMobile
        ? { x: -20, y: -40, rotate: -2, opacity: 0 }
        : { x: -320, y: 30, rotate: -3.5, opacity: 0 };
      const rec2Start = isMobile
        ? { x: 15, y: -20, rotate: 1.5, opacity: 0 }
        : { x: 0, y: -40, rotate: 1.8, opacity: 0 };
      const rec3Start = isMobile
        ? { x: -10, y: 0, rotate: -1, opacity: 0 }
        : { x: 320, y: 20, rotate: -2.2, opacity: 0 };

      // Set initial element states
      gsap.set("[data-split-receipt='TX-1091']", rec1Start);
      gsap.set("[data-split-receipt='TX-1092']", rec2Start);
      gsap.set("[data-split-receipt='TX-1093']", rec3Start);
      gsap.set("[data-temporal-aperture]", { opacity: 0, scaleY: 0.8 });
      gsap.set("[data-registration-datum]", { opacity: 0, scaleX: 0 });
      gsap.set("[data-ledger-tally]", { opacity: 0, y: 15 });
      gsap.set("[data-dossier-backing]", { opacity: 0, scale: 0.96, y: 20 });
      gsap.set("[data-stamp-economic-action]", { opacity: 0, scale: 1.5, rotate: -6 });
      gsap.set("[data-stamp-blocked]", { opacity: 0, scale: 1.6, rotate: 4 });

      // =========================================================================
      // BEAT 1: FIRST TEMPORAL REQUEST ENTERS (0.00 - 0.10)
      // TX-1091 (10:03, ₹1,000, Market Mart) enters independently.
      // Sits well below threshold (> ₹1,500).
      // =========================================================================
      timeline
        .fromTo(
          "[data-split-footer]",
          { opacity: 0 },
          { opacity: 1, duration: 0.06 },
          0.06,
        )
        .to(
          "[data-split-receipt='TX-1091']",
          {
            opacity: 1,
            x: isMobile ? 0 : -280,
            y: isMobile ? 0 : 15,
            rotate: isMobile ? -1 : -2,
            duration: 0.08,
            ease: "power2.out",
          },
          0.02,
        );

      // =========================================================================
      // BEAT 2: SECOND TEMPORAL REQUEST ENTERS (0.10 - 0.19)
      // TX-1092 (10:06, ₹1,000, Market Mart) enters 3 minutes later.
      // Still looks like an innocent second purchase.
      // =========================================================================
      timeline.to(
        "[data-split-receipt='TX-1092']",
        {
          opacity: 1,
          x: isMobile ? 0 : 0,
          y: isMobile ? 0 : -10,
          rotate: isMobile ? 1 : 1.2,
          duration: 0.08,
          ease: "power2.out",
        },
        0.10,
      );

      // =========================================================================
      // BEAT 3: THIRD TEMPORAL REQUEST ENTERS (0.19 - 0.28)
      // TX-1093 (10:09, ₹1,000, Market Mart) enters 3 minutes later.
      // =========================================================================
      timeline.to(
        "[data-split-receipt='TX-1093']",
        {
          opacity: 1,
          x: isMobile ? 0 : 280,
          y: isMobile ? 0 : 10,
          rotate: isMobile ? -0.5 : -1.5,
          duration: 0.08,
          ease: "power2.out",
        },
        0.19,
      );

      // =========================================================================
      // BEAT 4: INDEPENDENT HOLD (0.28 - 0.34)
      // All 3 receipts sit visibly below STEP-UP > ₹1,500.
      // The viewer perceives them as three separate transactions.
      // =========================================================================
      timeline.set({}, {}, 0.34);

      // =========================================================================
      // BEAT 5: TEMPORAL WINDOW ENGAGES & SPATIAL CONVERGENCE (0.34 - 0.52)
      // The physical Temporal Review Aperture brackets close around 10:00-10:15.
      // Receipts translate into tight horizontal proximity and snap to 0deg rotation.
      // =========================================================================
      timeline
        .to(
          "[data-temporal-aperture]",
          {
            opacity: 1,
            scaleY: 1,
            duration: 0.10,
            ease: "power2.out",
          },
          0.34,
        )
        .to(
          "[data-split-receipt='TX-1091']",
          {
            x: isMobile ? 0 : -250,
            y: 0,
            rotate: 0,
            duration: 0.14,
            ease: "power2.inOut",
          },
          0.36,
        )
        .to(
          "[data-split-receipt='TX-1092']",
          {
            x: 0,
            y: 0,
            rotate: 0,
            duration: 0.14,
            ease: "power2.inOut",
          },
          0.36,
        )
        .to(
          "[data-split-receipt='TX-1093']",
          {
            x: isMobile ? 0 : 250,
            y: 0,
            rotate: 0,
            duration: 0.14,
            ease: "power2.inOut",
          },
          0.36,
        );

      // =========================================================================
      // BEAT 6: IDENTITY EVIDENCE REGISTRATION (0.52 - 0.68)
      // Horizontal forensic datum lines snap across the 3 repeated fields:
      // 1. MARKET MART MUMBAI
      // 2. VIA AGENT ZEPTO
      // 3. PURPOSE GROCERY
      // Redundancy becomes visually undeniable.
      // =========================================================================
      timeline
        .to(
          "[data-registration-datum='merchant']",
          {
            opacity: 1,
            scaleX: 1,
            duration: 0.05,
            ease: "power1.out",
          },
          0.52,
        )
        .to(
          "[data-registration-datum='agent']",
          {
            opacity: 1,
            scaleX: 1,
            duration: 0.05,
            ease: "power1.out",
          },
          0.58,
        )
        .to(
          "[data-registration-datum='purpose']",
          {
            opacity: 1,
            scaleX: 1,
            duration: 0.05,
            ease: "power1.out",
          },
          0.64,
        );

      // =========================================================================
      // BEAT 7: ACCOUNTING AGGREGATION (0.68 - 0.78)
      // Ledger tally bracket activates: ₹1,000 + ₹1,000 + ₹1,000 = ₹3,000.
      // Proves why evasion fails: ₹3,000 > ₹1,500 threshold!
      // =========================================================================
      timeline
        .to(
          "[data-ledger-tally]",
          {
            opacity: 1,
            y: 0,
            duration: 0.08,
            ease: "power2.out",
          },
          0.68,
        )
        .to(
          "[data-tally-breach]",
          {
            color: "var(--kp-red)",
            scale: 1.04,
            duration: 0.04,
            ease: "power1.out",
          },
          0.74,
        );

      // =========================================================================
      // BEAT 8: DOSSIER LOCK & SINGLE ECONOMIC ACTION (0.78 - 0.86)
      // Underlying correlation dossier locks the 3 slips into one composite case.
      // =========================================================================
      timeline.to(
        "[data-dossier-backing]",
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.08,
          ease: "power2.out",
        },
        0.78,
      );

      // =========================================================================
      // BEAT 9: PRIMARY STAMP — ONE ECONOMIC ACTION (0.86 - 0.93)
      // Anticipation -> Impact -> Settle
      // =========================================================================
      timeline
        .to(
          "[data-stamp-economic-action]",
          {
            opacity: 0.4,
            scale: 1.25,
            rotate: -4,
            duration: 0.02,
          },
          0.86,
        )
        .to(
          "[data-stamp-economic-action]",
          {
            opacity: 1,
            scale: 0.98,
            rotate: -2.5,
            duration: 0.03,
            ease: "power4.in",
          },
          0.88,
        )
        .to(
          "[data-stamp-economic-action]",
          {
            scale: 1,
            duration: 0.02,
            ease: "power1.out",
          },
          0.91,
        );

      // =========================================================================
      // BEAT 10: SECONDARY ENFORCEMENT STAMP — BLOCKED (0.93 - 0.97)
      // Authoritative administrative box stamp records BLOCKED
      // =========================================================================
      timeline
        .to(
          "[data-stamp-blocked]",
          {
            opacity: 0.5,
            scale: 1.3,
            rotate: 2.5,
            duration: 0.015,
          },
          0.93,
        )
        .to(
          "[data-stamp-blocked]",
          {
            opacity: 1,
            scale: 0.98,
            rotate: 1.2,
            duration: 0.02,
            ease: "power4.in",
          },
          0.945,
        )
        .to(
          "[data-stamp-blocked]",
          {
            scale: 1,
            duration: 0.015,
            ease: "power1.out",
          },
          0.965,
        );

      // =========================================================================
      // BEAT 11: COMPLETE TERMINAL HISTORICAL HOLD (0.97 - 1.00)
      // Holds final state with all 3 receipts, audit evidence, and stamps intact.
      // =========================================================================
      timeline.set({}, {}, 1.00);

      // Dynamic text updates for status displays during scrub
      timeline.eventCallback("onUpdate", () => {
        const p = timeline.progress();
        const aperEl = apertureStatusRef.current;

        if (aperEl) {
          if (p < 0.34) {
            aperEl.textContent = "MONITORING WINDOW: 10:00–10:15";
          } else if (p < 0.68) {
            aperEl.textContent = "TEMPORAL CLUSTER IDENTIFIED // 3 SLIPS IN 6 MIN";
          } else {
            aperEl.textContent = "CORRELATION SEALED // CASE CLOSED";
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
      data-scene="split-defense"
      aria-labelledby="split-scene-title"
    >
      <div ref={stageRef} className={styles.stage} data-split-stage>
        {/* Chapter header — global navbar owns persistent top chrome. */}
        <div className={styles.topArea}>
          <header className={styles.sceneHeader} data-split-header>
            <div className={styles.headerLeft}>
              <span className={styles.sceneIndex}>{splitDefenseDemo.header.index}</span>
              <span className={styles.headerDivider}>/</span>
              <h2 id="split-scene-title" className={styles.headerTitle}>
                {splitDefenseDemo.header.title}
              </h2>
            </div>
            <div className={styles.headerRight}>
              <span>{splitDefenseDemo.header.microcopy.split(".")[0]}.</span>
              <span>
                {splitDefenseDemo.header.microcopy.split(".")[1]?.trim() || "BOUNDED INTENT."}
              </span>
            </div>
          </header>
        </div>

        {/* Main Composition Arena: Correlation Window */}
        <div className={styles.arena} data-split-arena>
          {/* Physical Temporal Review Aperture Brackets */}
          <div className={styles.temporalAperture} data-temporal-aperture aria-hidden="true">
            <div className={styles.apertureTopBar}>
              <div className={styles.apertureTicks}>
                <span className={styles.tick}>10:00</span>
                <span className={styles.tickMark}>|</span>
                <span className={styles.tickActive}>10:03 [TX-1091]</span>
                <span className={styles.tickMark}>|</span>
                <span className={styles.tickActive}>10:06 [TX-1092]</span>
                <span className={styles.tickMark}>|</span>
                <span className={styles.tickActive}>10:09 [TX-1093]</span>
                <span className={styles.tickMark}>|</span>
                <span className={styles.tick}>10:15</span>
              </div>
              <span ref={apertureStatusRef} className={styles.apertureNotice}>
                {splitDefenseDemo.window.label}
              </span>
            </div>
          </div>

          {/* Registration Datum Lines (aligns repeated fields) */}
          <div className={styles.registrationDatumContainer} aria-hidden="true">
            <div
              className={`${styles.datumLine} ${styles.datumMerchant}`}
              data-registration-datum="merchant"
            >
              <span className={styles.datumBadge}>EVIDENCE MATCH // SAME MERCHANT</span>
            </div>
            <div
              className={`${styles.datumLine} ${styles.datumAgent}`}
              data-registration-datum="agent"
            >
              <span className={styles.datumBadge}>EVIDENCE MATCH // SAME AGENT</span>
            </div>
            <div
              className={`${styles.datumLine} ${styles.datumPurpose}`}
              data-registration-datum="purpose"
            >
              <span className={styles.datumBadge}>EVIDENCE MATCH // SAME PURPOSE</span>
            </div>
          </div>

          {/* Correlation Dossier Backing Sheet (underlying investigation plate) */}
          <div className={styles.dossierBacking} data-dossier-backing>
            <div className={styles.dossierHeader}>
              <span className={styles.dossierRef}>
                FORENSIC AUDIT DOSSIER // REF: KP-CR-1967-06
              </span>
              <span className={styles.dossierClass}>STATEFUL POLICY ENFORCEMENT</span>
            </div>
            <div className={styles.dossierFindings}>
              <div className={styles.findingItem}>
                <span className={styles.findingCheck}>[✓]</span>
                <strong className={styles.findingLabel}>SAME MERCHANT.</strong>
                <span className={styles.findingVal}>MARKET MART (MUMBAI)</span>
              </div>
              <div className={styles.findingItem}>
                <span className={styles.findingCheck}>[✓]</span>
                <strong className={styles.findingLabel}>SAME AGENT.</strong>
                <span className={styles.findingVal}>ZEPTO (GROCERY DELEGATION)</span>
              </div>
              <div className={styles.findingItem}>
                <span className={styles.findingCheck}>[✓]</span>
                <strong className={styles.findingLabel}>SAME PURPOSE.</strong>
                <span className={styles.findingVal}>GROCERY RESTRICTION BYPASS ATTEMPT</span>
              </div>
            </div>
            <div className={styles.dossierAuditNote}>
              <span>{splitDefenseDemo.aggregation.auditNote}</span>
            </div>
          </div>

          {/* The Three Constituent Receipts */}
          <div className={styles.receiptStage} data-receipt-stage>
            {splitDefenseDemo.requests.map((req, idx) => (
              <SplitReceipt
                key={req.id}
                id={req.id}
                amount={req.amount}
                time={req.time}
                merchant={req.merchant}
                location={req.location}
                agent={req.agent}
                purpose={req.purpose}
                status={req.status}
                serial={req.serial}
                mandateRef={splitDefenseDemo.mandateRef}
                index={idx}
                className={styles.receiptItem}
              />
            ))}
          </div>

          {/* Ledger Tally Summing Bracket: ₹1,000 + ₹1,000 + ₹1,000 = ₹3,000 */}
          <div className={styles.ledgerTally} data-ledger-tally>
            <div className={styles.tallyBracketLeft} aria-hidden="true" />
            <div className={styles.tallyContent}>
              <div className={styles.tallyFormula}>
                <span className={styles.formulaItem}>₹1,000 [10:03]</span>
                <span className={styles.formulaOp}>+</span>
                <span className={styles.formulaItem}>₹1,000 [10:06]</span>
                <span className={styles.formulaOp}>+</span>
                <span className={styles.formulaItem}>₹1,000 [10:09]</span>
              </div>
              <div className={styles.tallyResult}>
                <span className={styles.tallyLabel}>AGGREGATE SUM:</span>
                <strong className={styles.tallyAmount}>₹3,000</strong>
                <span className={styles.tallyBreach} data-tally-breach>
                  EXCEEDS THRESHOLD (&gt; ₹1,500)
                </span>
              </div>
            </div>
            <div className={styles.tallyBracketRight} aria-hidden="true" />
          </div>

          {/* Administrative Hero Stamps */}
          <div className={styles.stampOverlay} aria-hidden="true">
            <div
              className={styles.stampEconomicAction}
              data-stamp-economic-action
              data-stamp="one-economic-action"
            >
              <span className={styles.stampClassNotice}>TEMPORAL CORRELATION VERDICT</span>
              <strong className={styles.stampTitle}>ONE ECONOMIC ACTION</strong>
              <span className={styles.stampSubNotice}>KAVACHPAY STATEFUL RECOGNITION</span>
            </div>

            <div className={styles.stampBlocked} data-stamp-blocked data-stamp="blocked">
              <strong className={styles.stampBlockedText}>BLOCKED</strong>
              <span className={styles.stampBlockedRef}>POLICY REF: &gt; ₹1,500 HOLD</span>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Administrative Bar */}
        <footer className={styles.sceneFooter} data-split-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>{splitDefenseDemo.footer.tagline}</span>
          <span className={styles.footerCode}>{splitDefenseDemo.footer.code}</span>
        </footer>
      </div>
    </section>
  );
}
