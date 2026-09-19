"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useExperienceStore } from "@/lib/experience/store";
import styles from "./CustomCursor.module.css";

export type CustomCursorMode = "cinematic" | "product";

export type CustomCursorProps = {
  /** Explicit mode override. Defaults to "cinematic" on "/" and "product" elsewhere. */
  mode?: CustomCursorMode;
};

// SSR-safe subscription to (pointer: fine)
const subscribeFinePointer = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(pointer: fine)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
};
const getFinePointerSnapshot = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
};
const getServerFinePointerSnapshot = () => false;

export function CustomCursor({ mode: explicitMode }: CustomCursorProps) {
  const pathname = usePathname();
  const introComplete = useExperienceStore((state) => state.introComplete);
  const isFinePointer = useSyncExternalStore(
    subscribeFinePointer,
    getFinePointerSnapshot,
    getServerFinePointerSnapshot,
  );

  const cursorRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDownRef = useRef(false);

  // Derive mode: "/" -> cinematic, any other route -> product
  const computedMode: CustomCursorMode = explicitMode ?? (pathname === "/" ? "cinematic" : "product");

  // Sync class to html only after fine pointer confirmation and mount
  useEffect(() => {
    if (!isFinePointer) return;
    document.documentElement.classList.add("has-custom-cursor");
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [isFinePointer]);

  // Synchronize Intro state to data-attribute (Landing only)
  useEffect(() => {
    const el = cursorRef.current;
    if (!el || computedMode !== "cinematic") return;
    el.dataset.intro = introComplete ? "false" : "true";
  }, [introComplete, computedMode]);

  // Synchronize transition track intersection for subdued cursor during 00->01 ... 06->07
  useEffect(() => {
    if (!isFinePointer || computedMode !== "cinematic") return;
    const tracks = document.querySelectorAll("[data-transition-track]");
    if (!tracks.length) return;

    let activeCount = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeCount += 1;
          } else if (activeCount > 0) {
            activeCount -= 1;
          }
        }
        if (cursorRef.current) {
          cursorRef.current.dataset.transition = activeCount > 0 ? "true" : "false";
        }
      },
      { threshold: 0.05 },
    );

    tracks.forEach((track) => observer.observe(track));
    return () => observer.disconnect();
  }, [isFinePointer, computedMode]);

  // Pointer movement & state listeners
  useEffect(() => {
    if (!isFinePointer) return;

    const el = cursorRef.current;
    if (!el) return;

    // Single 60fps rAF loop for transform translation
    const loop = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const resolveElementState = (target: Element | null): "default" | "hover" | "text" | "hidden" => {
      if (!target) return "default";

      // 1. Explicit native / hidden escape hatches
      if (target.closest('[data-cursor="hidden"]')) return "hidden";
      if (target.closest('[data-cursor="native"]')) return "hidden";

      // 2. Editable text inputs, search, contenteditable
      const textInput = target.closest(
        'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"], [data-cursor="text"]',
      );
      if (textInput) return "text";

      // 3. Disabled controls remain in default state (no interactive feedback)
      const disabledEl = target.closest('button[disabled], [aria-disabled="true"], [data-cursor="disabled"]');
      if (disabledEl) return "default";

      // 4. Semantic interactive targets
      const interactiveEl = target.closest(
        'a[href], button, [role="button"], summary, [data-cursor="interactive"]',
      );
      if (interactiveEl) return "hover";

      return "default";
    };

    const onPointerMove = (e: MouseEvent | PointerEvent) => {
      posRef.current.x = e.clientX;
      posRef.current.y = e.clientY;

      // Restore scrolling opacity immediately upon hand movement
      if (el.dataset.scrolling === "true") {
        el.dataset.scrolling = "false";
      }

      // If mouse button is held down, preserve active state
      if (isDownRef.current) {
        el.dataset.state = "active";
        return;
      }

      const target = document.elementFromPoint(e.clientX, e.clientY);
      const nextState = resolveElementState(target);
      if (el.dataset.state !== nextState) {
        el.dataset.state = nextState;
      }
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      isDownRef.current = true;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const s = resolveElementState(target);
      if (s !== "text" && s !== "hidden") {
        el.dataset.state = "active";
      }
    };

    const onPointerUp = (e: MouseEvent | PointerEvent) => {
      isDownRef.current = false;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      el.dataset.state = resolveElementState(target);
    };

    const onPointerLeave = () => {
      isDownRef.current = false;
      el.dataset.state = "hidden";
    };

    const onPointerEnter = (e: MouseEvent | PointerEvent) => {
      posRef.current.x = e.clientX;
      posRef.current.y = e.clientY;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      el.dataset.state = resolveElementState(target);
    };

    const onScroll = () => {
      // Functional software mode (Dashboard) does not dim on ordinary scroll
      if (computedMode !== "cinematic") return;

      el.dataset.scrolling = "true";
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (el) el.dataset.scrolling = "false";
      }, 120);
    };

    const onBlur = () => {
      isDownRef.current = false;
      el.dataset.state = "hidden";
    };

    const onFocus = () => {
      // Re-arm upon window focus
      el.dataset.state = "default";
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        el.dataset.state = "hidden";
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("mousedown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("mouseup", onPointerUp, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave, { passive: true });
    document.addEventListener("pointerenter", onPointerEnter, { passive: true });
    document.addEventListener("mouseenter", onPointerEnter, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("mouseleave", onPointerLeave);
      document.removeEventListener("pointerenter", onPointerEnter);
      document.removeEventListener("mouseenter", onPointerEnter);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isFinePointer, computedMode]);

  // If coarse pointer or non-fine device: zero DOM, zero work
  if (!isFinePointer) return null;

  return (
    <div
      ref={cursorRef}
      className={styles.cursorWrapper}
      data-cursor-root
      data-mode={computedMode}
      data-state="default"
      data-scrolling="false"
      data-transition="false"
      data-intro={introComplete ? "false" : "true"}
      aria-hidden="true"
      role="presentation"
    >
      {/* Optical registration halo (Restrained 32px circle, Cinematic landing only) */}
      <svg
        className={styles.halo}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="14" className={styles.haloCircle} />
      </svg>

      {/* Asymmetric precision pointer silhouette */}
      <svg
        className={styles.pointerSvg}
        viewBox="0 0 16 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer ivory shell with dark ink edge */}
        <path
          d="M 0.5 0.5 L 0.5 22 L 5.5 17 L 14.5 17 Z"
          className={styles.pointerShell}
        />
        {/* Inner oxide-red wedge (registration accent) */}
        <polygon
          points="5.5,17 14.5,17 9.5,10.5"
          className={styles.pointerWedge}
        />
        {/* Hairline division seam */}
        <line
          x1="5.5"
          y1="17"
          x2="9.5"
          y2="10.5"
          className={styles.pointerSeam}
        />
      </svg>
    </div>
  );
}
