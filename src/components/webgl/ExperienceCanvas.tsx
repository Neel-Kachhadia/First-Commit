"use client";

import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import { SRGBColorSpace } from "three";

import {
  experienceStore,
  useExperienceStore,
  type PerformanceTier,
} from "@/lib/experience/store";

import { MandatePhysicalStage } from "./MandatePhysicalStage";
import { CausalReplayRibbon } from "./CausalReplayRibbon";
import styles from "./ExperienceCanvas.module.css";

type ExperienceCanvasProps = {
  className?: string;
};

type BoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
};

type BoundaryState = {
  failed: boolean;
};

class WebGLBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StaticStage() {
  const activeScene = useExperienceStore((state) => state.activeScene);

  return (
    <div
      className={styles.fallback}
      data-active={activeScene === "mandate"}
    />
  );
}

function detectPerformanceTier(): PerformanceTier {
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
  };
  const memory = navigatorWithMemory.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const compactViewport = window.matchMedia("(max-width: 48rem)").matches;

  if (memory <= 4 || cores <= 4) return "low";
  if (compactViewport || memory <= 6 || cores <= 6) return "mid";
  return "high";
}

function canCreateWebGLContext() {
  try {
    const probe = document.createElement("canvas");
    const isVisualTest =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("visualTest") === "1";
    const context =
      (isVisualTest
        ? probe.getContext("webgl2") ?? probe.getContext("webgl")
        : (probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
           probe.getContext("webgl", { failIfMajorPerformanceCaveat: true }))) ??
      probe.getContext("webgl2") ??
      probe.getContext("webgl");

    if (!context) return false;

    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function ExperienceCanvas({ className }: ExperienceCanvasProps) {
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);
  const setReducedMotion = useExperienceStore(
    (state) => state.setReducedMotion,
  );
  const setWebglReady = useExperienceStore((state) => state.setWebglReady);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [compactViewport, setCompactViewport] = useState(false);
  const [performanceTier, setPerformanceTier] =
    useState<PerformanceTier>("mid");

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactQuery = window.matchMedia("(max-width: 48rem)");
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
    const updateViewport = () => setCompactViewport(compactQuery.matches);
    const setupFrame = window.requestAnimationFrame(() => {
      const tier = detectPerformanceTier();

      updateMotionPreference();
      updateViewport();
      setPerformanceTier(tier);
      experienceStore.setState({ performanceTier: tier });
      setWebglSupported(canCreateWebGLContext());
    });

    motionQuery.addEventListener("change", updateMotionPreference);
    compactQuery.addEventListener("change", updateViewport);
    return () => {
      window.cancelAnimationFrame(setupFrame);
      motionQuery.removeEventListener("change", updateMotionPreference);
      compactQuery.removeEventListener("change", updateViewport);
      setWebglReady(false);
    };
  }, [setReducedMotion, setWebglReady]);

  useEffect(() => {
    if (reducedMotion || webglSupported === false) setWebglReady(false);
  }, [reducedMotion, setWebglReady, webglSupported]);

  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const dpr =
    performanceTier === "low"
      ? Math.min(deviceDpr, 1)
      : Math.min(deviceDpr, performanceTier === "mid" ? 1.25 : 1.5);

  const fallback = <StaticStage />;
  const shouldRenderCanvas = webglSupported === true && !reducedMotion && !compactViewport;
  const stageClassName = className
    ? `${styles.stage} ${className}`
    : styles.stage;
  const shadowsEnabled = performanceTier === "high";

  return (
    <div className={stageClassName} aria-hidden="true" data-kavach-stage>
      <WebGLBoundary
        fallback={fallback}
        onError={() => setWebglReady(false)}
      >
        {shouldRenderCanvas ? (
          <Canvas
            camera={{ far: 50, fov: 34, near: 0.01, position: [0, 0, 4.6] }}
            dpr={dpr}
            fallback={fallback}
            frameloop="demand"
            gl={{
              alpha: true,
              antialias: performanceTier !== "low",
              depth: true,
              powerPreference:
                performanceTier === "low" ? "low-power" : "high-performance",
              stencil: false,
            }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = SRGBColorSpace;
              gl.setClearColor(0x000000, 0);
              setWebglReady(true);
            }}
            shadows={shadowsEnabled ? "percentage" : false}
          >
            <hemisphereLight args={[0xfff3db, 0x17120f, 1.15]} />
            <directionalLight
              castShadow={shadowsEnabled}
              color={0xffe7bd}
              intensity={2.1}
              position={[-3.2, 4.4, 5.2]}
              shadow-bias={-0.0003}
              shadow-mapSize-height={1024}
              shadow-mapSize-width={1024}
            />
            <Suspense fallback={null}>
              <MandatePhysicalStage shadowsEnabled={shadowsEnabled} tier={performanceTier} />
              <CausalReplayRibbon shadowsEnabled={shadowsEnabled} tier={performanceTier} />
            </Suspense>
          </Canvas>
        ) : (
          fallback
        )}
      </WebGLBoundary>
    </div>
  );
}

export default ExperienceCanvas;
