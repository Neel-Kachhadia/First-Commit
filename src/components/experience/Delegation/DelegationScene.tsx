"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { delegationDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { AuthorityPass } from "@/components/documents/AuthorityPass";
import styles from "./DelegationScene.module.css";

type DelegationSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

// Film geometry (video px, 1280x720) measured from the approved clips.
// 02->03 last frame: the parent pass alone. 03->04 first frame: the full
// structure. The live passes are laid over these boxes at every viewport.
type Box = { x0: number; y0: number; x1: number; y1: number };
const FILM_W = 1280;
const FILM_H = 720;
const IN_PARENT: Box = { x0: 411, y0: 127, x1: 858, y1: 611 };
const OUT_BOX = {
  parent: { x0: 423, y0: 139, x1: 846, y1: 596 },
  grocery: { x0: 96, y0: 181, x1: 383, y1: 411 },
  delivery: { x0: 886, y0: 257, x1: 1162, y1: 478 },
  downstream: { x0: 126, y0: 473, x1: 364, y1: 660 },
} satisfies Record<string, Box>;

const CLIP_HIDDEN = "inset(0% 0% 100% 0%)";
const CLIP_SHOWN = "inset(0% 0% 0% 0%)";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Authority accounting as a pure function of scene progress, so it stays
// coherent under reverse scrub and direct jumps. Grocery's strip leaves the
// stock at 0.28-0.36, Delivery's at 0.62-0.70.
const GROCERY_PAID = [0.28, 0.36] as const;
const DELIVERY_PAID = [0.62, 0.7] as const;
function delegatedAt(p: number) {
  const g = smooth((p - GROCERY_PAID[0]) / (GROCERY_PAID[1] - GROCERY_PAID[0]));
  const d = smooth((p - DELIVERY_PAID[0]) / (DELIVERY_PAID[1] - DELIVERY_PAID[0]));
  return Math.round((1500 * g + 1000 * d) / 10) * 10;
}

export function DelegationScene({ trackRef }: DelegationSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;
      const prefersReduced = experienceStore.getState().reducedMotion;
      const scope = root.current;
      if (!scope) return;

      const q = <T extends HTMLElement>(sel: string) => scope.querySelector<T>(sel);
      const parent = q("[data-delegation-parent]");
      const grocery = q("[data-delegation-grocery]");
      const delivery = q("[data-delegation-delivery]");
      const downstream = q("[data-delegation-downstream]");
      const arena = q("[data-delegation-arena]");
      const allocatedEl = q("[data-accounting-allocated]");
      const remainingEl = q("[data-accounting-remaining]");
      const stockCapacityEl = q("[data-stock-capacity]");
      if (!parent || !grocery || !delivery || !downstream || !arena) return;

      // ---- Film-box geometry ------------------------------------------------
      // The video layer sits under the navbar and is object-fit: cover, so its
      // box (not the raw viewport) sets the film scale. Measured on demand.
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
      // Every pass is centred on the arena when untransformed (origin: centre).
      const arenaCenter = () => {
        const r = arena.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const slot = (el: HTMLElement, key: string, b: Box) => {
        const f = filmBox(key);
        const c = arenaCenter();
        return {
          x: f.ox + ((b.x0 + b.x1) / 2) * f.s - c.x,
          y: f.oy + ((b.y0 + b.y1) / 2) * f.s - c.y,
          scale: ((b.x1 - b.x0) * f.s) / el.offsetWidth,
        };
      };
      const inParent = () => slot(parent, "02-03", IN_PARENT);
      const outParent = () => slot(parent, "03-04", OUT_BOX.parent);
      const midParent = () => {
        const a = inParent();
        const b = outParent();
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, scale: (a.scale + b.scale) / 2 };
      };
      const outGrocery = () => slot(grocery, "03-04", OUT_BOX.grocery);
      const outDelivery = () => slot(delivery, "03-04", OUT_BOX.delivery);
      const outDownstream = () => slot(downstream, "03-04", OUT_BOX.downstream);
      // A child starts as its own registration boundary inside the parent's
      // stock band: same centre, same width.
      const fromFrame = (el: HTMLElement, name: "grocery" | "delivery") => {
        const frame = q(`[data-registration-frame='${name}']`);
        const c = arenaCenter();
        if (!frame) return { x: 0, y: 0, scale: 0.42 };
        const r = frame.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - c.x,
          y: r.top + r.height / 2 - c.y,
          scale: r.width / el.offsetWidth,
        };
      };

      const setBodyVisible = (visible: boolean) => {
        scope.style.visibility = visible ? "visible" : "hidden";
        scope.style.pointerEvents = visible ? "auto" : "none";
        scope.setAttribute("aria-hidden", visible ? "false" : "true");
        if (stageRef.current) stageRef.current.style.visibility = visible ? "visible" : "hidden";
      };

      const writeAccounting = (p: number) => {
        const delegated = delegatedAt(p);
        const remaining = 4000 - delegated;
        if (allocatedEl && allocatedEl.textContent !== rupees(delegated)) allocatedEl.textContent = rupees(delegated);
        if (remainingEl && remainingEl.textContent !== rupees(remaining)) remainingEl.textContent = rupees(remaining);
        const stock = `${rupees(remaining)} UNALLOCATED`;
        if (stockCapacityEl && stockCapacityEl.textContent !== stock) stockCapacityEl.textContent = stock;
      };

      // Passes scale/translate about their own centre.
      gsap.set([parent, grocery, delivery, downstream], { transformOrigin: "50% 50%" });

      if (prefersReduced) {
        setBodyVisible(true);
        if (!isMobile) {
          gsap.set(parent, outParent());
          gsap.set(grocery, { xPercent: -50, yPercent: -50, ...outGrocery() });
          gsap.set(delivery, { xPercent: -50, yPercent: -50, ...outDelivery() });
          gsap.set(downstream, { xPercent: -50, yPercent: -50, ...outDownstream() });
        }
        gsap.set([grocery, delivery, downstream], { opacity: 1 });
        gsap.set("[data-ledger-entry], [data-residue-scar], [data-sealed-boundary]", { opacity: 1 });
        gsap.set("[data-registration-frame], [data-frame-perf], [data-next-level-zone]", { opacity: 0 });
        gsap.set("[data-coupling-line]", { scaleX: 0 });
        writeAccounting(1);
        return;
      }

      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='delegation']" : scope);

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: triggerEl,
          start: "top top",
          end: isPersistent ? "bottom top" : "+=284%",
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("delegation", self.progress);
          },
        },
      });

      // Body visibility. start uses a 1px epsilon (not an authored overlap):
      // GSAP's onEnter for a non-scrubbed trigger needs progress strictly > 0,
      // so a scroll-restored deep link on the boundary pixel would otherwise
      // leave the body hidden until 1px more scroll.
      const announce = () =>
        window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "delegation" } }));
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
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

      // ---- Initial state: exactly the 02->03 film's last frame ---------------
      // Parent already established at full body, ledger and stock not yet
      // registered. Children exist only as boundaries inside the stock band.
      gsap.set("[data-parent-accounting], [data-allocation-stock]", { clipPath: CLIP_HIDDEN });
      gsap.set("[data-registration-frame], [data-frame-perf], [data-next-level-zone], [data-next-level-perf]", { opacity: 0 });
      gsap.set("[data-ledger-entry], [data-residue-scar], [data-sealed-boundary]", { opacity: 0 });
      gsap.set("[data-coupling-line]", { scaleX: 0 });
      gsap.set([grocery, delivery], { opacity: 0, boxShadow: "0 22px 40px rgba(0,0,0,0.5)" });
      gsap.set(downstream, { clipPath: CLIP_HIDDEN });
      writeAccounting(0);

      // Desktop passes are absolutely centred (xPercent/yPercent). Mobile passes
      // sit in flow (CSS forces transform: none there), so mobile gets no
      // transform tweens, only reveals.
      if (!isMobile) {
        gsap.set([grocery, delivery, downstream], { xPercent: -50, yPercent: -50 });
        gsap.set([grocery, delivery], { zIndex: 12 });
      }

      // =========================================================================
      // A — ESTABLISHED SOURCE (0.00 - 0.05): hold the film's frame untouched.
      // The source's accounting then registers (0.05 - 0.13): the ledger and the
      // derivation stock are drawn down onto the parent like a printed register.
      // =========================================================================
      if (!isMobile) {
        // Function-valued so the geometry is re-measured on every refresh.
        timeline.fromTo(
          parent,
          { x: () => inParent().x, y: () => inParent().y, scale: () => inParent().scale },
          { x: () => inParent().x, y: () => inParent().y, scale: () => inParent().scale, duration: 0.001, immediateRender: true },
          0,
        );
        // Depth demonstration sits at its film slot from the start (hidden by clip).
        timeline.fromTo(
          downstream,
          { x: () => outDownstream().x, y: () => outDownstream().y, scale: () => outDownstream().scale },
          { x: () => outDownstream().x, y: () => outDownstream().y, scale: () => outDownstream().scale, duration: 0.001, immediateRender: true },
          0,
        );
      }
      timeline
        .to("[data-parent-accounting]", { clipPath: CLIP_SHOWN, duration: 0.05, ease: "power1.inOut" }, 0.05)
        .to("[data-allocation-stock]", { clipPath: CLIP_SHOWN, duration: 0.05, ease: "power1.inOut" }, 0.08);

      // =========================================================================
      // B — FIRST DERIVATION: GROCERY (0.15 - 0.41)
      // A boundary defines 1,500 / WEEK inside SHOPPING's stock. It perforates,
      // then that strip is drawn out of the stock as the GROCERY pass and slides
      // to its sibling slot while the source's ledger pays it out.
      // =========================================================================
      timeline
        .to("[data-registration-frame='grocery']", { opacity: 1, duration: 0.05, ease: "power1.out" }, 0.15)
        .to("[data-frame-perf='grocery']", { opacity: 0.9, duration: 0.04, ease: "power1.out" }, 0.19)
        .to("[data-perforation='left']", { opacity: 0.9, duration: 0.04, ease: "power1.out" }, 0.19);
      if (!isMobile) {
        timeline
          .to("[data-coupling-line='left']", { scaleX: 1, duration: 0.1, ease: "power2.out" }, 0.22)
          .fromTo(
            grocery,
            {
              x: () => fromFrame(grocery, "grocery").x,
              y: () => fromFrame(grocery, "grocery").y,
              scale: () => fromFrame(grocery, "grocery").scale,
            },
            {
              x: () => outGrocery().x,
              y: () => outGrocery().y,
              scale: () => outGrocery().scale,
              duration: 0.14,
              ease: "power2.inOut",
              immediateRender: true,
            },
            0.23,
          )
          .to(
            parent,
            { x: () => midParent().x, y: () => midParent().y, scale: () => midParent().scale, duration: 0.1, ease: "power1.inOut" },
            0.28,
          );
      } else {
        timeline.fromTo(grocery, { clipPath: CLIP_HIDDEN }, { clipPath: CLIP_SHOWN, duration: 0.17, ease: "power2.inOut", immediateRender: true }, 0.17);
      }
      timeline
        .to(grocery, { opacity: 1, duration: 0.04, ease: "power1.out" }, 0.23)
        .to("[data-registration-frame='grocery']", { opacity: 0, duration: 0.04, ease: "power1.in" }, 0.27)
        .to("[data-ledger-entry='1']", { opacity: 1, duration: 0.03, ease: "power1.out" }, 0.36)
        .to("[data-residue-scar='1']", { opacity: 1, duration: 0.03, ease: "power1.out" }, 0.37)
        .to("[data-coupling-line='left']", { scaleX: 0, duration: 0.03, ease: "power1.in" }, 0.39);

      // =========================================================================
      // C — HOLD (0.41 - 0.49): SHOPPING + GROCERY + the remaining stock, readable.
      // =========================================================================

      // =========================================================================
      // D — SECOND, INDEPENDENT DERIVATION: DELIVERY (0.49 - 0.75)
      // Same grammar, drawn from SHOPPING's remaining stock, never from Grocery.
      // =========================================================================
      timeline
        .to("[data-registration-frame='delivery']", { opacity: 1, duration: 0.05, ease: "power1.out" }, 0.49)
        .to("[data-frame-perf='delivery']", { opacity: 0.9, duration: 0.04, ease: "power1.out" }, 0.53)
        .to("[data-perforation='right']", { opacity: 0.9, duration: 0.04, ease: "power1.out" }, 0.53);
      if (!isMobile) {
        timeline
          .to("[data-coupling-line='right']", { scaleX: 1, duration: 0.1, ease: "power2.out" }, 0.56)
          .fromTo(
            delivery,
            {
              x: () => fromFrame(delivery, "delivery").x,
              y: () => fromFrame(delivery, "delivery").y,
              scale: () => fromFrame(delivery, "delivery").scale,
            },
            {
              x: () => outDelivery().x,
              y: () => outDelivery().y,
              scale: () => outDelivery().scale,
              duration: 0.14,
              ease: "power2.inOut",
              immediateRender: true,
            },
            0.57,
          )
          .to(
            parent,
            { x: () => outParent().x, y: () => outParent().y, scale: () => outParent().scale, duration: 0.1, ease: "power1.inOut" },
            0.62,
          );
      } else {
        timeline.fromTo(delivery, { clipPath: CLIP_HIDDEN }, { clipPath: CLIP_SHOWN, duration: 0.17, ease: "power2.inOut", immediateRender: true }, 0.51);
      }
      timeline
        .to(delivery, { opacity: 1, duration: 0.04, ease: "power1.out" }, 0.57)
        .to("[data-registration-frame='delivery']", { opacity: 0, duration: 0.04, ease: "power1.in" }, 0.61)
        .to("[data-ledger-entry='2']", { opacity: 1, duration: 0.03, ease: "power1.out" }, 0.7)
        .to("[data-residue-scar='2']", { opacity: 1, duration: 0.03, ease: "power1.out" }, 0.71)
        .to("[data-coupling-line='right']", { scaleX: 0, duration: 0.03, ease: "power1.in" }, 0.73);

      // Mobile only: the pinned stage is one 100vh screen and the parent's full
      // ledger + stock + residue is too tall to sit above the depth
      // demonstration, so once both children exist that supporting detail folds
      // out of flow (TOTAL / DELEGATED / REMAINING have already registered).
      if (isMobile) {
        timeline.to(
          ["[data-parent-accounting]", "[data-allocation-stock]", "[data-allocation-residue]"],
          {
            height: 0,
            opacity: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
            overflow: "hidden",
            duration: 0.04,
            ease: "power1.inOut",
          },
          0.75,
        );
      }

      // =========================================================================
      // E — DEPTH STOPS AT 2 LEVELS (0.77 - 0.94)
      // GROCERY (level 1) bounds a secondary authority beneath itself (level 2);
      // a level-3 attempt stalls and the seam locks. Siblings do not move.
      // =========================================================================
      timeline
        .to(downstream, { clipPath: CLIP_SHOWN, duration: 0.07, ease: "power2.inOut" }, 0.77)
        .to("[data-next-level-zone]", { opacity: 1, duration: 0.02, ease: "power1.out" }, 0.84)
        .to("[data-next-level-perf]", { opacity: 0.85, duration: 0.03, ease: "power1.inOut" }, 0.85)
        .to("[data-next-level-perf]", { opacity: 0.18, duration: 0.025, ease: "power2.in" }, 0.88)
        .to("[data-next-level-zone]", { opacity: 0, duration: 0.02, ease: "power1.in" }, 0.905)
        .to("[data-sealed-boundary]", { opacity: 1, duration: 0.03, ease: "power2.out" }, 0.91)
        .to("[data-sealed-boundary]", { boxShadow: "0 0 0 1px var(--kp-red)", duration: 0.02 }, 0.94);

      // =========================================================================
      // F — TERMINAL HOLD (0.96 - 1.00): the 03->04 film's first frame, untouched.
      // =========================================================================
      timeline.set({}, {}, 1.0);

      // Single writer for accounting text.
      timeline.eventCallback("onUpdate", () => writeAccounting(timeline.progress()));

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
      data-scene="delegation"
      aria-labelledby="delegation-scene-title"
    >
      <div ref={stageRef} className={styles.stage} data-delegation-stage>
        {/* Scene title remains scene-owned; no upper metadata bar. */}
        <div className={styles.topArea}>
          {/* Institutional Scene Header Bar */}
          <header className={styles.sceneHeader} data-delegation-header>
            <div className={styles.headerLeft}>
              <span className={styles.sceneIndex}>03</span>
              <span className={styles.headerDivider}>/</span>
              <h2 id="delegation-scene-title" className={styles.headerTitle}>
                DELEGATION
              </h2>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.headerSub}>AUTHORITY CAN TRAVEL.</span>
              <span className={styles.headerMeta}>IT CANNOT MULTIPLY.</span>
            </div>
          </header>
        </div>

        {/* Main Composition Arena: Physical Authority Passes */}
        <div className={styles.arena} data-delegation-arena>
          {/* Sibling Derivation Coupling Lines (Desktop) */}
          <div className={styles.couplingLines} aria-hidden="true">
            <div className={styles.couplingLineLeft} data-coupling-line="left" />
            <div className={styles.couplingLineRight} data-coupling-line="right" />
          </div>

          {/* Center: Master Parent Authority Pass (SHOPPING ₹4,000) */}
          <div className={styles.parentContainer} data-delegation-parent>
            <AuthorityPass
              id={delegationDemo.parent.id}
              role="parent"
              category={delegationDemo.parent.category}
              totalLimit={delegationDemo.parent.totalLimit}
              depthRule={delegationDemo.parent.depthRule}
              reference={delegationDemo.parent.reference}
              allocated="₹0"
              remaining="₹4,000"
            />
          </div>

          <div className={styles.mobileSiblingsArea}>
            {/* Left Sibling Derived Pass: GROCERY ₹1,500 */}
            <div className={styles.groceryContainer} data-delegation-grocery>
              <AuthorityPass
                id={delegationDemo.grocery.id}
                role="derived"
                category={delegationDemo.grocery.category}
                amount={delegationDemo.grocery.amount}
                derivedFrom={delegationDemo.grocery.derivedFrom}
                level={delegationDemo.grocery.level}
                levelLabel={delegationDemo.grocery.levelLabel}
                remainingLabel={delegationDemo.grocery.remainingLabel}
              />
            </div>

            {/* Right Sibling Derived Pass: DELIVERY ₹1,000 */}
            <div className={styles.deliveryContainer} data-delegation-delivery>
              <AuthorityPass
                id={delegationDemo.delivery.id}
                role="derived"
                category={delegationDemo.delivery.category}
                amount={delegationDemo.delivery.amount}
                derivedFrom={delegationDemo.delivery.derivedFrom}
                level={delegationDemo.delivery.level}
                levelLabel={delegationDemo.delivery.levelLabel}
                remainingLabel={delegationDemo.delivery.remainingLabel}
              />
            </div>
          </div>

          {/* Downstream Demonstration Pass (Separate chain depth demonstration) */}
          <div className={styles.downstreamContainer} data-delegation-downstream>
            <AuthorityPass
              id={delegationDemo.downstreamDemo.id}
              role="downstream"
              category={delegationDemo.downstreamDemo.category}
              derivedFrom={delegationDemo.downstreamDemo.derivedFrom}
              level={delegationDemo.downstreamDemo.level}
              levelLabel={delegationDemo.downstreamDemo.levelLabel}
              remainingLabel={delegationDemo.downstreamDemo.remainingLabel}
            />
          </div>
        </div>

        {/* Bottom Institutional Administrative Bar */}
        <footer className={styles.sceneFooter} data-delegation-footer>
          <span className={styles.footerBrand}>KAVACHPAY</span>
          <span className={styles.footerTagline}>MONETARY CONTROL PLANE</span>
          <span className={styles.footerCode}>DELEGATION DISPATCH // 03</span>
        </footer>
      </div>
    </section>
  );
}
