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
          end: isPersistent ? "bottom top" : "+=294%",
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
          gsap.set("[data-temporal-aperture]", { visibility: "visible" });
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "splitDefense" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          gsap.set("[data-temporal-aperture]", { visibility: "visible" });
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "splitDefense" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) {
            applyVisibility(false);
            gsap.set("[data-temporal-aperture]", { opacity: 0, visibility: "hidden" });
          }
        },
        onLeaveBack: () => {
          applyVisibility(false);
          gsap.set("[data-temporal-aperture]", { opacity: 0, visibility: "hidden" });
        },
      });

      // Incoming 05->06 transition already lands with all three receipts
      // spread and legible (its own terminal content). The live scene begins
      // there — no entry animation to replay — and performs only the
      // remaining product story: correlation, aggregation, one economic
      // action, block.
      const rec1Rest = isMobile
        ? { x: 0, y: 0, rotate: -1 }
        : { x: -280, y: 15, rotate: -2 };
      const rec2Rest = isMobile
        ? { x: 0, y: 0, rotate: 1 }
        : { x: 0, y: -10, rotate: 1.2 };
      const rec3Rest = isMobile
        ? { x: 0, y: 0, rotate: -0.5 }
        : { x: 280, y: 10, rotate: -1.5 };

      // Set initial element states: receipts already at rest (matching the
      // transition's terminal frame), everything downstream still hidden.
      gsap.set("[data-split-receipt='TX-1091']", { ...rec1Rest, opacity: 1 });
      gsap.set("[data-split-receipt='TX-1092']", { ...rec2Rest, opacity: 1 });
      gsap.set("[data-split-receipt='TX-1093']", { ...rec3Rest, opacity: 1 });
      gsap.set("[data-split-footer]", { opacity: 1 });
      gsap.set("[data-temporal-aperture]", { opacity: 0, scaleY: 0.8 });
      gsap.set("[data-registration-datum]", { opacity: 0, scaleX: 0 });
      gsap.set("[data-ledger-tally]", { opacity: 0, y: 15 });
      gsap.set("[data-dossier-backing]", { opacity: 0, scale: 0.96, y: 20 });
      gsap.set("[data-stamp-economic-action]", { opacity: 0, scale: 1.5, rotate: -6 });
      gsap.set("[data-stamp-blocked]", { opacity: 0, scale: 1.6, rotate: 4 });

      // =========================================================================
      // STAGE A — OPENING HOLD (0.00 - 0.06)
      // Composition stays exactly at the transition's terminal frame so the
      // video -> DOM handoff is invisible.
      // =========================================================================
      timeline.set({}, {}, 0.06);

      // =========================================================================
      // STAGE B — TEMPORAL WINDOW ENGAGES & SPATIAL CONVERGENCE (0.06 - 0.30)
      // The physical Temporal Review Aperture brackets close around 10:00-10:15.
      // Receipts translate into tight horizontal proximity and snap to 0deg —
      // three independent purchases visually becoming one cluster.
      // =========================================================================
      timeline
        .to(
          "[data-temporal-aperture]",
          { opacity: 1, scaleY: 1, duration: 0.12, ease: "power2.out" },
          0.06,
        )
        .to(
          "[data-split-receipt='TX-1091']",
          { x: isMobile ? 0 : -250, y: 0, rotate: 0, duration: 0.18, ease: "power2.inOut" },
          0.10,
        )
        .to(
          "[data-split-receipt='TX-1092']",
          { x: 0, y: 0, rotate: 0, duration: 0.18, ease: "power2.inOut" },
          0.10,
        )
        .to(
          "[data-split-receipt='TX-1093']",
          { x: isMobile ? 0 : 250, y: 0, rotate: 0, duration: 0.18, ease: "power2.inOut" },
          0.10,
        );

      // =========================================================================
      // STAGE C — IDENTITY EVIDENCE REGISTRATION (0.30 - 0.58)
      // Horizontal forensic datum lines snap across the 3 repeated fields:
      // 1. MARKET MART MUMBAI  2. VIA AGENT ZEPTO  3. PURPOSE GROCERY
      // Redundancy becomes visually undeniable, one field at a time.
      // =========================================================================
      timeline
        .to(
          "[data-registration-datum='merchant']",
          { opacity: 1, scaleX: 1, duration: 0.08, ease: "power1.out" },
          0.30,
        )
        .to(
          "[data-registration-datum='agent']",
          { opacity: 1, scaleX: 1, duration: 0.08, ease: "power1.out" },
          0.40,
        )
        .to(
          "[data-registration-datum='purpose']",
          { opacity: 1, scaleX: 1, duration: 0.08, ease: "power1.out" },
          0.50,
        );

      // =========================================================================
      // STAGE D — ACCOUNTING AGGREGATION (0.58 - 0.74)
      // Ledger tally bracket activates: ₹1,000 + ₹1,000 + ₹1,000 = ₹3,000.
      // Proves why evasion fails: ₹3,000 > ₹1,500 threshold!
      // =========================================================================
      timeline
        .to(
          "[data-ledger-tally]",
          { opacity: 1, y: 0, duration: 0.10, ease: "power2.out" },
          0.58,
        )
        .to(
          "[data-tally-breach]",
          { color: "var(--kp-red)", scale: 1.04, duration: 0.05, ease: "power1.out" },
          0.66,
        );

      // =========================================================================
      // STAGE E — DOSSIER LOCK (0.74 - 0.84)
      // Underlying correlation dossier locks the 3 slips into one composite case.
      // =========================================================================
      timeline.to(
        "[data-dossier-backing]",
        { opacity: 1, scale: 1, y: 0, duration: 0.10, ease: "power2.out" },
        0.74,
      );

      // =========================================================================
      // STAGE F — PRIMARY STAMP: ONE ECONOMIC ACTION (0.84 - 0.90)
      // Anticipation -> Impact -> Settle. Deliberately sudden — a stamp lands.
      // =========================================================================
      timeline
        .to(
          "[data-stamp-economic-action]",
          { opacity: 0.4, scale: 1.25, rotate: -4, duration: 0.02 },
          0.84,
        )
        .to(
          "[data-stamp-economic-action]",
          { opacity: 1, scale: 0.98, rotate: -2.5, duration: 0.025, ease: "power4.in" },
          0.86,
        )
        .to(
          "[data-stamp-economic-action]",
          { scale: 1, duration: 0.02, ease: "power1.out" },
          0.885,
        );

      // =========================================================================
      // STAGE G — SECONDARY ENFORCEMENT STAMP: BLOCKED (0.90 - 0.95)
      // Authoritative administrative box stamp records BLOCKED. Also sudden.
      // =========================================================================
      timeline
        .to(
          "[data-stamp-blocked]",
          { opacity: 0.5, scale: 1.3, rotate: 2.5, duration: 0.015 },
          0.90,
        )
        .to(
          "[data-stamp-blocked]",
          { opacity: 1, scale: 0.98, rotate: 1.2, duration: 0.02, ease: "power4.in" },
          0.915,
        )
        .to(
          "[data-stamp-blocked]",
          { scale: 1, duration: 0.015, ease: "power1.out" },
          0.935,
        );

      // =========================================================================
      // STAGE H — TERMINAL HOLD (0.95 - 1.00)
      // Resolved case stays stable — this is the frame the 06->07 transition
      // begins from.
      // =========================================================================
      timeline.set({}, {}, 1.00);

      // Dynamic text updates for status displays during scrub
      timeline.eventCallback("onUpdate", () => {
        const p = timeline.progress();
        const aperEl = apertureStatusRef.current;

        if (aperEl) {
          if (p < 0.06) {
            aperEl.textContent = "MONITORING WINDOW: 10:00–10:15";
          } else if (p < 0.30) {
            aperEl.textContent = "TEMPORAL WINDOW ENGAGED // CONVERGING";
          } else if (p < 0.58) {
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
