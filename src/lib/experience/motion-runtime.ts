import { experienceStore } from "./store";
import { progressBus } from "./progress-bus";
import {
  clamp01,
  createMotionGeometry,
  getMotionSnapshot,
  MOTION,
  sceneSlugFromKey,
  type MotionGeometry,
  type MotionSnapshot,
  type SceneGeometry,
} from "./motion-model";
import { SCENE_REGISTRY, type RegisteredSceneKey } from "./scene-registry";

const PROTOTYPE_BOUNDARY = "03_04";
const BOUNDARY_0203 = "02_03";
const MIGRATED_BOUNDARIES = new Set([BOUNDARY_0203, PROTOTYPE_BOUNDARY]);

function setElementOpacity(selector: string, opacity: number): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.style.opacity = String(Math.min(1, Math.max(0, opacity)));
  });
}

function setElementTransform(
  selector: string,
  transform: { x?: number; y?: number; scale?: number },
): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const x = transform.x ?? 0;
    const y = transform.y ?? 0;
    const scale = transform.scale ?? 1;
    element.style.translate = `${x}px ${y}px`;
    element.style.scale = String(scale);
  });
}

function setRootVisualState(
  root: HTMLElement,
  visible: boolean,
  semanticOwner: boolean,
): void {
  root.style.visibility = visible ? "visible" : "hidden";
  root.style.pointerEvents = semanticOwner ? "auto" : "none";
  root.setAttribute("aria-hidden", semanticOwner ? "false" : "true");
  root.inert = !semanticOwner;

  const stage = root.firstElementChild;
  if (stage instanceof HTMLElement) stage.style.visibility = visible ? "visible" : "hidden";
}

function publishSemanticOwner(owner: RegisteredSceneKey): void {
  if (experienceStore.getState().activeScene !== owner) {
    experienceStore.getState().setScene(owner);
  }
  progressBus.setActiveScene(owner);
  const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
  if (stage) stage.dataset.activeScene = owner;
}

/**
 * First architecture proof: Delegation and Step-Up share one physical clock.
 * The Grocery authority and Travel request remain distinct documents; the
 * perforated authority pass acts as the registration edge while Step-Up's
 * existing field gains mass behind it.
 */
function applyBoundary0304(snapshot: MotionSnapshot): void {
  const boundary = snapshot.activeBoundary;
  if (!boundary || boundary.key !== PROTOTYPE_BOUNDARY) return;

  const p = snapshot.boundaryProgress[PROTOTYPE_BOUNDARY];
  const transport = MOTION.transport(p);
  const register = MOTION.register(Math.min(1, Math.max(0, (p - 0.12) / 0.7)));
  const outgoingRelease = MOTION.exposure(Math.min(1, Math.max(0, (p - 0.48) / 0.46)));
  const headerSwitch = MOTION.exposure(Math.min(1, Math.max(0, (p - 0.44) / 0.24)));

  const outgoingRoot = document.querySelector<HTMLElement>("[data-scene='delegation']");
  const incomingRoot = document.querySelector<HTMLElement>("[data-scene='step-up']");
  const ownerSlug = sceneSlugFromKey(snapshot.semanticOwner);

  if (outgoingRoot) {
    setRootVisualState(outgoingRoot, true, ownerSlug === "delegation");
    outgoingRoot.style.zIndex = p < 0.68 ? "6" : "5";
  }
  if (incomingRoot) {
    setRootVisualState(incomingRoot, true, ownerSlug === "step-up");
    incomingRoot.style.zIndex = p < 0.68 ? "5" : "6";
  }

  // Retain visual mass until the Step-Up registration field is materially present.
  const supportOpacity = 1 - outgoingRelease;
  setElementOpacity(
    "[data-delegation-parent], [data-delegation-delivery], [data-delegation-downstream], [data-registration-frame]",
    supportOpacity,
  );
  setElementOpacity("[data-delegation-footer]", Math.max(0, 1 - headerSwitch));
  setElementOpacity("[data-delegation-header]", Math.max(0, 1 - headerSwitch));
  setElementTransform(
    "[data-delegation-parent], [data-delegation-delivery], [data-delegation-downstream]",
    { y: -10 * transport, scale: 1 - 0.035 * transport },
  );

  // Step-Up's existing rails/datum acquire authority before Delegation releases it.
  setElementOpacity("[data-execution-route], [data-registration-bar], [data-clearance-bracket]", register);
  setElementOpacity("[data-stepup-footer]", register);
  setElementOpacity("[data-stepup-header]", headerSwitch);

  // The documents are semantically different, so this is a registered exchange,
  // not a claim that one artifact magically becomes the other.
  const outgoingCarrierWeight = 1 - MOTION.exposure(Math.min(1, Math.max(0, (p - 0.54) / 0.38)));
  const incomingCarrierWeight = MOTION.exposure(Math.min(1, Math.max(0, (p - 0.38) / 0.4)));
  setElementOpacity("[data-delegation-grocery]", outgoingCarrierWeight);
  setElementOpacity("[data-stepup-travel-carrier]", incomingCarrierWeight);

  publishSemanticOwner(snapshot.semanticOwner);
}

/**
 * Second migrated boundary, same principle as applyBoundary0304 above:
 * Decisions' three-lane register releases visual mass on the shared clock
 * instead of being compressed into its own local BEAT 5 (0.89-1.00, ~220px
 * of a ~1980px track) while a redundant local carrier bridge fought it.
 * The approved-evidence receipt ([data-decision-evidence-outgoing] /
 * [data-decision-evidence-incoming]) is the existing product-native carrier
 * (two DOM copies of the same rect, per motion-model.ts's registry entry
 * for "02_03") -- no new object. Delegation's Shopping-parent registration
 * (applyDelegationEntry) is the true incoming mass; the carrier is only the
 * bridge and recedes once the parent has taken over.
 */
function applyBoundary0203(snapshot: MotionSnapshot): void {
  const boundary = snapshot.activeBoundary;
  if (!boundary || boundary.key !== BOUNDARY_0203) return;

  const p = snapshot.boundaryProgress[BOUNDARY_0203];
  const transport = MOTION.transport(p);
  const outgoingRelease = MOTION.exposure(clamp01((p - 0.35) / 0.5));
  const headerSwitch = MOTION.exposure(clamp01((p - 0.4) / 0.28));

  const outgoingRoot = document.querySelector<HTMLElement>("[data-scene='decisions']");
  const incomingRoot = document.querySelector<HTMLElement>("[data-scene='delegation']");
  const ownerSlug = sceneSlugFromKey(snapshot.semanticOwner);

  if (outgoingRoot) {
    setRootVisualState(outgoingRoot, true, ownerSlug === "decisions");
    outgoingRoot.style.zIndex = p < 0.68 ? "6" : "5";
  }
  if (incomingRoot) {
    setRootVisualState(incomingRoot, true, ownerSlug === "delegation");
    incomingRoot.style.zIndex = p < 0.68 ? "5" : "6";
  }

  // Retain the three-lane register's mass until Delegation's Shopping parent
  // is materially present, instead of collapsing it in a fixed local slice.
  const supportOpacity = 1 - outgoingRelease;
  setElementOpacity(
    "[data-lane-tag='allow'], [data-lane-tag='stepup'], [data-lane-tag='deny'], " +
      "[data-lane-sprockets], [data-gate='stepup'], [data-barrier='deny'], [data-note], " +
      "[data-lane-track-line], [data-receipt-wrap='allow'], [data-receipt-wrap='stepup'], " +
      "[data-receipt-wrap='deny'], [data-lanes-board]",
    supportOpacity,
  );
  setElementTransform("[data-lanes-board]", { y: -10 * transport, scale: 1 - 0.02 * transport });
  setElementOpacity("[data-decisions-header]", Math.max(0, 1 - headerSwitch));
  setElementOpacity("[data-decisions-footer]", Math.max(0, 1 - headerSwitch));

  // Delegation's own header/footer crossfade against Decisions' (same
  // headerSwitch curve, opposite direction) -- title ownership changes
  // together with the rest of the switch, not as a separate local snap.
  setElementOpacity("[data-delegation-header]", headerSwitch);
  setElementOpacity("[data-delegation-footer]", headerSwitch);

  // Evidence receipt: one product-native carrier crossing two DOM copies of
  // the same viewport rect. Outgoing rises early (Decisions handing it off)
  // and falls as the incoming copy rises (Delegation receiving it); the
  // incoming copy then recedes once Delegation's own Shopping parent
  // (applyDelegationEntry) has become the dominant mass, since the resting
  // Delegation composition doesn't include a floating receipt.
  const outRise = MOTION.exposure(clamp01((p - 0.05) / 0.2));
  const outFall = 1 - MOTION.exposure(clamp01((p - 0.4) / 0.25));
  const outgoingCarrierWeight = Math.min(outRise, outFall);

  const inRise = MOTION.exposure(clamp01((p - 0.35) / 0.25));
  const inFall = 1 - MOTION.exposure(clamp01((p - 0.65) / 0.3));
  const incomingCarrierWeight = Math.min(inRise, inFall);

  setElementOpacity("[data-decision-evidence-outgoing]", outgoingCarrierWeight);
  setElementOpacity("[data-decision-evidence-incoming]", incomingCarrierWeight);

  publishSemanticOwner(snapshot.semanticOwner);
}

/**
 * Delegation's Shopping-parent registration (header/footer excluded --
 * those are directly curve-driven in applyBoundary0203, same split as
 * Step-Up's header/footer in applyBoundary0304) used to be "primed" at
 * opacity 0.62 from mount as a dead-zone band-aid, then resolved to full
 * opacity/scale in the first local 0.04-0.14 of Delegation's ~3060px
 * track (~120-430px) -- far shorter than the shared boundary's incoming
 * half, so it would sit fully-built and static for the rest of the
 * boundary if left on that clock, or (with the old band-aid) never
 * properly represent "not yet arrived". DelegationScene now registers
 * this as a paused "delegationEntry" timeline driven the same way as
 * "stepUpEntry".
 */
function applyDelegationEntry(snapshot: MotionSnapshot): void {
  const timeline = progressBus.getTimeline("delegationEntry");
  if (!timeline) return;
  const boundaryP = snapshot.boundaryProgress[BOUNDARY_0203] ?? 0;
  const entryProgress = MOTION.register(clamp01((boundaryP - 0.3) / 0.62));
  timeline.progress(entryProgress);
}

/**
 * Step-Up's own document-construction beats (carrier slide-in, clearance
 * interception, backing-stock expansion) used to be scrubbed across its
 * full local track (~2880px), so by the time the shared 540px 03→04
 * boundary finished, Step-Up's local progress had only reached ~0.09 —
 * nowhere near the ~0.54 local progress those beats need to complete.
 * The result was a dead/thin incoming composition for the back half of
 * the boundary. StepUpScene now registers that entry choreography as a
 * separate paused timeline (key "stepUpEntry") instead of scrubbing it
 * locally; this is its sole driver, decoupled from strict boundary
 * activation so it also resolves correctly to 0 or 1 well outside the
 * window (deep-link, hash restore, navbar jump).
 */
function applyStepUpEntry(snapshot: MotionSnapshot): void {
  const timeline = progressBus.getTimeline("stepUpEntry");
  if (!timeline) return;
  const boundaryP = snapshot.boundaryProgress["03_04"] ?? 0;
  const entryProgress = MOTION.register(clamp01((boundaryP - 0.3) / 0.62));
  timeline.progress(entryProgress);
}

export function readMotionGeometry(): MotionGeometry {
  const scenes: SceneGeometry[] = SCENE_REGISTRY.map((scene) => {
    const track = document.querySelector<HTMLElement>(`[data-track='${scene.slug}']`);
    const start = track?.offsetTop ?? 0;
    const height = track?.offsetHeight ?? 1;
    return { key: scene.key, start, end: start + height, height };
  });

  return createMotionGeometry(
    scenes,
    window.innerHeight,
    Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
  );
}

export function applyPrototypeMotion(
  scrollY: number,
  geometry: MotionGeometry,
): MotionSnapshot {
  const snapshot = getMotionSnapshot(scrollY, geometry);
  progressBus.publishSnapshot(snapshot);

  const stage = document.querySelector<HTMLElement>("[data-cinematic-stage]");
  if (stage) {
    stage.dataset.globalProgress = snapshot.globalProgress.toFixed(6);
    if (snapshot.activeBoundary && MIGRATED_BOUNDARIES.has(snapshot.activeBoundary.key)) {
      stage.dataset.activeBoundary = snapshot.activeBoundary.key;
      stage.dataset.boundaryProgress = snapshot.boundaryProgress[snapshot.activeBoundary.key].toFixed(5);
    } else {
      delete stage.dataset.activeBoundary;
      delete stage.dataset.boundaryProgress;
    }
  }

  applyBoundary0304(snapshot);
  applyStepUpEntry(snapshot);
  applyBoundary0203(snapshot);
  applyDelegationEntry(snapshot);
  return snapshot;
}

export function isPrototypeBoundaryActive(): boolean {
  return progressBus.getSnapshot()?.activeBoundary?.key === PROTOTYPE_BOUNDARY;
}
