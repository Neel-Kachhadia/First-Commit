"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { progressBus } from "@/lib/experience/progress-bus";

export function DebugStageHUD() {
  const enabled = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("debug") === "stage",
    () => false,
  );
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = Math.max(1, now - lastTime);
      const fps = Math.round(1000 / delta);
      lastTime = now;

      const currentScrollY = Math.round(window.scrollY);
      const scrollVelocity = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      const activeScene = progressBus.getActiveScene();
      const progress = progressBus.get(activeScene);

      // Scene ownership audit: a scene "body" counts as visibly active when its
      // section root computes visibility:visible. Ordinarily exactly 1. During a
      // boundary handoff, at most 2 may briefly compute visible (one collapsing,
      // one establishing) — 3+ is a hard ownership regression (two complete
      // scenes stacked). Carriers are read independently since they intentionally
      // override an invisible root during a bridge pre-roll window.
      const sceneRoots = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scene]"),
      ).map((el) => ({
        id: el.getAttribute("data-scene"),
        visible: window.getComputedStyle(el).visibility === "visible",
        pointerEvents: window.getComputedStyle(el).pointerEvents,
      }));
      const visibleRoots = sceneRoots.filter((s) => s.visible);

      const carrierSelectors: Array<[string, string]> = [
        ["decisionRegisterOut", "[data-decision-register-outgoing]"],
        ["decisionRegisterIn", "[data-decision-register]"],
        ["authorityFolioOut", "[data-authority-folio-outgoing]"],
        ["authorityFolioIn", "[data-authority-folio]"],
        ["revocationFolio", "[data-revocation-folio]"],
      ];
      const carrierOpacities = carrierSelectors.map(([label, selector]) => {
        const el = document.querySelector<HTMLElement>(selector);
        const opacity = el ? parseFloat(window.getComputedStyle(el).opacity) : 0;
        return { label, opacity };
      });
      const visibleCarriers = carrierOpacities.filter((c) => c.opacity > 0.05);

      const ownershipFail = visibleRoots.length > 2;

      if (hudRef.current) {
        hudRef.current.innerHTML = `
          <div style="color:#a92a24;font-weight:700;margin-bottom:0.25rem">[STAGE DEBUG HUD]</div>
          <div>VIEWPORT: ${window.innerWidth} × ${window.innerHeight}px</div>
          <div>SCROLL_Y: ${currentScrollY}px (Δ ${scrollVelocity}px)</div>
          <div>SCENE: <strong style="color:#fff">${activeScene.toUpperCase()}</strong></div>
          <div>PROGRESS: ${(progress * 100).toFixed(1)}%</div>
          <div>FRAME_PACE: ${delta.toFixed(1)}ms (~${fps} FPS)</div>
          <div style="margin-top:0.35rem;color:${ownershipFail ? "#ff4444" : "#8fdc8f"}">
            VISIBLE_ROOTS: ${visibleRoots.length} [${visibleRoots.map((s) => s.id).join(", ") || "none"}]
            ${ownershipFail ? " ⚠ OWNERSHIP FAIL" : ""}
          </div>
          <div>VISIBLE_CARRIERS: ${
            visibleCarriers.length
              ? visibleCarriers.map((c) => `${c.label}=${c.opacity.toFixed(2)}`).join(", ")
              : "none"
          }</div>
        `;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside
      ref={hudRef}
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        background: "rgba(10, 10, 10, 0.92)",
        border: "1px solid rgba(235, 225, 201, 0.4)",
        color: "#ebe1c9",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.68rem",
        letterSpacing: "0.08em",
        padding: "0.5rem 0.8rem",
        zIndex: 9999,
        pointerEvents: "none",
        lineHeight: 1.5,
      }}
      aria-hidden="true"
    />
  );
}

