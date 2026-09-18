"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { decisionsDemo, delegationDemo } from "@/lib/experience/demo-state";
import { experienceStore } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { AuthorityPass } from "@/components/documents/AuthorityPass";
import { TransactionReceipt } from "@/components/documents/TransactionReceipt";
import { DecisionStamp } from "@/components/graphics/DecisionStamp";
import styles from "./DelegationScene.module.css";

type DelegationSceneProps = {
  trackRef?: React.RefObject<HTMLDivElement | null>;
};

export function DelegationScene({ trackRef }: DelegationSceneProps) {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 48rem)").matches;

      // Coordinate calculations based on viewport: zero overlap on desktop, compact flow on mobile
      const groceryTargetX = isMobile ? 0 : -450;
      const groceryTargetY = isMobile ? 0 : -65;
      const downstreamTargetX = isMobile ? 0 : -450;
      const downstreamTargetY = isMobile ? 0 : 230;
      const deliveryTargetX = isMobile ? 0 : 450;
      const deliveryTargetY = isMobile ? 0 : 0;
      const parentScaleSettle = isMobile ? 1 : 0.94;
      // Editorial refocus: Grocery becomes primary subject for the Level-2 depth demonstration
      const groceryFocusY = isMobile ? 0 : groceryTargetY - 18;
      const parentReceded = isMobile ? 1 : parentScaleSettle * 0.93;
      const deliveryReceded = isMobile ? 1 : 0.9;

      const prefersReduced = experienceStore.getState().reducedMotion;
      if (prefersReduced) {
        if (!root.current || !stageRef.current) return;

        // KP-MOTION-006: reduced motion changes animation behavior, not scene ownership --
        // this used to force visibility/pointer-events on unconditionally, staying true
        // (and interactive) even while a different scene owned the stage.
        const reducedTriggerEl = trackRef?.current ?? "[data-track='delegation']";
        const applyReducedVisibility = (visible: boolean) => {
          if (!root.current || !stageRef.current) return;
          root.current.style.visibility = visible ? "visible" : "hidden";
          root.current.style.pointerEvents = visible ? "auto" : "none";
          root.current.setAttribute("aria-hidden", visible ? "false" : "true");
          stageRef.current.style.visibility = visible ? "visible" : "hidden";
        };
        applyReducedVisibility(false);

        const reducedVisibilityTrigger = ScrollTrigger.create({
          trigger: reducedTriggerEl,
          start: "top top+=1px",
          end: "bottom top",
          onEnter: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "delegation" } }));
          },
          onEnterBack: () => {
            applyReducedVisibility(true);
            window.dispatchEvent(new CustomEvent("kp:scene", { detail: { id: "delegation" } }));
          },
          onLeave: () => applyReducedVisibility(false),
          onLeaveBack: () => applyReducedVisibility(false),
        });

        // Set all elements to resting static layout with proper offsets
        gsap.set("[data-delegation-parent]", { opacity: 1, scale: parentScaleSettle, x: 0, y: 0 });
        gsap.set("[data-delegation-grocery]", { opacity: 1, scale: 1, xPercent: -50, yPercent: -50, x: groceryTargetX, y: groceryTargetY });
        gsap.set("[data-delegation-delivery]", { opacity: 1, scale: 1, xPercent: -50, yPercent: -50, x: deliveryTargetX, y: deliveryTargetY });
        gsap.set("[data-delegation-downstream]", { opacity: 1, scaleY: 1, xPercent: -50, yPercent: -50, x: downstreamTargetX, y: downstreamTargetY });
        gsap.set("[data-sealed-boundary]", { opacity: 1, scale: 1 });
        // Coupling rails are a transient detachment cue, not a permanent graph line
        gsap.set("[data-coupling-line='left']", { scaleX: 0 });
        gsap.set("[data-coupling-line='right']", { scaleX: 0 });
        gsap.set("[data-decision-evidence-incoming]", { opacity: 0 });
        gsap.set("[data-delegation-header]", { opacity: 1, y: 0 });
        gsap.set("[data-delegation-footer]", { opacity: 1, y: 0 });
        gsap.set("[data-registration-frame]", { opacity: 0 });
        gsap.set("[data-frame-perf]", { opacity: 0 });
        gsap.set("[data-ledger-entry]", { opacity: 1 });
        gsap.set("[data-residue-scar]", { opacity: 1 });
        gsap.set("[data-next-level-zone]", { opacity: 0 });
        const allocEl = root.current?.querySelector<HTMLElement>("[data-accounting-allocated]");
        const remEl = root.current?.querySelector<HTMLElement>("[data-accounting-remaining]");
        const stockEl = root.current?.querySelector<HTMLElement>("[data-stock-capacity]");
        if (allocEl) allocEl.textContent = "₹2,500";
        if (remEl) remEl.textContent = "₹1,500";
        if (stockEl) stockEl.textContent = "₹1,500 UNALLOCATED";
        return () => reducedVisibilityTrigger.kill();
      }

      if (!root.current || !stageRef.current) return;

      const isPersistent = Boolean(trackRef);
      const triggerEl = trackRef?.current ?? (isPersistent ? "[data-track='delegation']" : root.current);

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
          pin: !isPersistent,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressBus.set("delegation", self.progress);
          },
        },
      });

      // Body visibility trigger scoped to Delegation's own true pinned window.
      // Neither edge bleeds into the neighbouring scene's body. Only the approved
      // receipt (incoming 02 -> 03) and Grocery authority pass (outgoing 03 -> 04)
      // survive through independent, pointerless bridge ownership.
      // start uses a 1px epsilon (not an authored overlap) because GSAP's onEnter
      // for a non-scrubbed trigger requires progress to strictly exceed 0 — landing
      // exactly on the boundary pixel (e.g. a scroll-restored deep link) would
      // otherwise leave the body hidden until 1px of further scroll. Confirmed via
      // direct ScrollTrigger probing; ScrollTrigger.refresh() alone does not fix it.
      const visibilityTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=1px",
        end: "bottom top",
        onEnter: () => {
          applyVisibility(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "delegation" } }),
          );
        },
        onEnterBack: () => {
          applyVisibility(true);
          window.dispatchEvent(
            new CustomEvent("kp:scene", { detail: { id: "delegation" } }),
          );
        },
        onLeave: () => {
          if (isPersistent) applyVisibility(false);
        },
        onLeaveBack: () => {
          applyVisibility(false);
        },
      });

      // Product-native 02 -> 03 carrier. Both technical copies render the same
      // approved receipt at the same viewport datum. Geometry is read only during
      // init/refresh; the scrub hot path performs writes only.
      const evidenceInEl = root.current.querySelector<HTMLElement>("[data-decision-evidence-incoming]");
      const evidenceOutEl = document.querySelector<HTMLElement>("[data-decision-evidence-outgoing]");
      let evidenceGeometry = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

      if (evidenceInEl) {
        gsap.set(evidenceInEl, { visibility: "visible", pointerEvents: "none" });
      }

      const measureEvidenceGeometry = () => {
        if (!evidenceInEl || !evidenceOutEl) return;
        gsap.set(evidenceInEl, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
        const outgoing = evidenceOutEl.getBoundingClientRect();
        const incoming = evidenceInEl.getBoundingClientRect();
        if (incoming.width === 0 || incoming.height === 0) return;
        evidenceGeometry = {
          x: outgoing.left - incoming.left,
          y: outgoing.top - incoming.top,
          scaleX: outgoing.width / incoming.width,
          scaleY: outgoing.height / incoming.height,
        };
        gsap.set(evidenceInEl, evidenceGeometry);
      };

      measureEvidenceGeometry();
      ScrollTrigger.addEventListener("refreshInit", measureEvidenceGeometry);

      const evidenceBridgeIn = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top+=100px",
        end: "top top",
        scrub: true,
        onUpdate: (self) => {
          if (!evidenceInEl) return;
          gsap.set(evidenceInEl, {
            ...evidenceGeometry,
            opacity: self.progress,
          });
        },
      });

      const evidenceSettleIn = ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top",
        end: "top top-=120px",
        scrub: true,
        onUpdate: (self) => {
          if (!evidenceInEl) return;
          gsap.set(evidenceInEl, {
            ...evidenceGeometry,
            opacity: 1 - self.progress,
          });
        },
      });

      // The Grocery derived pass is the actual 03 -> 04 paper carrier. It keeps
      // the approved perforated authority artifact alive; chapter header never
      // crosses the boundary.
      const derivedCarrierEl = root.current.querySelector<HTMLElement>("[data-delegation-grocery]");
      if (derivedCarrierEl) {
        gsap.set(derivedCarrierEl, { visibility: "visible", pointerEvents: "none" });
      }

      const documentBridgeOut = ScrollTrigger.create({
        trigger: triggerEl,
        start: "bottom top+=100px",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          if (derivedCarrierEl) gsap.set(derivedCarrierEl, { opacity: 1 - self.progress });
        },
      });

      // Accounting DOM helpers for deterministic scrub
      const allocatedEl = root.current.querySelector<HTMLElement>("[data-accounting-allocated]");
      const remainingEl = root.current.querySelector<HTMLElement>("[data-accounting-remaining]");
      const stockCapacityEl = root.current.querySelector<HTMLElement>("[data-stock-capacity]");

      // Incoming evidence opacity is owned by the bridge until the boundary;
      // the scene timeline then resolves the receipt into Shopping authority.
      gsap.set("[data-decision-evidence-incoming]", { opacity: 0 });
      gsap.set("[data-delegation-header]", { opacity: 0.85, y: 0 });
      gsap.set("[data-delegation-footer]", { opacity: 0.85, y: 0 });

      // Parent Pass starts centered, undelegated — primed at 0.00 so stage is never dead
      gsap.set("[data-delegation-parent]", {
        opacity: 0.62,
        scale: 0.98,
        y: 4,
      });
      gsap.set("[data-parent-accounting]", { opacity: 0, y: 6 });
      gsap.set("[data-allocation-stock]", { opacity: 0, y: 6 });

      // Grocery and Delivery do not exist as separate artifacts yet — they are
      // only ever seen first as a registration boundary inside the parent's stock band.
      // (Mobile CSS forces transform: none on these containers, so only opacity applies there.)
      gsap.set("[data-delegation-grocery]", {
        opacity: 0,
        xPercent: -50,
        yPercent: -50,
        x: groceryTargetX,
        y: groceryTargetY,
        scale: isMobile ? 1 : 0.42,
      });
      gsap.set("[data-delegation-delivery]", {
        opacity: 0,
        xPercent: -50,
        yPercent: -50,
        x: deliveryTargetX,
        y: deliveryTargetY,
        scale: isMobile ? 1 : 0.42,
      });

      // Registration frames + perforation + delegation event log + residue scars start inert
      gsap.set("[data-registration-frame]", { opacity: 0 });
      gsap.set("[data-frame-perf]", { opacity: 0 });
      gsap.set("[data-ledger-entry]", { opacity: 0 });
      gsap.set("[data-residue-scar]", { opacity: 0 });

      // Downstream Pass starts hidden directly beneath Grocery
      gsap.set("[data-delegation-downstream]", {
        opacity: 0,
        scaleY: 0,
        xPercent: -50,
        yPercent: -50,
        x: downstreamTargetX,
        y: isMobile ? 15 : 205,
        transformOrigin: "top center",
      });
      gsap.set("[data-next-level-zone]", { opacity: 0 });
      gsap.set("[data-sealed-boundary]", { opacity: 0, scale: 0.95 });

      // Coupling lines
      gsap.set("[data-coupling-line='left']", { scaleX: 0 });
      gsap.set("[data-coupling-line='right']", { scaleX: 0 });


      // =========================================================================
      // BEAT 1: APPROVED EVIDENCE -> PARENT REGISTRATION (0.00 - 0.14)
      // The approved Grocery receipt resolves into Shopping authority; ledger +
      // derivation stock then register before any child authority exists.
      // =========================================================================
      timeline
        // Header and footer reach full registration
        .to(
          "[data-delegation-header], [data-delegation-footer]",
          { opacity: 1, y: 0, duration: 0.04, ease: "power2.out" },
          0.01,
        )
        // Parent settles into full hero rest by 0.04
        .to(
          "[data-delegation-parent]",
          { opacity: 1, scale: 1, y: 0, duration: 0.04, ease: "power2.out" },
          0.01,
        )
        .call(
          () => {
            if (allocatedEl) allocatedEl.textContent = "₹0";
            if (remainingEl) remainingEl.textContent = "₹4,000";
            if (stockCapacityEl) stockCapacityEl.textContent = "₹4,000 UNALLOCATED";
          },
          undefined,
          0.06,
        )
        // Ledger + continuous derivation stock resolve as one authoritative group
        .fromTo(
          "[data-parent-accounting]",
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.08,
        )
        .fromTo(
          "[data-allocation-stock]",
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.1,
        );

      // =========================================================================
      // BEAT 2: GROCERY DERIVATION — the hero derivation (0.14 - 0.36)
      // A temporary registration boundary defines ₹1,500 / WEEK inside Shopping's
      // stock band. The boundary is visible and legible BEFORE anything separates.
      // Perforation activates, material tensions, then Grocery physically detaches.
      // =========================================================================
      timeline
        // Registration boundary defines itself inside the stock band
        .fromTo(
          "[data-registration-frame='grocery']",
          { opacity: 0 },
          { opacity: 1, duration: 0.05, ease: "power1.out" },
          0.14,
        )
        // Perforation activates along the boundary
        .fromTo(
          "[data-frame-perf='grocery']",
          { opacity: 0 },
          { opacity: 0.9, duration: 0.03, yoyo: true, repeat: 1 },
          0.19,
        )
        .fromTo(
          "[data-perforation='left']",
          { opacity: 0.35 },
          { opacity: 0.9, duration: 0.03, yoyo: true, repeat: 1 },
          0.19,
        )
        // Material tension — a brief physical pull before release, no bounce
        .to(
          "[data-registration-frame='grocery']",
          { scaleX: 0.985, duration: 0.02, ease: "power1.inOut", yoyo: true, repeat: 1 },
          0.21,
        )
        // Coupling rail extends toward left as the seam releases
        .fromTo(
          "[data-coupling-line='left']",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.06, ease: "power2.out" },
          0.23,
        )
        // Registration boundary fades as the physical Grocery pass grows out of it
        .to(
          "[data-registration-frame='grocery']",
          { opacity: 0, duration: 0.04, ease: "power1.in" },
          0.23,
        )
        .fromTo(
          "[data-delegation-grocery]",
          { opacity: 0, scale: isMobile ? 1 : 0.42, xPercent: -50, yPercent: -50, x: groceryTargetX, y: groceryTargetY },
          { opacity: 1, scale: 1, xPercent: -50, yPercent: -50, x: groceryTargetX, y: groceryTargetY, duration: 0.09, ease: "power2.out" },
          0.23,
        )
        // Parent settles fractionally as it yields authority
        .to(
          "[data-delegation-parent]",
          { scale: parentScaleSettle, duration: 0.08, ease: "power1.out" },
          0.24,
        )
        // Accounting responds because material left the source — effect follows cause
        .call(
          () => {
            if (allocatedEl) allocatedEl.textContent = "₹1,500";
            if (remainingEl) remainingEl.textContent = "₹2,500";
            if (stockCapacityEl) stockCapacityEl.textContent = "₹2,500 UNALLOCATED";
          },
          undefined,
          0.29,
        )
        .fromTo(
          "[data-ledger-entry='1']",
          { opacity: 0 },
          { opacity: 1, duration: 0.04, ease: "power1.out" },
          0.29,
        )
        // Shopping physically remembers the derivation — a scar, not an empty slot
        .fromTo(
          "[data-residue-scar='1']",
          { opacity: 0 },
          { opacity: 1, duration: 0.04, ease: "power1.out" },
          0.31,
        )
        // Short settle hold — Grocery gains a contact shadow, reads as detached
        .to(
          "[data-delegation-grocery]",
          { boxShadow: "0 22px 40px rgba(0,0,0,0.5)", duration: 0.05, ease: "power1.out" },
          0.31,
        )
        // Temporary coupling rail retracts once the child has settled — provenance
        // text carries the relationship from here, not a permanent connecting line
        .to(
          "[data-coupling-line='left']",
          { scaleX: 0, duration: 0.03, ease: "power1.in" },
          0.34,
        );

      // =========================================================================
      // BEAT 3: DELIVERY DERIVATION — confirms the rule, slightly quicker (0.36 - 0.54)
      // Same grammar as Grocery: boundary registers inside remaining stock,
      // perforates, tensions, detaches. Faster rhythm because the viewer already
      // understands the rule.
      // =========================================================================
      timeline
        .fromTo(
          "[data-registration-frame='delivery']",
          { opacity: 0 },
          { opacity: 1, duration: 0.04, ease: "power1.out" },
          0.36,
        )
        .fromTo(
          "[data-frame-perf='delivery']",
          { opacity: 0 },
          { opacity: 0.9, duration: 0.025, yoyo: true, repeat: 1 },
          0.4,
        )
        .fromTo(
          "[data-perforation='right']",
          { opacity: 0.35 },
          { opacity: 0.9, duration: 0.025, yoyo: true, repeat: 1 },
          0.4,
        )
        .to(
          "[data-registration-frame='delivery']",
          { scaleX: 0.985, duration: 0.015, ease: "power1.inOut", yoyo: true, repeat: 1 },
          0.415,
        )
        .fromTo(
          "[data-coupling-line='right']",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.05, ease: "power2.out" },
          0.43,
        )
        .to(
          "[data-registration-frame='delivery']",
          { opacity: 0, duration: 0.03, ease: "power1.in" },
          0.43,
        )
        .fromTo(
          "[data-delegation-delivery]",
          { opacity: 0, scale: isMobile ? 1 : 0.42, xPercent: -50, yPercent: -50, x: deliveryTargetX, y: deliveryTargetY },
          { opacity: 1, scale: 1, xPercent: -50, yPercent: -50, x: deliveryTargetX, y: deliveryTargetY, duration: 0.07, ease: "power2.out" },
          0.43,
        )
        .call(
          () => {
            if (allocatedEl) allocatedEl.textContent = "₹2,500";
            if (remainingEl) remainingEl.textContent = "₹1,500";
            if (stockCapacityEl) stockCapacityEl.textContent = "₹1,500 UNALLOCATED";
          },
          undefined,
          0.47,
        )
        .fromTo(
          "[data-ledger-entry='2']",
          { opacity: 0 },
          { opacity: 1, duration: 0.03, ease: "power1.out" },
          0.47,
        )
        .fromTo(
          "[data-residue-scar='2']",
          { opacity: 0 },
          { opacity: 1, duration: 0.03, ease: "power1.out" },
          0.485,
        )
        .to(
          "[data-delegation-delivery]",
          { boxShadow: "0 22px 40px rgba(0,0,0,0.5)", duration: 0.04, ease: "power1.out" },
          0.49,
        )
        .to(
          "[data-coupling-line='right']",
          { scaleX: 0, duration: 0.03, ease: "power1.in" },
          0.52,
        );

      // =========================================================================
      // BEAT 4: SIBLING HOLD + EDITORIAL REFOCUS (0.54 - 0.62)
      // A clear hold so the viewer registers both siblings as Shopping's children.
      // Then a deliberate subject change: Shopping and Delivery recede, Grocery
      // becomes the primary subject for the depth demonstration that follows.
      // =========================================================================
      timeline
        .to(
          "[data-delegation-parent]",
          { scale: parentReceded, opacity: 0.82, duration: 0.05, ease: "power1.inOut" },
          0.58,
        )
        .to(
          "[data-delegation-delivery]",
          { scale: deliveryReceded, opacity: 0.78, duration: 0.05, ease: "power1.inOut" },
          0.58,
        )
        .to(
          "[data-delegation-grocery]",
          { scale: 1.07, y: groceryFocusY, duration: 0.05, ease: "power1.inOut" },
          0.58,
        );

      // Mobile only: the pinned stage is a fixed 100vh with no internal scroll, and
      // Shopping's full ledger + stock band + residue detail is too tall to coexist
      // on-screen with the Level-2/Level-3 depth demonstration below it. Once focus
      // shifts to Grocery, that supplementary detail collapses out of flow — a
      // deliberate mobile recomposition, not a desktop-style dim. It stays collapsed
      // through the terminal hold (re-expanding it there would reintroduce the
      // overflow); TOTAL/DELEGATED/REMAINING already registered earlier in the scene.
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
            duration: 0.05,
            ease: "power1.inOut",
          },
          0.6,
        );
      }

      // =========================================================================
      // BEAT 5: LEVEL-2 DERIVATION FROM GROCERY (0.62 - 0.78)
      // Grocery — now Level 1 — bounds a secondary authority inside itself,
      // echoing the same registration → perforate → tension → separate grammar
      // at a tighter, smaller scale.
      // =========================================================================
      timeline
        // Grocery itself tensions fractionally, signalling material is being bounded
        .to(
          "[data-delegation-grocery]",
          { scaleY: 0.99, duration: 0.02, ease: "power1.inOut", yoyo: true, repeat: 1 },
          0.62,
        )
        .fromTo(
          "[data-delegation-downstream]",
          { opacity: 0, scaleY: 0, xPercent: -50, yPercent: -50, x: downstreamTargetX, y: isMobile ? 15 : 205 },
          {
            opacity: 1,
            scaleY: 1,
            xPercent: -50,
            yPercent: -50,
            x: downstreamTargetX,
            y: downstreamTargetY,
            duration: 0.08,
            ease: "power2.out",
          },
          0.64,
        );

      // =========================================================================
      // BEAT 6: LEVEL-3 ANTICIPATION & PHYSICAL REFUSAL (0.72 - 0.87)
      // The material briefly suggests another derivation is possible, then the
      // perforation stalls and the seam locks solid. Text records what the
      // material has already shown.
      // =========================================================================
      timeline
        // Anticipation: the next-level zone opens, perforation attempts to begin
        .fromTo(
          "[data-next-level-zone]",
          { opacity: 0 },
          { opacity: 1, duration: 0.03, ease: "power1.out" },
          0.72,
        )
        .fromTo(
          "[data-next-level-perf]",
          { opacity: 0 },
          { opacity: 0.85, duration: 0.025, ease: "power1.inOut" },
          0.74,
        )
        // The perforation stalls — attempt fails, does not complete
        .to(
          "[data-next-level-perf]",
          { opacity: 0.18, duration: 0.025, ease: "power2.in" },
          0.765,
        )
        // Seam locks solid — physical refusal, then the text confirms it
        .to(
          "[data-next-level-zone]",
          { opacity: 0, duration: 0.03, ease: "power1.in" },
          0.785,
        )
        .fromTo(
          "[data-sealed-boundary]",
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.05, ease: "power2.out" },
          0.79,
        )
        .to(
          "[data-sealed-boundary]",
          { boxShadow: "0 0 0 1px var(--kp-red)", duration: 0.04 },
          0.84,
        );

      // =========================================================================
      // BEAT 7: TERMINAL RESTING COMPOSITION (0.92 - 1.00)
      // Full hierarchy restored — Shopping dominant, both siblings clear,
      // the sealed depth boundary held. Portfolio stillness.
      // =========================================================================
      timeline
        .to(
          "[data-delegation-parent]",
          { scale: parentScaleSettle, opacity: 1, duration: 0.05, ease: "power1.out" },
          0.92,
        )
        .to(
          "[data-delegation-delivery]",
          { scale: 1, opacity: 1, duration: 0.05, ease: "power1.out" },
          0.92,
        )
        .to(
          "[data-delegation-grocery]",
          { scale: 1.04, opacity: 1, duration: 0.05, ease: "power1.out" },
          0.92,
        )
        .to("[data-delegation-downstream]", { opacity: 1, duration: 0.04 }, 0.92)
        .to("[data-delegation-footer]", { opacity: 1, duration: 0.04 }, 0.94)
        // 0.92 - 0.94: Full resting stillness hold sustained
        .set({}, {}, 0.94)
        // Non-carrier passes compact away. Grocery remains the single physical
        // perforated-document carrier into Step-Up.
        .to(
          "[data-delegation-parent], [data-delegation-delivery], [data-delegation-downstream]",
          { scale: parentScaleSettle * 0.90, y: -30, opacity: 0.8, duration: 0.04, ease: "power2.inOut" },
          0.955,
        )
        .to(
          "[data-delegation-header]",
          { opacity: 0, y: -8, duration: 0.03, ease: "power1.out" },
          0.955,
        )
        // Supporting bodies recede; the Grocery pass alone holds the boundary.
        .to(
          "[data-delegation-parent], [data-delegation-delivery], [data-delegation-downstream], [data-delegation-footer], [data-registration-frame]",
          { opacity: 0, duration: 0.02, ease: "power1.out" },
          0.98,
        )
        .set({}, {}, 1.0);

      // Support clean reverse scrubbing for accounting + event-log text
      timeline.eventCallback("onUpdate", () => {
        const p = timeline.progress();
        if (allocatedEl && remainingEl) {
          if (p < 0.29) {
            allocatedEl.textContent = "₹0";
            remainingEl.textContent = "₹4,000";
          } else if (p < 0.47) {
            allocatedEl.textContent = "₹1,500";
            remainingEl.textContent = "₹2,500";
          } else {
            allocatedEl.textContent = "₹2,500";
            remainingEl.textContent = "₹1,500";
          }
        }
        if (stockCapacityEl) {
          if (p < 0.29) {
            stockCapacityEl.textContent = "₹4,000 UNALLOCATED";
          } else if (p < 0.47) {
            stockCapacityEl.textContent = "₹2,500 UNALLOCATED";
          } else {
            stockCapacityEl.textContent = "₹1,500 UNALLOCATED";
          }
        }
      });

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", measureEvidenceGeometry);
        visibilityTrigger.kill();
        evidenceBridgeIn.kill();
        evidenceSettleIn.kill();
        documentBridgeOut.kill();
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
        {/* Incoming approved receipt: product-native 02 -> 03 evidence carrier. */}
        <div
          className={styles.evidenceCarrier}
          data-decision-evidence-incoming
          aria-hidden="true"
        >
          <TransactionReceipt
            id={decisionsDemo.allow.id}
            agent={decisionsDemo.allow.agent}
            category={decisionsDemo.allow.category}
            amount={decisionsDemo.allow.amount}
            mandateRef={decisionsDemo.allow.mandateRef}
            status="approved"
            stamp={<DecisionStamp tone="ink">APPROVED</DecisionStamp>}
          />
        </div>

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
