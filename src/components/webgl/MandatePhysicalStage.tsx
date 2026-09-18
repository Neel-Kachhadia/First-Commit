"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Group, MeshStandardMaterial, SRGBColorSpace, type Texture } from "three";

import { useExperienceStore, type PerformanceTier } from "@/lib/experience/store";
import { progressBus } from "@/lib/experience/progress-bus";

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

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

function preparePaperTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

export function MandatePhysicalStage({
  shadowsEnabled,
  tier = "mid",
}: {
  shadowsEnabled: boolean;
  tier?: PerformanceTier;
}) {
  const activeScene = useExperienceStore((state) => state.activeScene);
  const groupRef = useRef<Group>(null);
  const mat1Ref = useRef<MeshStandardMaterial>(null);
  const mat2Ref = useRef<MeshStandardMaterial>(null);
  const mat3Ref = useRef<MeshStandardMaterial>(null);
  const { invalidate } = useThree();

  const urls = tier === "high" ? MATERIALS.high : MATERIALS.mid;
  const [handledPaper, ivoryPaper] = useTexture(urls as unknown as string[]);

  useEffect(() => {
    preparePaperTexture(handledPaper);
    preparePaperTexture(ivoryPaper);
  }, [handledPaper, ivoryPaper]);

  const applyProgress = useCallback((p: number) => {
    if (!groupRef.current) return;
    const isMandate = activeScene === "mandate";
    // The 00->01 film already shows the stacked stock behind the sheet and the
    // 01->02 film still shows it, so it is present at full strength from the
    // first to the last frame of the scene (no fade-in / fade-out of its own).
    const depthOpacity = 1;

    const visible = isMandate && depthOpacity > 0;
    groupRef.current.visible = visible;

    if (visible) {
      groupRef.current.position.set(
        lerp(0.18, 0.25, p),
        lerp(-0.04, 0.02, p),
        lerp(-0.12, 0.02, p),
      );
      groupRef.current.rotation.set(
        lerp(-0.015, 0.01, p),
        lerp(0.026, -0.014, p),
        lerp(-0.012, 0.008, p),
      );
      if (mat1Ref.current) mat1Ref.current.opacity = depthOpacity;
      if (mat2Ref.current) mat2Ref.current.opacity = depthOpacity;
      if (mat3Ref.current) mat3Ref.current.opacity = depthOpacity;
    }
  }, [activeScene]);

  useEffect(() => {
    applyProgress(progressBus.get("mandate"));
    invalidate();

    const unsubscribe = progressBus.subscribe((scene, p) => {
      if (scene === "mandate") {
        applyProgress(p);
        invalidate();
      }
    });

    return unsubscribe;
  }, [applyProgress, invalidate]);

  return (
    <group ref={groupRef} visible={false}>
      <mesh
        castShadow={shadowsEnabled}
        receiveShadow={shadowsEnabled}
        position={[1.18, -0.08, 0]}
        rotation={[0, 0, -0.022]}
      >
        <planeGeometry args={[1.62, 2.36, 1, 1]} />
        <meshStandardMaterial
          ref={mat1Ref}
          map={ivoryPaper}
          metalness={0}
          roughness={0.94}
          transparent
          opacity={0}
        />
      </mesh>

      <mesh
        castShadow={shadowsEnabled}
        receiveShadow={shadowsEnabled}
        position={[1.34, -0.12, -0.13]}
        rotation={[0.012, -0.018, 0.052]}
      >
        <planeGeometry args={[1.52, 2.24, 1, 1]} />
        <meshStandardMaterial
          ref={mat2Ref}
          map={handledPaper}
          metalness={0}
          roughness={0.9}
          transparent
          opacity={0}
        />
      </mesh>

      <mesh
        castShadow={shadowsEnabled}
        receiveShadow={shadowsEnabled}
        position={[0.05, 0.7, -0.23]}
        rotation={[-0.018, 0.028, -0.08]}
      >
        <planeGeometry args={[1.12, 0.38, 1, 1]} />
        <meshStandardMaterial
          ref={mat3Ref}
          map={handledPaper}
          metalness={0}
          roughness={0.92}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}
