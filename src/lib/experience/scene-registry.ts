export const SCENE_REGISTRY = [
  { key: "prologue", slug: "prologue", number: "00", label: "OPENING / HERO", trackVh: 100, safeProgress: 0 },
  { key: "mandate", slug: "mandate", number: "01", label: "MANDATE", trackVh: 200, safeProgress: 0.1 },
  { key: "decisions", slug: "decisions", number: "02", label: "ALLOW / STEP-UP / DENY", trackVh: 184, safeProgress: 0.13 },
  { key: "delegation", slug: "delegation", number: "03", label: "DELEGATION", trackVh: 284, safeProgress: 0.14 },
  { key: "stepUp", slug: "step-up", number: "04", label: "STEP-UP CLEARANCE", trackVh: 268, safeProgress: 0.22 },
  { key: "revocation", slug: "revocation", number: "05", label: "REVOCATION", trackVh: 294, safeProgress: 0.26 },
  { key: "splitDefense", slug: "split-defense", number: "06", label: "SPLIT-PAYMENT DEFENSE", trackVh: 294, safeProgress: 0.1 },
  { key: "concurrency", slug: "concurrency", number: "07", label: "BUDGET / CONCURRENCY", trackVh: 294, safeProgress: 0.1 },
  { key: "causalReplay", slug: "causal-replay", number: "08", label: "CAUSAL REPLAY", trackVh: 374, safeProgress: 0.2 },
] as const;

export type RegisteredScene = (typeof SCENE_REGISTRY)[number];
export type RegisteredSceneKey = RegisteredScene["key"];
export type ExperienceScene = RegisteredSceneKey | "none";

export const SCENE_BY_KEY = Object.fromEntries(
  SCENE_REGISTRY.map((scene) => [scene.key, scene]),
) as Record<RegisteredSceneKey, RegisteredScene>;

export const SCENE_BY_SLUG = Object.fromEntries(
  SCENE_REGISTRY.map((scene) => [scene.slug, scene]),
) as Record<RegisteredScene["slug"], RegisteredScene>;

export function sceneFromHash(hash: string): RegisteredScene | undefined {
  const number = hash.match(/^#scene-(\d{2})$/)?.[1];
  return SCENE_REGISTRY.find((scene) => scene.number === number);
}
