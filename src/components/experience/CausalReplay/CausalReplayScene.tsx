"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { causalReplayDemo } from "@/lib/experience/demo-state";
import { CAUSAL_REPLAY_STAGE_WINDOWS } from "@/lib/experience/causal-replay";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import styles from "./CausalReplayScene.module.css";

type CausalReplayProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function CausalReplayScene({ trackRef }: CausalReplayProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReduced = experienceStore.getState().reducedMotion;

      if (prefersReduced) {
        if (!root.current || !stageRef.current) return;

        const triggerEl = trackRef?.current ?? "[data-track='causal-replay']";
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
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "causalReplay" } }));
          },
          onEnterBack: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "causalReplay" } }));
          },
          onLeave: () => applyReducedVisibility(false),
          onLeaveBack: () => applyReducedVisibility(false),
        });

        gsap.set("[data-replay-docket]", { opacity: 1, y: 0 });
        gsap.set("[data-replay-header]", { opacity: 1 });
        gsap.set("[data-replay-footer]", { opacity: 1 });
        gsap.set("[data-evidence-exposure]", { opacity: 0, y: 0, scale: 1 });
        gsap.set("[data-evidence-exposure='7']", { opacity: 1 });
        gsap.set("[data-gate-reticle]", { opacity: 1 });
        gsap.set("[data-full-chain]", { opacity: 1, y: 0 });
        return () => reducedVisibilityTrigger.kill();
      }

      if (!root.current || !stageRef.current) return;

      const isPersistent = Boolean(trackRef);
      const triggerEl =
        trackRef?.current ?? (isPersistent ? "[data-track='causal-replay']" : root.current);

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
          end: isPersistent ? "bottom top" : "+=420%",
          pin: false,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (self.progress > 0 && self.progress < 1) {
              if (experienceStore.getState().activeScene !== "causalReplay") {
                experienceStore.getState().setScene("causalReplay");
              }
            }
            progressBus.set("causalReplay", self.progress);
          },
        },
      });

      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          applyVisibility(true);
          gsap.set("[data-replay-docket]", { visibility: "visible", opacity: 1 });
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "causalReplay" } }),
          );
          // Suppress any lingering carrier elements from earlier scenes during Causal Replay
          document
            .querySelectorAll<HTMLElement>("[data-decision-register]")
            .forEach((el) => {
              el.style.visibility = "hidden";
            });
        },
        onEnterBack: () => {
          applyVisibility(true);
          gsap.set("[data-replay-docket]", { visibility: "visible", opacity: 1 });
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "causalReplay" } }),
          );
          document
            .querySelectorAll<HTMLElement>("[data-decision-register]")
            .forEach((el) => {
              el.style.visibility = "hidden";
            });
        },
        onLeave: () => {
          applyVisibility(false);
          gsap.set("[data-replay-docket]", { opacity: 0, visibility: "hidden" });
        },
        onLeaveBack: () => {
          applyVisibility(false);
          gsap.set("[data-replay-docket]", { opacity: 0, visibility: "hidden" });
          document
            .querySelectorAll<HTMLElement>("[data-decision-register]")
            .forEach((el) => {
              el.style.visibility = "";
            });
        },
      });

      // 07 -> 08 has no video transition; Scene 08 uses only its own entrance
      // (below) once the ownership trigger above reveals it.
      gsap.set("[data-replay-docket]", { opacity: 0, visibility: "visible", pointerEvents: "none" });

      gsap.set("[data-replay-footer]", { opacity: 0 });
      gsap.set("[data-evidence-exposure]", { opacity: 0, y: 16, scale: 0.98 });
      gsap.set("[data-full-chain]", { opacity: 0, y: 14 });
      gsap.set("[data-gate-reticle]", { opacity: 0 });

      // 0.00 - 0.10: Case docket establishes; depth opens around it.
      timeline
        .fromTo(
          "[data-replay-docket]",
          { y: -12 },
          { y: 0, duration: 0.08, ease: "power1.out" },
          0.0,
        )
        .to("[data-replay-footer]", { opacity: 1, duration: 0.06 }, 0.06)
        // 0.10 - 0.20: Physical inspection gate resolves in space; registration aperture activates
        .to("[data-gate-reticle]", { opacity: 1, duration: 0.08, ease: "power2.out" }, 0.12);

      // 0.20 - 0.96: 8 Causal Exposures pass mechanically through the inspection gate
      // Each exposure holds rock-solid in the aperture, then cleanly advances with zero text ghosting
      CAUSAL_REPLAY_STAGE_WINDOWS.forEach(([start, end], i) => {
        const isFirst = i === 0;
        const isLast = i === CAUSAL_REPLAY_STAGE_WINDOWS.length - 1;
        const selector = `[data-evidence-exposure="${i}"]`;

        const windowLen = end - start;
        const transit = Math.min(0.022, windowLen * 0.20);
        const enterStart = isFirst ? start - 0.015 : start - transit;
        const enterEnd = start + transit * 0.4;
        const exitStart = isLast ? 1.05 : end - transit;
        const exitEnd = end;

        // Mechanical seating into aperture
        timeline.fromTo(
          selector,
          { opacity: 0, y: 12, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: Math.max(0.01, enterEnd - enterStart),
            ease: "power2.out",
          },
          enterStart,
        );

        // Mechanical release from aperture towards take-up reel
        if (!isLast) {
          timeline.to(
            selector,
            {
              opacity: 0,
              y: -12,
              scale: 0.97,
              duration: Math.max(0.01, exitEnd - exitStart),
              ease: "power2.in",
            },
            exitStart,
          );
        }
      });

      // 0.96 - 1.00: Terminal Causal Reel composition holds
      // The complete unbroken chain is perceived across the continuous physical film
      timeline.to(
        "[data-full-chain]",
        { opacity: 1, y: 0, duration: 0.04, ease: "power2.out" },
        0.96,
      );

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
      className={styles.replaySection}
      data-scene="causal-replay"
      aria-label="Scene 08: Causal Replay"
    >
      <div ref={stageRef} className={styles.stage}>
        {/* Scene Editorial Header */}
        <header className={styles.sceneHeader} data-replay-header>
          <div className={styles.headerIndexWrap}>
            <span className={styles.sceneIndex}>{causalReplayDemo.header.index}</span>
            <div className={styles.headerText}>
              <h2 className={styles.sceneTitle}>{causalReplayDemo.header.title}</h2>
              <span className={styles.sceneMicrocopy}>{causalReplayDemo.header.microcopy}</span>
            </div>
          </div>
          <div className={styles.headerMeta}>
            <div>MANDATE {causalReplayDemo.mandateRef}</div>
            <div>8-STAGE FORENSIC REPLAY // RESULT → ORIGIN REWIND</div>
          </div>
        </header>

        {/* The Central Inspection Gate Arena */}
        <div className={styles.arena}>
          {/* Evidence docket carrier, registered inside the inspection plane. */}
          <div className={styles.docket} data-replay-docket>
            <span className={styles.docketLabel}>CASE DOCKET // {causalReplayDemo.subject.id}</span>
            <span className={styles.docketAmount}>{causalReplayDemo.subject.amount}</span>
            <span className={styles.docketMerchant}>{causalReplayDemo.subject.merchant}</span>
            <span className={styles.docketOutcome} data-status={causalReplayDemo.subject.outcome}>
              {causalReplayDemo.subject.outcome}
            </span>
            <span className={styles.docketNote}>CALLED FOR FORENSIC REPLAY // TRACING CAUSAL LINEAGE</span>
          </div>

          {/* Optical Gate Registration Reticle */}
          <div className={styles.gateReticle} data-gate-reticle aria-hidden="true">
            <span className={styles.reticleDatumTop}>REGISTRATION APERTURE // 70MM FORENSIC EMULSION</span>
            <div className={styles.gateRunnerTop} />
            <div className={styles.gateRunnerBottom} />
            <div className={styles.gateRailLeft} />
            <div className={styles.gateRailRight} />
            <div className={styles.cornerTL} />
            <div className={styles.cornerTR} />
            <div className={styles.cornerBL} />
            <div className={styles.cornerBR} />
            <div className={styles.gateTickTop} />
            <div className={styles.gateTickBottom} />
            <div className={styles.gateTickLeft} />
            <div className={styles.gateTickRight} />
          </div>

          {/* Registered Evidence Exposures on Physical Film */}
          {causalReplayDemo.layers.map((layer, i) => (
            <article
              key={layer.key}
              className={`${styles.evidenceExposure} ${
                layer.key === "budget"
                  ? styles.budgetExposure
                  : layer.key === "intent"
                  ? styles.intentExposure
                  : ""
              }`}
              data-evidence-exposure={i}
              data-exposure-key={layer.key}
              aria-label={`${layer.label}: ${layer.question}`}
            >
              {/* Archival Exposure Head */}
              <div className={styles.exposureHead}>
                <div className={styles.headLeft}>
                  <span className={styles.exposureIndex}>{layer.index}</span>
                  <span className={styles.exposureLabel}>{layer.label}</span>
                </div>
                {"badge" in layer && layer.badge ? (
                  <span className={styles.exposureBadge}>{layer.badge}</span>
                ) : null}
              </div>

              <p className={styles.exposureQuestion}>{layer.question}</p>

              {/* Special Temporal Breakdown for Budget State (§3 of directives) */}
              {layer.key === "budget" && "temporal" in layer && layer.temporal ? (
                <div className={styles.temporalContainer}>
                  {/* Phase 1: Before Reservation */}
                  <div className={styles.temporalBlock}>
                    <span className={styles.temporalPhaseTag}>1. BEFORE ATOMIC RESERVATION</span>
                    <dl className={styles.temporalGrid}>
                      {layer.temporal.before.map((f) => (
                        <div key={f.k} className={styles.temporalRow}>
                          <dt className={styles.fieldKey}>{f.k}</dt>
                          <dd className={styles.fieldVal}>{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Phase 2: Causal Event */}
                  <div className={styles.temporalEventBlock}>
                    <span className={styles.temporalEventTag}>2. ATOMIC CAUSAL EVENT</span>
                    <div className={styles.temporalEventRow}>
                      <span className={styles.eventLabel}>TX–1081 CLAIM COMMITTED</span>
                      <span className={styles.eventAmount}>RESERVES ₹1,249</span>
                    </div>
                  </div>

                  {/* Phase 3: After Reservation */}
                  <div className={styles.temporalBlock}>
                    <span className={styles.temporalPhaseTag}>3. AFTER RESERVATION // EVALUATED MOMENT</span>
                    <dl className={styles.temporalGrid}>
                      {layer.temporal.after.map((f) => (
                        <div key={f.k} className={styles.temporalRow}>
                          <dt className={styles.fieldKey}>{f.k}</dt>
                          <dd className={styles.fieldValHighlight}>{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <p className={styles.exposureProof}>{layer.temporal.proof}</p>
                </div>
              ) : layer.key === "intent" ? (
                /* Special Hero Composition for Original Intent (§19 of directives) */
                <div className={styles.intentContainer}>
                  <div className={styles.intentInstructionBox}>
                    <span className={styles.intentPromptLabel}>HUMAN OWNER INSTRUCTION:</span>
                    <p className={styles.intentPromptText}>“Buy groceries for me this week.”</p>
                  </div>
                  <dl className={styles.intentMetaGrid}>
                    {layer.fields.map((field) => (
                      <div className={styles.fieldRow} key={field.k}>
                        <dt className={styles.fieldKey}>{field.k}</dt>
                        <dd className={styles.fieldVal}>{field.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={styles.intentOriginStamp}>
                    <span className={styles.intentStampIcon}>✓</span>
                    <span>ORIGINATING HUMAN INTENT // DETERMINISTICALLY BOUND</span>
                  </div>
                </div>
              ) : (
                /* Standard High-Density Evidence Field Grid */
                <dl className={styles.exposureFields}>
                  {layer.fields.map((field) => (
                    <div className={styles.fieldRow} key={field.k}>
                      <dt className={styles.fieldKey}>{field.k}</dt>
                      <dd className={styles.fieldVal}>{field.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          ))}
        </div>

        {/* Terminal Full-Chain Spine: ONE OUTCOME. ONE UNBROKEN CAUSAL RECORD. (§20, §21) */}
        <div className={styles.fullChain} data-full-chain aria-label="Full causal chain">
          <span className={styles.fullChainLabel}>ONE OUTCOME. ONE UNBROKEN CAUSAL RECORD.</span>
          <div className={styles.fullChainSpine}>
            {causalReplayDemo.layers.map((layer) => (
              <span className={styles.fullChainNode} key={layer.key}>
                <span className={styles.nodeIdx}>{layer.index}</span>
                <span className={styles.nodeName}>{layer.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Scene Footer */}
        <footer className={styles.sceneFooter} data-replay-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>{causalReplayDemo.footer.tagline}</span>
          <span>{causalReplayDemo.footer.code}</span>
        </footer>
      </div>
    </section>
  );
}
