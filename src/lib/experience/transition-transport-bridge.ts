/**
 * Tiny rendezvous between the ONE scroll engine (Lenis, owned by KavachExperience) and the ONE
 * transition owner (CinematicTransitionLayer). Neither imports the other:
 *
 *   KavachExperience ticker:  lenis.raf(t)  ->  bridge.step(t)          (one chain, fixed order)
 *   KavachExperience 'scroll': bridge.governScroll(y)                     (bounded scroll debt)
 *   CinematicTransitionLayer registers `hooks` and reads `enabled`.
 *
 * `enabled` is true only while Lenis is running (desktop, motion allowed, not ?visualTest=1).
 * Everywhere else (mobile bypass, reduced motion, visual tests, native scroll) the layer keeps its
 * original 1:1 "scroll progress -> frame" mapping and the transport is a pure passthrough.
 */
export type TransportHooks = {
  /** Advance every boundary's transport by the frame time and apply it. `nowSeconds` is the gsap ticker clock. */
  step: (nowSeconds: number) => void;
  /** Limit a raw scroll position to what the transport currently allows (bounded pending intent + handoff gates). */
  governScroll: (scrollY: number) => number;
  /** Transport switched on/off: re-seed every boundary from the live scroll position. */
  enabledChanged: (enabled: boolean) => void;
};

let hooks: TransportHooks | null = null;
let enabled = false;
let programmatic = false;

export const transportBridge = {
  get enabled() {
    return enabled;
  },
  /** True while a programmatic navigation (nav menu / hash) is scrolling: passes through untouched. */
  get programmatic() {
    return programmatic;
  },
  setProgrammatic(value: boolean) {
    programmatic = value;
  },
  setEnabled(value: boolean) {
    if (enabled === value) return;
    enabled = value;
    hooks?.enabledChanged(value);
  },
  register(next: TransportHooks): () => void {
    hooks = next;
    if (enabled) next.enabledChanged(true);
    return () => {
      if (hooks === next) hooks = null;
    };
  },
  step(nowSeconds: number) {
    if (enabled) hooks?.step(nowSeconds);
  },
  governScroll(scrollY: number): number {
    return enabled && hooks ? hooks.governScroll(scrollY) : scrollY;
  },
};
