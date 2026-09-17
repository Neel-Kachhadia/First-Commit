"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCENE_BY_KEY, SCENE_REGISTRY, type RegisteredSceneKey } from "@/lib/experience/scene-registry";
import { useExperienceStore } from "@/lib/experience/store";
import styles from "./GlobalNavbar.module.css";

type GlobalNavbarProps = {
  onNavigate: (scene: RegisteredSceneKey) => void;
  onMenuOpenChange: (open: boolean) => void;
};

const ACTION_NOTICE = "Destination reserved for the application phase; not implemented in this landing-page pass.";

export function GlobalNavbar({ onNavigate, onMenuOpenChange }: GlobalNavbarProps) {
  const activeScene = useExperienceStore((state) => state.activeScene);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = activeScene === "none" ? null : SCENE_BY_KEY[activeScene];

  const setOpen = useCallback((open: boolean) => {
    setMenuOpen(open);
    onMenuOpenChange(open);
  }, [onMenuOpenChange]);

  const navigate = (scene: RegisteredSceneKey) => {
    setOpen(false);
    onNavigate(scene);
  };

  const announceUnavailable = (label: string) => {
    setNotice(`${label}. ${ACTION_NOTICE}`);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const nav = navRef.current;
    const focusable = nav?.querySelectorAll<HTMLElement>(
      "[data-control-index] button:not([disabled]), [data-control-index] a[href]",
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    const current = nav?.querySelector<HTMLElement>("[data-mobile-chapter][aria-current='page']");
    requestAnimationFrame(() => (current ?? first)?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, setOpen]);

  return (
    <nav ref={navRef} className={styles.nav} aria-label="KavachPay control index" data-global-navbar>
      <button className={styles.brand} type="button" onClick={() => navigate("prologue")}>
        KAVACHPAY
      </button>

      <div className={styles.desktopIndex} aria-label="Film chapters">
        {SCENE_REGISTRY.map((scene) => {
          const current = activeScene === scene.key;
          return (
            <button
              key={scene.key}
              type="button"
              className={styles.chapter}
              data-active={current || undefined}
              aria-current={current ? "page" : undefined}
              aria-label={`${scene.number} ${scene.label}`}
              onClick={() => navigate(scene.key)}
            >
              <span className={styles.chapterNumber}>{scene.number}</span>
              <span className={styles.chapterLabel} aria-hidden={!current}>{scene.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.mobileCurrent} aria-live="polite">
        {active ? `${active.number} / ${active.label}` : "— / CONTROL INDEX"}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryAction} aria-disabled="true" onClick={() => announceUnavailable("Login")}>
          LOGIN
        </button>
        <button type="button" className={styles.secondaryAction} aria-disabled="true" onClick={() => announceUnavailable("Sign up")}>
          SIGN UP
        </button>
        <button type="button" className={styles.primaryAction} aria-disabled="true" onClick={() => announceUnavailable("Enter KavachPay")}>
          ENTER KAVACHPAY
        </button>
      </div>

      <button
        ref={triggerRef}
        className={styles.controlTrigger}
        type="button"
        aria-expanded={menuOpen}
        aria-controls="kp-control-index"
        onClick={() => setOpen(!menuOpen)}
      >
        CONTROL INDEX
      </button>

      <div
        id="kp-control-index"
        className={styles.controlIndex}
        data-control-index
        data-open={menuOpen || undefined}
        role="dialog"
        aria-modal="true"
        aria-label="KavachPay Control Index"
        aria-hidden={!menuOpen}
      >
        <div className={styles.controlHeader}>
          <span>KAVACHPAY CONTROL INDEX</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close Control Index">CLOSE ×</button>
        </div>
        <div className={styles.mobileChapters}>
          {SCENE_REGISTRY.map((scene) => {
            const current = activeScene === scene.key;
            return (
              <button
                key={scene.key}
                type="button"
                data-mobile-chapter
                aria-current={current ? "page" : undefined}
                onClick={() => navigate(scene.key)}
              >
                <span>{scene.number}</span>
                <strong>{scene.label}</strong>
              </button>
            );
          })}
        </div>
        <div className={styles.mobileActions}>
          <button type="button" aria-disabled="true" onClick={() => announceUnavailable("Login")}>LOGIN</button>
          <button type="button" aria-disabled="true" onClick={() => announceUnavailable("Sign up")}>SIGN UP</button>
          <button type="button" className={styles.primaryAction} aria-disabled="true" onClick={() => announceUnavailable("Enter KavachPay")}>ENTER KAVACHPAY</button>
        </div>
      </div>

      <p className={styles.srStatus} role="status" aria-live="polite">{notice}</p>
    </nav>
  );
}
