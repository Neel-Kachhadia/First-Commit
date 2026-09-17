"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  ClampToEdgeWrapping,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector3,
  type Texture,
} from "three";

import { useExperienceStore, type PerformanceTier } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";
import {
  CAUSAL_REPLAY_STAGE_COUNT,
  CAUSAL_REPLAY_STAGE_WINDOWS,
} from "@/lib/experience/causal-replay";

const MATERIALS = {
  high: [
    "/assets/kavachpay/materials/paper-handled-authority-1600.webp",
    "/assets/kavachpay/materials/paper-master-ivory-1600.webp",
  ],
  mid: [
    "/assets/kavachpay/materials/paper-handled-authority-900.webp",
    "/assets/kavachpay/materials/paper-master-ivory-900.webp",
  ],
} as const;

export const STAGE_WINDOWS = CAUSAL_REPLAY_STAGE_WINDOWS;

const TRANSPORT = {
  /** World-space film travel across the complete forensic rewind. */
  distance: 7.55,
  supplyRadius: 1.32,
  takeupRadius: 0.75,
  rollerRadius: 0.065,
  /** Preserve approved stock registration while deriving UV travel from distance. */
  uvPerWorldUnit: 5.2 / 7.55,
} as const;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Maps scroll progress to continuous film frame index (0..7).
 * Holds in gate for ~70% of each window, then transitions to the next frame.
 */
function continuousFrameProgress(p: number): number {
  if (p <= STAGE_WINDOWS[0][0]) return 0;
  const last = STAGE_WINDOWS[STAGE_WINDOWS.length - 1];
  if (p >= last[1]) return CAUSAL_REPLAY_STAGE_COUNT - 1;

  for (let i = 0; i < STAGE_WINDOWS.length; i += 1) {
    const [start, end] = STAGE_WINDOWS[i];
    const holdEnd = start + (end - start) * 0.72;
    if (p <= holdEnd) return i;
    if (p <= end) {
      const t = (p - holdEnd) / (end - holdEnd);
      // Smooth mechanical seating ease (cubic out)
      const eased = 1 - Math.pow(1 - t, 2.4);
      return lerp(i, Math.min(i + 1, CAUSAL_REPLAY_STAGE_COUNT - 1), eased);
    }
  }
  return CAUSAL_REPLAY_STAGE_COUNT - 1;
}

/** Creates procedural 70mm archival film edge perforation texture in memory */
function createFilmStockTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Dark translucent film base
    ctx.fillStyle = "#121110";
    ctx.fillRect(0, 0, 1024, 512);

    // Two visible frame exposures per texture repeat, separated by a bold
    // black frame line — at 6 UV repeats along the ribbon this is what
    // actually reads as "film" from typical viewing distance instead of
    // dissolving into a solid pale ribbon.
    ctx.fillStyle = "#0c0a08";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#0c0a08";
    ctx.fillRect(497, 0, 30, 512);

    // Inner evidence frame background (warm mid-toned archival emulsion —
    // kept off pure-white so it retains texture under strong gate lighting)
    ctx.fillStyle = "#cdbfa0";
    ctx.fillRect(140, 96, 340, 320);
    ctx.fillRect(544, 96, 340, 320);

    // Subtle film grain / border line
    ctx.strokeStyle = "rgba(21, 19, 14, 0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(140, 96, 340, 320);
    ctx.strokeRect(544, 96, 340, 320);

    // Sprocket hole perforations (top and bottom margins) — enlarged and
    // high-contrast so they register as perforations, not a texture blur.
    const holeWidth = 34;
    const holeHeight = 52;
    const holeRadius = 8;
    const holeCount = 18;
    const spacing = 1024 / holeCount;

    const drawSprocket = (x: number, y: number) => {
      ctx.fillStyle = "#070708"; // Viewport black hole
      ctx.beginPath();
      ctx.roundRect(x - holeWidth / 2, y - holeHeight / 2, holeWidth, holeHeight, holeRadius);
      ctx.fill();

      // Subtle edge highlight on the hole rim
      ctx.strokeStyle = "rgba(244, 236, 216, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    for (let i = 0; i < holeCount; i += 1) {
      const x = (i + 0.5) * spacing;
      drawSprocket(x, 26); // Top perforation
      drawSprocket(x, 486); // Bottom perforation
    }

    // Edge markings / archival notation
    ctx.fillStyle = "rgba(244, 236, 216, 0.55)";
    ctx.font = "bold 11px monospace";
    ctx.fillText("KAVACH 70MM FORENSIC SAFETY EMULSION", 60, 74);
    ctx.fillText("KP-1967-M // AUDIT CHAIN TX-1081", 60, 440);
    ctx.fillText("FRAME REGISTRATION DATUM // ATOMIC LINEAGE", 560, 74);
    ctx.fillText("70MM SPROCKET REGISTER", 560, 440);

    // Administrative Red registration crosses at each frame's corners
    ctx.strokeStyle = "#a92a24";
    ctx.lineWidth = 2;
    const drawCross = (cx: number, cy: number) => {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    };
    for (const fx of [140, 480, 544, 884]) {
      drawCross(fx, 96);
      drawCross(fx, 416);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Builds an archival spoked reel flange geometry with circular weight-reduction cutouts */
function createReelFlangeGeometry(outerRadius: number, hubRadius: number, numCutouts: number): ShapeGeometry {
  const shape = new Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

  // Center axle hole
  const centerHole = new Path();
  centerHole.absarc(0, 0, hubRadius * 0.7, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);

  // Radial cutout circles
  const cutoutDist = (outerRadius + hubRadius) * 0.54;
  const cutoutRadius = (outerRadius - hubRadius) * 0.28;
  for (let i = 0; i < numCutouts; i += 1) {
    const angle = (i / numCutouts) * Math.PI * 2;
    const hole = new Path();
    hole.absarc(
      Math.cos(angle) * cutoutDist,
      Math.sin(angle) * cutoutDist,
      cutoutRadius,
      0,
      Math.PI * 2,
      true,
    );
    shape.holes.push(hole);
  }

  return new ShapeGeometry(shape, 36);
}

/**
 * Generates the unified, continuous 3D film stock ribbon geometry.
 * Visibly connects:
 * Supply Reel (foreground/left)
 * -> Tangent Departure
 * -> Guide Roller 0
 * -> Guide Roller 1
 * -> Inspection Gate Aperture (focal plane)
 * -> Gate Exit
 * -> Guide Roller 2
 * -> Guide Roller 3
 * -> Tangent Entry
 * -> Take-up Reel (background/right).
 */
function createContinuousRibbonGeometry(): BufferGeometry {
  const supplyCenter = new Vector3(-2.15, 0.82, 0.22);
  const supplyRadius = 0.74;

  const controlPoints: Vector3[] = [];
  const upVectors: Vector3[] = [];

  // 1. Wrap around supply reel: from 145 deg down to -35 deg
  const supplyAngles = [145, 110, 75, 40, 5, -35];
  for (const deg of supplyAngles) {
    const rad = (deg * Math.PI) / 180;
    const pt = new Vector3(
      supplyCenter.x + supplyRadius * Math.cos(rad),
      supplyCenter.y + supplyRadius * Math.sin(rad),
      supplyCenter.z,
    );
    controlPoints.push(pt);
    upVectors.push(new Vector3(0, 0.25, 0.97).normalize());
  }

  // 2. Tangent departure from supply reel towards Guide Roller 0
  controlPoints.push(new Vector3(-1.38, 0.32, 0.18));
  upVectors.push(new Vector3(0, 0.45, 0.89).normalize());

  // 3. Over Guide Roller 0
  controlPoints.push(new Vector3(-1.12, 0.20, 0.08));
  upVectors.push(new Vector3(0, 0.75, 0.66).normalize());

  // 4. Under Guide Roller 1
  controlPoints.push(new Vector3(-0.88, 0.02, 0.01));
  upVectors.push(new Vector3(0, 0.96, 0.28).normalize());

  // 5. Enters Inspection Gate Runner (flat, taut, perpendicular to camera)
  controlPoints.push(new Vector3(-0.72, 0.0, -0.02));
  upVectors.push(new Vector3(0, 1, 0));

  // 6. Inspection Gate Aperture (Focal Plane)
  controlPoints.push(new Vector3(0.0, 0.0, -0.02));
  upVectors.push(new Vector3(0, 1, 0));

  // 7. Gate Exit Runner
  controlPoints.push(new Vector3(0.72, 0.0, -0.02));
  upVectors.push(new Vector3(0, 1, 0));

  // 8. Over Guide Roller 2
  controlPoints.push(new Vector3(0.98, -0.08, -0.16));
  upVectors.push(new Vector3(0, 0.92, -0.38).normalize());

  // 9. Under Guide Roller 3
  controlPoints.push(new Vector3(1.36, -0.32, -0.42));
  upVectors.push(new Vector3(0, 0.68, -0.73).normalize());

  // 10. Tangent entry into Take-up Reel
  const takeupCenter = new Vector3(2.28, -0.68, -0.85);
  const takeupRadius = 0.68;
  const takeupAngles = [155, 115, 75, 35, -5, -45];
  for (const deg of takeupAngles) {
    const rad = (deg * Math.PI) / 180;
    const pt = new Vector3(
      takeupCenter.x + takeupRadius * Math.cos(rad),
      takeupCenter.y + takeupRadius * Math.sin(rad),
      takeupCenter.z,
    );
    controlPoints.push(pt);
    upVectors.push(new Vector3(0, 0.28, -0.96).normalize());
  }

  const curve = new CatmullRomCurve3(controlPoints, false, "centripetal", 0.25);
  const segments = 160;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const filmHeight = 0.74;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const pt = curve.getPoint(t);
    const pointIdx = t * (controlPoints.length - 1);
    const low = Math.floor(pointIdx);
    const high = Math.min(low + 1, controlPoints.length - 1);
    const frac = pointIdx - low;
    const up = new Vector3().lerpVectors(upVectors[low], upVectors[high], frac).normalize();

    const top = pt.clone().addScaledVector(up, filmHeight / 2);
    const bot = pt.clone().addScaledVector(up, -filmHeight / 2);

    vertices.push(top.x, top.y, top.z);
    vertices.push(bot.x, bot.y, bot.z);

    // u runs along film length, v across width
    const u = t * 6.0;
    uvs.push(u, 0);
    uvs.push(u, 1);

    if (i < segments) {
      const v0 = 2 * i;
      const v1 = 2 * i + 1;
      const v2 = 2 * (i + 1);
      const v3 = 2 * (i + 1) + 1;
      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function preparePaperTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

export function CausalReplayRibbon({
  shadowsEnabled,
  tier = "mid",
}: {
  shadowsEnabled: boolean;
  tier?: PerformanceTier;
}) {
  const activeScene = useExperienceStore((state) => state.activeScene);
  const groupRef = useRef<Group>(null);
  const supplyReelRef = useRef<Group>(null);
  const takeupReelRef = useRef<Group>(null);
  const rollerRefs = useRef<Array<Group | null>>([]);
  const ribbonMatRef = useRef<MeshStandardMaterial | null>(null);
  const gateLightRef = useRef<Mesh | null>(null);

  const { invalidate, viewport } = useThree();

  const urls = tier === "high" ? MATERIALS.high : MATERIALS.mid;
  const [handledPaper, ivoryPaper] = useTexture(urls as unknown as string[]);

  useEffect(() => {
    preparePaperTexture(handledPaper);
    preparePaperTexture(ivoryPaper);
  }, [handledPaper, ivoryPaper]);

  // Procedural film stock texture with continuous perforations and archival text
  const filmTexture = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createFilmStockTexture();
  }, []);

  // Shared dark metal & graphite materials with rich archival tones
  const reelMetalMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x38342e,
        metalness: 0.62,
        roughness: 0.38,
      }),
    [],
  );

  const reelRimMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x5a5247,
        metalness: 0.72,
        roughness: 0.28,
      }),
    [],
  );

  const filmWoundMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x28231d,
        metalness: 0.2,
        roughness: 0.85,
      }),
    [],
  );

  const gateMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x322e28,
        metalness: 0.75,
        roughness: 0.32,
      }),
    [],
  );

  const redDatumMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xa92a24,
      }),
    [],
  );

  // Flange geometries
  const supplyFlangeGeo = useMemo(() => createReelFlangeGeometry(1.35, 0.32, 5), []);
  const takeupFlangeGeo = useMemo(() => createReelFlangeGeometry(1.18, 0.28, 5), []);

  // Standard geometries
  const hubGeo = useMemo(() => new CylinderGeometry(0.32, 0.32, 0.32, 28), []);
  const takeupHubGeo = useMemo(() => new CylinderGeometry(0.28, 0.28, 0.28, 28), []);
  const spindleGeo = useMemo(() => new CylinderGeometry(0.09, 0.09, 0.42, 16), []);
  const woundSupplyGeo = useMemo(() => new CylinderGeometry(1.05, 1.05, 0.26, 32), []);
  const woundTakeupGeo = useMemo(() => new CylinderGeometry(0.68, 0.68, 0.24, 32), []);
  const rollerGeo = useMemo(() => new CylinderGeometry(0.065, 0.065, 0.84, 24), []);
  const rollerFlangeGeo = useMemo(() => new CylinderGeometry(0.105, 0.105, 0.025, 24), []);
  const ribbonGeo = useMemo(() => createContinuousRibbonGeometry(), []);
  const gateRunnerGeo = useMemo(() => new BoxGeometry(1.48, 0.07, 0.08), []);
  const gateVerticalGeo = useMemo(() => new BoxGeometry(0.08, 0.88, 0.08), []);
  const datumTickGeo = useMemo(() => new BoxGeometry(0.018, 0.06, 0.02), []);

  useEffect(() => {
    const localResources = [
      reelMetalMat,
      reelRimMat,
      filmWoundMat,
      gateMat,
      redDatumMat,
      supplyFlangeGeo,
      takeupFlangeGeo,
      hubGeo,
      takeupHubGeo,
      spindleGeo,
      woundSupplyGeo,
      woundTakeupGeo,
      rollerGeo,
      rollerFlangeGeo,
      ribbonGeo,
      gateRunnerGeo,
      gateVerticalGeo,
      datumTickGeo,
    ];

    return () => {
      filmTexture?.dispose();
      localResources.forEach((resource) => resource.dispose());
    };
  }, [
    datumTickGeo,
    filmTexture,
    filmWoundMat,
    gateMat,
    gateRunnerGeo,
    gateVerticalGeo,
    hubGeo,
    redDatumMat,
    reelMetalMat,
    reelRimMat,
    ribbonGeo,
    rollerFlangeGeo,
    rollerGeo,
    spindleGeo,
    supplyFlangeGeo,
    takeupFlangeGeo,
    takeupHubGeo,
    woundSupplyGeo,
    woundTakeupGeo,
  ]);

  const applyProgress = (p: number) => {
    const group = groupRef.current;
    if (!group) return;

    const isReplay =
      activeScene === "causalReplay" ||
      progressBus.getActiveScene() === "causalReplay" ||
      p > 0;
    // Stage opens progressively between p=0.00 and p=0.18
    const revealIn = p <= 0.18 ? clamp01(p / 0.16) : 1;

    const visible = isReplay && revealIn > 0;
    group.visible = visible;
    if (!visible) return;

    // Viewport-aware adaptation for shorter laptop heights (e.g. 1366x768)
    const isShortViewport = viewport.height < 6.5;
    // Monumental crop: reels must bleed off-frame, not sit as complete
    // diagrammatic circles — scaled up from the original fit-inside sizing.
    const baseScale = isShortViewport ? 1.08 : 1.32;
    group.scale.setScalar(baseScale * lerp(0.88, 1, revealIn));

    // Position of persistent inspection gate aperture in world space
    const inspectionGateZ = -0.28;
    group.position.set(0.08, isShortViewport ? 0.02 : 0, inspectionGateZ);

    const currentFrameProg = continuousFrameProgress(p);
    const activeIndex = Math.floor(currentFrameProg);
    const transportDistance = p * TRANSPORT.distance;

    // One physical transport value drives every moving contact surface.
    if (supplyReelRef.current) {
      supplyReelRef.current.rotation.z =
        -transportDistance / TRANSPORT.supplyRadius;
    }
    if (takeupReelRef.current) {
      takeupReelRef.current.rotation.z =
        -transportDistance / TRANSPORT.takeupRadius;
    }

    rollerRefs.current.forEach((roller, idx) => {
      if (roller) {
        const contactDirection = idx % 2 === 0 ? 1 : -1;
        roller.rotation.y =
          (transportDistance / TRANSPORT.rollerRadius) * contactDirection;
      }
    });

    if (ribbonMatRef.current && ribbonMatRef.current.map) {
      ribbonMatRef.current.map.offset.x =
        -transportDistance * TRANSPORT.uvPerWorldUnit;
      ribbonMatRef.current.opacity = 0.96 * revealIn;
    }

    // 3. Subtle optical illumination at the gate pulses softly into sharp focus when a frame locks
    if (gateLightRef.current) {
      const activeWindow = STAGE_WINDOWS[activeIndex];
      const isRegistered =
        activeWindow && p >= activeWindow[0] && p <= activeWindow[1];
      const gateMaterial = gateLightRef.current.material as MeshBasicMaterial;
      if (gateMaterial) {
        gateMaterial.opacity = isRegistered ? 0.16 : 0.06;
      }
    }
  };

  useEffect(() => {
    applyProgress(progressBus.get("causalReplay"));
    invalidate();

    const unsubscribe = progressBus.subscribe((scene, p) => {
      if (scene === "causalReplay") {
        applyProgress(p);
        invalidate();
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScene, invalidate, viewport.height]);

  return (
    <group ref={groupRef} visible={false}>
      {/* Dedicated Inspection Lighting */}
      <pointLight position={[0, 0.2, 2.2]} intensity={2.8} distance={7} color={0xffeed8} />
      <directionalLight position={[-3.2, 2.8, 3.0]} intensity={2.2} color={0xffe8cf} />
      <directionalLight position={[3.0, -2.0, 2.5]} intensity={1.5} color={0xf2e4d0} />

      {/* ============================================================
          1. MONUMENTAL SUPPLY REEL (Foreground / Left)
          Partially cropped off the left and top viewport edges
          ============================================================ */}
      <group
        ref={supplyReelRef}
        position={[-2.15, 0.82, 0.22]}
        rotation={[0.08, 0.18, 0]}
      >
        {/* Central Spindle Pin */}
        <mesh geometry={spindleGeo} material={reelMetalMat} />

        {/* Central Hub Cylinder */}
        <mesh
          geometry={hubGeo}
          material={reelMetalMat}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow={shadowsEnabled}
        />

        {/* Wound Film Pack on the Hub */}
        <mesh
          geometry={woundSupplyGeo}
          material={filmWoundMat}
          rotation={[Math.PI / 2, 0, 0]}
        />

        {/* Front Flange (closer to camera) with 5 Circular Cutouts */}
        <mesh
          geometry={supplyFlangeGeo}
          material={reelRimMat}
          position={[0, 0, 0.14]}
          castShadow={shadowsEnabled}
        />

        {/* Back Flange with 5 Circular Cutouts */}
        <mesh
          geometry={supplyFlangeGeo}
          material={reelRimMat}
          position={[0, 0, -0.14]}
          castShadow={shadowsEnabled}
        />
      </group>

      {/* ============================================================
          2. DEEP TAKE-UP REEL (Background / Right)
          Sitting deeper in space at Z = -0.85
          ============================================================ */}
      <group
        ref={takeupReelRef}
        position={[2.28, -0.68, -0.85]}
        rotation={[-0.06, -0.22, 0]}
      >
        {/* Central Spindle Pin */}
        <mesh geometry={spindleGeo} material={reelMetalMat} />

        {/* Central Hub Cylinder */}
        <mesh
          geometry={takeupHubGeo}
          material={reelMetalMat}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow={shadowsEnabled}
        />

        {/* Wound Film Pack on the Hub */}
        <mesh
          geometry={woundTakeupGeo}
          material={filmWoundMat}
          rotation={[Math.PI / 2, 0, 0]}
        />

        {/* Front Flange with 5 Circular Cutouts */}
        <mesh
          geometry={takeupFlangeGeo}
          material={reelRimMat}
          position={[0, 0, 0.12]}
          castShadow={shadowsEnabled}
        />

        {/* Back Flange with 5 Circular Cutouts */}
        <mesh
          geometry={takeupFlangeGeo}
          material={reelRimMat}
          position={[0, 0, -0.12]}
          castShadow={shadowsEnabled}
        />
      </group>

      {/* ============================================================
          3. PRECISION GUIDE & TENSION ROLLERS
          Upright rollers guiding the physical 70mm film through space
          ============================================================ */}
      {/* Roller 0: Supply Exit Guide */}
      <group
        ref={(el) => {
          rollerRefs.current[0] = el;
        }}
        position={[-1.12, 0.20, 0.08]}
      >
        <mesh geometry={rollerGeo} material={reelMetalMat} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, 0.42, 0]} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, -0.42, 0]} />
      </group>

      {/* Roller 1: Gate Entrance Alignment Roller */}
      <group
        ref={(el) => {
          rollerRefs.current[1] = el;
        }}
        position={[-0.88, 0.02, 0.01]}
      >
        <mesh geometry={rollerGeo} material={reelMetalMat} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, 0.42, 0]} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, -0.42, 0]} />
      </group>

      {/* Roller 2: Gate Exit Tension Roller */}
      <group
        ref={(el) => {
          rollerRefs.current[2] = el;
        }}
        position={[0.98, -0.08, -0.16]}
      >
        <mesh geometry={rollerGeo} material={reelMetalMat} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, 0.42, 0]} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, -0.42, 0]} />
      </group>

      {/* Roller 3: Take-Up Entry Tension Roller */}
      <group
        ref={(el) => {
          rollerRefs.current[3] = el;
        }}
        position={[1.36, -0.32, -0.42]}
      >
        <mesh geometry={rollerGeo} material={reelMetalMat} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, 0.42, 0]} />
        <mesh geometry={rollerFlangeGeo} material={reelRimMat} position={[0, -0.42, 0]} />
      </group>

      {/* ============================================================
          4. THE PHYSICAL INSPECTION GATE APERTURE (Focal Plane)
          Rigid machined graphite brackets, registration pins, red datum
          ============================================================ */}
      <group position={[0, 0, -0.02]}>
        {/* Top Machine Runner Bar */}
        <mesh
          geometry={gateRunnerGeo}
          material={gateMat}
          position={[0, 0.44, 0.04]}
          castShadow={shadowsEnabled}
        />

        {/* Bottom Machine Runner Bar */}
        <mesh
          geometry={gateRunnerGeo}
          material={gateMat}
          position={[0, -0.44, 0.04]}
          castShadow={shadowsEnabled}
        />

        {/* Left Vertical Guide */}
        <mesh
          geometry={gateVerticalGeo}
          material={gateMat}
          position={[-0.72, 0, 0.04]}
          castShadow={shadowsEnabled}
        />

        {/* Right Vertical Guide */}
        <mesh
          geometry={gateVerticalGeo}
          material={gateMat}
          position={[0.72, 0, 0.04]}
          castShadow={shadowsEnabled}
        />

        {/* Administrative Red Registration Datum Ticks */}
        {/* Center Top */}
        <mesh geometry={datumTickGeo} material={redDatumMat} position={[0, 0.44, 0.08]} />
        {/* Center Bottom */}
        <mesh geometry={datumTickGeo} material={redDatumMat} position={[0, -0.44, 0.08]} />
        {/* Left Datum Pin */}
        <mesh
          geometry={datumTickGeo}
          material={redDatumMat}
          position={[-0.72, 0, 0.08]}
          rotation={[0, 0, Math.PI / 2]}
        />
        {/* Right Datum Pin */}
        <mesh
          geometry={datumTickGeo}
          material={redDatumMat}
          position={[0.72, 0, 0.08]}
          rotation={[0, 0, Math.PI / 2]}
        />

        {/* Optical Aperture Backlight (subtle warm optical glow) */}
        <mesh
          ref={gateLightRef}
          position={[0, 0, -0.05]}
        >
          <planeGeometry args={[1.38, 0.82]} />
          <meshBasicMaterial color={0xffe8c6} transparent opacity={0.08} />
        </mesh>
      </group>

      {/* ============================================================
          5. CONTINUOUS CAUSAL FILM STOCK RIBBON
          Unified physical film connecting Supply Reel to Take-up Reel
          ============================================================ */}
      <mesh
        geometry={ribbonGeo}
        castShadow={shadowsEnabled}
        receiveShadow={shadowsEnabled}
      >
        <meshStandardMaterial
          ref={ribbonMatRef}
          map={filmTexture}
          side={DoubleSide}
          metalness={0.12}
          roughness={0.75}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}
