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

// Film geometry (video px, 1280x720) measured from the approved clips.
// 01->02 last frame: three lane labels (no letters, no receipts). 02->03 first
// frame: labels with letters, three receipts resting in their lanes.
type Box = { x0: number; y0: number; x1: number; y1: number };
const FILM_W = 1280;
const FILM_H = 720;
const LANES = ["allow", "stepup", "deny"] as const;
type Lane = (typeof LANES)[number];

const IN_LABEL: Record<Lane, Box> = {
  allow: { x0: 11, y0: 122, x1: 102, y1: 165 },
  stepup: { x0: 12, y0: 345, x1: 126, y1: 389 },
  deny: { x0: 12, y0: 569, x1: 83, y1: 612 },
};
const OUT_LABEL: Record<Lane, Box> = {
  allow: { x0: 29, y0: 129, x1: 116, y1: 170 },
  stepup: { x0: 30, y0: 346, x1: 141, y1: 387 },
  deny: { x0: 30, y0: 566, x1: 99, y1: 604 },
};
const OUT_RECEIPT: Record<Lane, Box> = {
  allow: { x0: 639, y0: 74, x1: 876, y1: 224 },
  stepup: { x0: 492, y0: 292, x1: 729, y1: 443 },
  deny: { x0: 459, y0: 509, x1: 696, y1: 659 },
};
// Mobile has no film: receipts rest at these fractions of the track width.
// Continuity travels furthest, interruption stops mid-lane, termination earliest.
const MOBILE_REST: Record<Lane, number> = { allow: 0.66, stepup: 0.5, deny: 0.4 };

export function DecisionsScene({ trackRef }: DecisionsSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !stageRef.current) return;
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const prefersReduced = experienceStore.getState().reducedMotion;

      const one = <T extends HTMLElement>(sel: string) => scope.querySelector<T>(sel);
      const carriage = (l: Lane) => one(`[data-receipt-wrap='${l}']`)!;
      const wrap = (l: Lane) => one(`[data-lane-tagwrap='${l}']`)!;
      if (LANES.some((l) => !carriage(l) || !wrap(l))) return;

      // ---- Film-box geometry (see DelegationScene: the layer sits under the
      // navbar and is object-fit: cover, so its box sets the film scale). ----
      const filmBox = (key: string) => {
        const box = document.querySelector<HTMLElement>(`video[src*="${key}"]`)?.getBoundingClientRect();
        const bw = box?.width || window.innerWidth;
        const bh = box?.height || window.innerHeight;
        const s = Math.max(bw / FILM_W, bh / FILM_H);
        return {
          s,
          ox: (box?.left ?? 0) - (FILM_W * s - bw) / 2,
          oy: (box?.top ?? 0) - (FILM_H * s - bh) / 2,
        };
      };
      const tx = (el: Element) => Number(gsap.getProperty(el, "x")) || 0;
      const ty = (el: Element) => Number(gsap.getProperty(el, "y")) || 0;

      // Label wraps rest at their live layout position. The film frames the labels
      // at the edge of the video (no page gutter), so absolute film positions
      // cannot be used without pushing the letters off-screen; instead the live
      // labels follow the film's own relative IN -> OUT settle (letters
      // register, labels yield the space), offset by that shift at scene start.
      const labelStart = (l: Lane) => {
        const f = filmBox("01-02");
        return {
          x: (IN_LABEL[l].x0 - OUT_LABEL[l].x0) * f.s,
          y: (IN_LABEL[l].y0 - OUT_LABEL[l].y0) * f.s,
        };
      };

      // Receipts: centred on the track at 36% (CSS) when untransformed.
      const natural = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { cx: r.left + r.width / 2 - tx(el), cy: r.top + r.height / 2 - ty(el) };
      };
      const trackOf = (l: Lane) => carriage(l).parentElement!.getBoundingClientRect();
      const rest = (l: Lane) => {
        const el = carriage(l);
        const n = natural(el);
        if (isMobile) {
          const t = trackOf(l);
          return { x: t.left + MOBILE_REST[l] * t.width - n.cx, y: 0, scale: 1 };
        }
        const f = filmBox("02-03");
        const b = OUT_RECEIPT[l];
        return {
          x: f.ox + ((b.x0 + b.x1) / 2) * f.s - n.cx,
          y: f.oy + ((b.y0 + b.y1) / 2) * f.s - n.cy,
          scale: ((b.x1 - b.x0) * f.s) / el.offsetWidth,
        };
      };
      // Fully left of the lane track, level with its rest position.
      const start = (l: Lane) => {
        const el = carriage(l);
        const n = natural(el);
        const r = rest(l);
        const t = trackOf(l);
        return { x: t.left - (el.offsetWidth * r.scale) / 2 - n.cx, y: r.y, scale: r.scale };
      };
      // Just short of the rest slot, for the abrupt stop of STEP-UP and DENY.
      const approach = (l: Lane, fraction: number) => {
        const a = start(l);
        const b = rest(l);
        return { x: a.x + (b.x - a.x) * fraction, y: b.y, scale: b.scale };
      };

      const setBodyVisible = (visible: boolean) => {
        scope.style.visibility = visible ? "visible" : "hidden";
        scope.style.pointerEvents = visible ? "auto" : "none";
        scope.setAttribute("aria-hidden", visible ? "false" : "true");
        if (stageRef.current) stageRef.current.style.visibility = visible ? "visible" : "hidden";
      };

      // Receipts emerge from their lane track, never over the lane label: clip
      // each track to start just past its label (labels can be wider than the
      // label column). Static layout, re-measured on every ScrollTrigger refresh.
      const clipTracks = () =>
        LANES.forEach((l) => {
          const track = carriage(l).parentElement!;
          const label = wrap(l).getBoundingClientRect();
          const box = track.getBoundingClientRect();
          // Only when label and track share a row (desktop); on mobile the label sits above.
          const sameRow = label.bottom - ty(wrap(l)) > box.top + 4 && label.top - ty(wrap(l)) < box.bottom - 4;
          const inset = sameRow ? Math.max(0, label.right - tx(wrap(l)) + 12 - box.left) : 0;
          track.style.clipPath = `inset(0px 0px 0px ${inset}px)`;
        });

      // Receipts own their transform completely (CSS centres them with translateX(-50%)).
      gsap.set(LANES.map(carriage), { xPercent: -50, x: 0, y: 0 });

      if (prefersReduced) {
        setBodyVisible(true);
        LANES.forEach((l) => gsap.set(carriage(l), { opacity: 1, ...rest(l) }));
        gsap.set("[data-stamp], [data-note], [data-gate], [data-barrier], [data-lane-letter], [data-lane-rule]", { opacity: 1 });
        gsap.set("[data-gate], [data-barrier]", { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='decisions']" : scope);

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: triggerEl,
          start: "top top",
          end: isPersistent ? "bottom top" : "+=184%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("decisions", self.progress);
          },
        },
      });

      // Body visibility. Desktop: 1px epsilon (not an authored overlap): GSAP's
      // onEnter for a non-scrubbed trigger needs progress strictly > 0.
      // Mobile has no film: Mandate's body deliberately lingers 120px past its
      // end (it sits under the desktop film), so mobile hands over at that point.
      const announce = () =>
        window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "decisions" } }));
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: isMobile ? "top top-=120px" : "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          setBodyVisible(true);
          announce();
        },
        onEnterBack: () => {
          setBodyVisible(true);
          announce();
        },
        onLeave: () => {
          if (isPersistent) setBodyVisible(false);
        },
        onLeaveBack: () => setBodyVisible(false),
      });

      clipTracks();
      ScrollTrigger.addEventListener("refresh", clipTracks);

      // ---- Initial state: exactly the 01->02 film's last frame ---------------
      // Apparatus already established: labels, descriptors, lane lines, header,
      // footer. Not yet present: lane letters, sprocket rows, receipts, stamps,
      // notes, the STEP-UP gate and the DENY barrier.
      const HIDE_TOP = "inset(0% 0% 100% 0%)";
      const SHOW = "inset(0% 0% 0% 0%)";
      gsap.set("[data-lane-letter]", { opacity: 0, x: -10 });
      gsap.set("[data-lane-sprockets]", { opacity: 0 });
      gsap.set("[data-stamp]", { opacity: 0 });
      gsap.set("[data-note]", { opacity: 0, x: 12 });
      gsap.set("[data-gate]", { opacity: 0, clipPath: HIDE_TOP });
      gsap.set("[data-barrier]", { opacity: 0, clipPath: "inset(0% 50% 0% 50%)" });
      gsap.set(LANES.map(carriage), { opacity: 0 });

      // =========================================================================
      // A — DECISION APPARATUS ESTABLISHED (0.00 - 0.05 hold; 0.05 - 0.13)
      // The film hands over the labels; here the lanes register their identity:
      // letters A / B / C take their place (the labels yield the space they
      // occupy), and the sprocket rows appear along the three lanes.
      // =========================================================================
      LANES.forEach((l) => {
        timeline.fromTo(
          wrap(l),
          { x: () => labelStart(l).x, y: () => labelStart(l).y },
          { x: 0, y: 0, duration: 0.08, ease: "power2.inOut", immediateRender: true },
          0.05,
        );
      });
      timeline
        .to("[data-lane-letter]", { opacity: 1, x: 0, duration: 0.06, ease: "power2.out" }, 0.07)
        .to("[data-lane-sprockets]", { opacity: 0.55, duration: 0.08 }, 0.05);

      // Lane focus: the active outcome is full strength, the others sit back
      // until the comparative resolution restores all three.
      const focus = (active: Lane, at: number) => {
        LANES.forEach((l) =>
          timeline.to(`[data-lane='${l}']`, { opacity: l === active ? 1 : 0.5, duration: 0.03 }, at),
        );
      };

      // =========================================================================
      // B — ALLOW: CONTINUITY (0.13 - 0.39)
      // One uninterrupted glide. Nothing clamps, nothing stops: the stamp lands
      // on the receipt while it is still moving and the lane stays open ahead.
      // =========================================================================
      focus("allow", 0.13);
      timeline
        .fromTo(
          carriage("allow"),
          { x: () => start("allow").x, y: () => start("allow").y, scale: () => start("allow").scale },
          { x: () => rest("allow").x, y: () => rest("allow").y, scale: () => rest("allow").scale, duration: 0.22, ease: "sine.out", immediateRender: true },
          0.15,
        )
        .to(carriage("allow"), { opacity: 1, duration: 0.04, ease: "power1.out" }, 0.15)
        .fromTo("[data-stamp='allow']", { opacity: 0, scale: 1.35, rotate: -8 }, { opacity: 1, scale: 1, rotate: -2, duration: 0.05, ease: "power2.out", immediateRender: true }, 0.28)
        .to("[data-note='allow']", { opacity: 1, x: 0, duration: 0.05 }, 0.34);

      // =========================================================================
      // C — STEP-UP: INTERRUPTION (0.39 - 0.65)
      // Same approach, then the path is sharply arrested at the threshold; a
      // gate clamps down on the held slip. Autonomy ends here: it waits.
      // (The clearance itself belongs to Scene 04.)
      // =========================================================================
      focus("stepup", 0.39);
      timeline
        .fromTo(
          carriage("stepup"),
          { x: () => start("stepup").x, y: () => start("stepup").y, scale: () => start("stepup").scale },
          { x: () => approach("stepup", 0.9).x, y: () => approach("stepup", 0.9).y, scale: () => approach("stepup", 0.9).scale, duration: 0.12, ease: "power1.in", immediateRender: true },
          0.42,
        )
        .to(carriage("stepup"), { opacity: 1, duration: 0.04, ease: "power1.out" }, 0.42)
        .to(carriage("stepup"), { x: () => rest("stepup").x, y: () => rest("stepup").y, scale: () => rest("stepup").scale, duration: 0.045, ease: "expo.out" }, 0.54)
        .to("[data-gate='stepup']", { opacity: 1, clipPath: SHOW, duration: 0.04, ease: "power3.out" }, 0.585)
        .fromTo("[data-stamp='stepup']", { opacity: 0, scale: 1.4, rotate: 6 }, { opacity: 1, scale: 1, rotate: 3, duration: 0.04, ease: "power2.out", immediateRender: true }, 0.61)
        .to("[data-note='stepup']", { opacity: 1, x: 0, duration: 0.05 }, 0.62);

      // =========================================================================
      // D — DENY: TERMINATION (0.65 - 0.89)
      // The route itself ends: a barrier closes ahead, the remaining route dies
      // away, and the slip halts dead against it. No gate, no way onward.
      // =========================================================================
      focus("deny", 0.65);
      timeline
        .fromTo(
          carriage("deny"),
          { x: () => start("deny").x, y: () => start("deny").y, scale: () => start("deny").scale },
          { x: () => approach("deny", 0.88).x, y: () => approach("deny", 0.88).y, scale: () => approach("deny", 0.88).scale, duration: 0.1, ease: "power1.in", immediateRender: true },
          0.67,
        )
        .to(carriage("deny"), { opacity: 1, duration: 0.04, ease: "power1.out" }, 0.67)
        .to("[data-barrier='deny']", { opacity: 1, clipPath: SHOW, duration: 0.04, ease: "power2.out" }, 0.72)
        .to("[data-track-remaining='deny']", { opacity: 0.12, duration: 0.05 }, 0.74)
        .to(carriage("deny"), { x: () => rest("deny").x, y: () => rest("deny").y, scale: () => rest("deny").scale, duration: 0.035, ease: "power3.out" }, 0.77)
        .fromTo("[data-stamp='deny']", { opacity: 0, scale: 1.5, rotate: -9 }, { opacity: 1, scale: 1, rotate: -4, duration: 0.03, ease: "power2.out", immediateRender: true }, 0.81)
        .to("[data-note='deny']", { opacity: 1, x: 0, duration: 0.05 }, 0.84);

      // =========================================================================
      // E — COMPARATIVE RESOLUTION (0.89 - 0.94): all three lanes at full
      // strength together — continuity, interruption, termination.
      // F — TERMINAL HOLD (0.94 - 1.00): the 02->03 film's first frame, untouched.
      // =========================================================================
      LANES.forEach((l) => timeline.to(`[data-lane='${l}']`, { opacity: 1, duration: 0.05, ease: "power1.inOut" }, 0.89));
      timeline.set({}, {}, 1.0);

      return () => {
        ScrollTrigger.removeEventListener("refresh", clipTracks);
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
              <div className={styles.laneTagWrap} data-lane-tagwrap="allow">
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
              <div className={styles.laneTagWrap} data-lane-tagwrap="stepup">
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
              <div className={styles.laneTagWrap} data-lane-tagwrap="deny">
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
