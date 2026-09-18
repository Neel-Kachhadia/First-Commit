import {
  SCENE_REGISTRY,
  type RegisteredSceneKey,
} from "./scene-registry";

export const MOTION = {
  boundary: {
    viewportFactor: 0.6,
    minPx: 480,
    maxPx: 720,
    ownerSwitch: 0.56,
  },
  transport: (value: number) => value * value * (3 - 2 * value),
  register: (value: number) => 1 - Math.pow(1 - value, 3),
  withdraw: (value: number) => value * value,
  exposure: (value: number) => value * value * (3 - 2 * value),
} as const;

export type BoundaryKey =
  | "00_01"
  | "01_02"
  | "02_03"
  | "03_04"
  | "04_05"
  | "05_06"
  | "06_07"
  | "07_08";

export type BoundaryDefinition = {
  key: BoundaryKey;
  outgoing: RegisteredSceneKey;
  incoming: RegisteredSceneKey;
  outgoingCarrier: string;
  incomingCarrier: string;
  ownerSwitch?: number;
};

/**
 * Every cross-chapter object is named here, including the two technical DOM
 * copies that sometimes represent one perceived carrier. Visibility outside
 * the owning scene/boundary is invalid and covered by regression tests.
 */
export const BOUNDARY_REGISTRY: readonly BoundaryDefinition[] = [
  {
    key: "00_01",
    outgoing: "prologue",
    incoming: "mandate",
    outgoingCarrier: "[data-opening-paper]",
    incomingCarrier: "[data-mandate-bounding-paper]",
  },
  {
    key: "01_02",
    outgoing: "mandate",
    incoming: "decisions",
    outgoingCarrier: "[data-mandate-splice-geom]",
    incomingCarrier: "[data-lanes-board]",
  },
  {
    key: "02_03",
    outgoing: "decisions",
    incoming: "delegation",
    outgoingCarrier: "[data-decision-evidence-outgoing]",
    incomingCarrier: "[data-decision-evidence-incoming]",
  },
  {
    key: "03_04",
    outgoing: "delegation",
    incoming: "stepUp",
    outgoingCarrier: "[data-delegation-grocery]",
    incomingCarrier: "[data-stepup-travel-carrier]",
  },
  {
    key: "04_05",
    outgoing: "stepUp",
    incoming: "revocation",
    outgoingCarrier: "[data-stepup-travel-carrier]",
    incomingCarrier: "[data-record='TX-1082']",
  },
  {
    key: "05_06",
    outgoing: "revocation",
    incoming: "splitDefense",
    outgoingCarrier: "[data-register-station]",
    incomingCarrier: "[data-temporal-aperture]",
  },
  {
    key: "06_07",
    outgoing: "splitDefense",
    incoming: "concurrency",
    outgoingCarrier: "[data-dossier-backing]",
    incomingCarrier: "[data-ledger-station]",
  },
  {
    key: "07_08",
    outgoing: "concurrency",
    incoming: "causalReplay",
    outgoingCarrier: "[data-terminal-ledger]",
    incomingCarrier: "[data-replay-docket]",
  },
] as const;

export type SceneGeometry = {
  key: RegisteredSceneKey;
  start: number;
  end: number;
  height: number;
};

export type BoundaryGeometry = BoundaryDefinition & {
  center: number;
  start: number;
  end: number;
  distance: number;
};

export type MotionGeometry = {
  scenes: readonly SceneGeometry[];
  boundaries: readonly BoundaryGeometry[];
  maxScroll: number;
  viewportHeight: number;
};

export type MotionSnapshot = {
  scrollY: number;
  globalProgress: number;
  sceneProgress: Record<RegisteredSceneKey, number>;
  activeBoundary: BoundaryGeometry | null;
  boundaryProgress: Record<BoundaryKey, number>;
  semanticOwner: RegisteredSceneKey;
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function getBoundaryDistance(viewportHeight: number): number {
  return Math.round(
    Math.min(
      MOTION.boundary.maxPx,
      Math.max(MOTION.boundary.minPx, viewportHeight * MOTION.boundary.viewportFactor),
    ),
  );
}

export function createMotionGeometry(
  sceneRects: readonly SceneGeometry[],
  viewportHeight: number,
  maxScroll: number,
): MotionGeometry {
  const distance = getBoundaryDistance(viewportHeight);
  const byKey = new Map(sceneRects.map((scene) => [scene.key, scene]));
  const boundaries = BOUNDARY_REGISTRY.map((definition) => {
    const outgoing = byKey.get(definition.outgoing);
    const incoming = byKey.get(definition.incoming);
    const center = outgoing?.end ?? incoming?.start ?? 0;
    return {
      ...definition,
      center,
      start: center - distance / 2,
      end: center + distance / 2,
      distance,
    };
  });

  return {
    scenes: sceneRects,
    boundaries,
    maxScroll: Math.max(1, maxScroll),
    viewportHeight,
  };
}

export function getMotionSnapshot(
  scrollY: number,
  geometry: MotionGeometry,
): MotionSnapshot {
  const y = Math.min(geometry.maxScroll, Math.max(0, scrollY));
  const sceneProgress = Object.fromEntries(
    geometry.scenes.map((scene) => [
      scene.key,
      clamp01((y - scene.start) / Math.max(1, scene.height)),
    ]),
  ) as Record<RegisteredSceneKey, number>;

  const boundaryProgress = Object.fromEntries(
    geometry.boundaries.map((boundary) => [
      boundary.key,
      clamp01((y - boundary.start) / Math.max(1, boundary.distance)),
    ]),
  ) as Record<BoundaryKey, number>;

  const activeBoundary =
    geometry.boundaries.find((boundary) => y >= boundary.start - 1 && y <= boundary.end + 1) ?? null;

  let semanticOwner =
    geometry.scenes.find((scene) => y >= scene.start && y < scene.end)?.key ??
    SCENE_REGISTRY[SCENE_REGISTRY.length - 1].key;

  if (activeBoundary) {
    const progress = boundaryProgress[activeBoundary.key];
    semanticOwner =
      progress >= (activeBoundary.ownerSwitch ?? MOTION.boundary.ownerSwitch)
        ? activeBoundary.incoming
        : activeBoundary.outgoing;
  }

  return {
    scrollY: y,
    globalProgress: clamp01(y / geometry.maxScroll),
    sceneProgress,
    activeBoundary,
    boundaryProgress,
    semanticOwner,
  };
}

export function sceneSlugFromKey(key: RegisteredSceneKey): string {
  return SCENE_REGISTRY.find((scene) => scene.key === key)?.slug ?? "prologue";
}
