/**
 * CodeSandbox [Building dynamic envmaps (e662p3)](https://codesandbox.io/p/sandbox/e662p3?file=%2Fsrc%2FApp.js)
 * 의 `App.js` / `Lamborghini.js` / `Effects.js` 를 TypeScript + 현재 스택에 맞게 포팅.
 * 원본 `@react-three/postprocessing` v2 의 SSR 은 postprocessing v6 에 없어 Bloom + LUT 만 유지.
 * Leva 패널·FPS(Stats) 는 원본 Effects.js / 일반 R3F 데모와 동일하게 복원.
 *
 * Lamborghini GLB: Sketchfab CC-BY-NC-4.0 — Steven007
 * https://sketchfab.com/3d-models/lamborghini-urus-2650599973b649ddb4460ff6c03e4aa2
 *
 * Porsche 911 (930 Turbo 1975): GitHub MIT — Utkarsh Pathrabe
 * https://github.com/UtkarshPathrabe/Porche-911-930-Turbo-1975-3D-Model · `public/porsche-911-930-turbo/scene.gltf`
 */
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  Stats,
  useGLTF,
} from "@react-three/drei";
import {
  applyProps,
  Canvas,
  type ThreeElements,
  useLoader,
} from "@react-three/fiber";
import { Bloom, EffectComposer, LUT } from "@react-three/postprocessing";
import { Leva, useControls } from "leva";
import { LUTCubeLoader } from "postprocessing";
import {
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type PrimitiveWithoutObject = Omit<ThreeElements["primitive"], "object">;

THREE.ColorManagement.enabled = true;

export type EnvmapCarModelId = "lambo" | "porsche";

/** 원본 `Effects.js` 의 `useControls` 스키마 + Bloom/LUT 튜닝(SSR 슬라이더는 스택에 SSR 없어 비연동). */
const envmapEffectsSchema = {
  enabled: true,
  temporalResolve: true,
  STRETCH_MISSED_RAYS: true,
  USE_MRT: true,
  USE_NORMALMAP: true,
  USE_ROUGHNESSMAP: true,
  ENABLE_JITTERING: true,
  ENABLE_BLUR: true,
  DITHERING: false,
  temporalResolveMix: { value: 0.9, min: 0, max: 1 },
  temporalResolveCorrectionMix: { value: 0.4, min: 0, max: 1 },
  maxSamples: { value: 0, min: 0, max: 1 },
  resolutionScale: { value: 1, min: 0, max: 1 },
  blurMix: { value: 0.2, min: 0, max: 1 },
  blurKernelSize: { value: 8, min: 0, max: 8 },
  BLUR_EXPONENT: { value: 10, min: 0, max: 20 },
  rayStep: { value: 0.5, min: 0, max: 1 },
  intensity: { value: 2.5, min: 0, max: 5 },
  maxRoughness: { value: 1, min: 0, max: 1 },
  jitter: { value: 0.3, min: 0, max: 5 },
  jitterSpread: { value: 0.25, min: 0, max: 1 },
  jitterRough: { value: 0.1, min: 0, max: 1 },
  roughnessFadeOut: { value: 1, min: 0, max: 1 },
  rayFadeOut: { value: 0, min: 0, max: 1 },
  MAX_STEPS: { value: 20, min: 0, max: 20 },
  NUM_BINARY_SEARCH_STEPS: { value: 6, min: 0, max: 10 },
  maxDepthDifference: { value: 5, min: 0, max: 10 },
  maxDepth: { value: 1, min: 0, max: 1 },
  thickness: { value: 3, min: 0, max: 10 },
  ior: { value: 1.45, min: 0, max: 2 },
  bloomLuminanceThreshold: { value: 0.2, min: 0, max: 1 },
  bloomLuminanceSmoothing: { value: 0, min: 0, max: 1 },
  bloomIntensity: { value: 1.75, min: 0, max: 4 },
  bloomMipmapBlur: true,
  lutEnabled: true,
};

/** Leva: 차종 + 차체 색. 911 은 `public/porsche-911-930-turbo/scene.gltf` (GitHub MIT, 파일 상단 링크). */
const vehicleControlsSchema = {
  model: {
    value: "lambo" satisfies EnvmapCarModelId,
    options: {
      "람보르기니 Urus": "lambo",
      "포르쉐 911": "porsche",
    },
  },
  carBody: {
    value: "#111111",
    options: {
      "기본(다크)": "#111111",
      빨강: "#b91c1c",
      파랑: "#2563eb",
      노랑: "#ca8a04",
      화이트: "#e5e5e5",
      그린: "#15803d",
      퍼플: "#7c3aed",
      오렌지: "#ea580c",
    },
  },
};

type LamborghiniGltf = {
  scene: THREE.Object3D;
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material & { clone?: () => THREE.Material }>;
};

/*
Author: Steven Grey (https://sketchfab.com/Steven007)
License: CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
Source: https://sketchfab.com/3d-models/lamborghini-urus-2650599973b649ddb4460ff6c03e4aa2
Title: Lamborghini Urus
*/
type EnvmapCarProps = PrimitiveWithoutObject & { paintColor: string };

/** `ContactShadows`·바닥 링 메쉬와 같은 월드 높이 — 차량 최저점(AABB)이 여기에 오도록 그룹 Y 를 잡음. */
const ENVMAP_FLOOR_Y = -1.16;

function uniformScaleFromProps(s: EnvmapCarProps["scale"] | undefined): number {
  if (s == null) return 1;
  if (typeof s === "number") return s;
  if (Array.isArray(s)) return Number(s[0] ?? 1);
  return s.x;
}

function tuple3FromR3fPosition(
  p: EnvmapCarProps["position"] | undefined,
): [number, number, number] {
  if (p == null) return [0, 0, 0];
  if (typeof p === "number") return [0, 0, 0];
  if (Array.isArray(p))
    return [Number(p[0] ?? 0), Number(p[1] ?? 0), Number(p[2] ?? 0)];
  return [p.x, p.y, p.z];
}

function Lamborghini({ paintColor, ...props }: EnvmapCarProps) {
  const gltf = useGLTF("/lambo.glb") as unknown as LamborghiniGltf;
  const { scene, nodes, materials } = gltf;

  /* Official e662p3 / drei pattern: mutate cached `useGLTF` meshes and materials once after load. */
  /* eslint-disable react-hooks/immutability -- GLTF graph from useGLTF is intentionally patched in place */
  useLayoutEffect(() => {
    Object.values(nodes).forEach((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.startsWith("glass")) mesh.geometry.computeVertexNormals();
      if (mesh.name === "silver_001_BreakDiscs_0")
        mesh.material = applyProps(materials.BreakDiscs.clone(), {
          color: "#ddd",
        }) as THREE.Material;
    });
    const glass003 = nodes.glass_003 as THREE.Mesh | undefined;
    if (glass003) glass003.scale.setScalar(2.7);
    applyProps(materials.FrameBlack, {
      metalness: 0.75,
      roughness: 0,
      color: "black",
    });
    applyProps(materials.Chrome, { metalness: 1, roughness: 0, color: "#333" });
    applyProps(materials.BreakDiscs, {
      metalness: 0.2,
      roughness: 0.2,
      color: "#555",
    });
    applyProps(materials.TiresGum, {
      metalness: 0,
      roughness: 0.4,
      color: "#181818",
    });
    applyProps(materials.GreyElements, { metalness: 0, color: "#292929" });
    applyProps(materials.emitbrake, {
      emissiveIntensity: 3,
      toneMapped: false,
    });
    applyProps(materials.LightsFrontLed, {
      emissiveIntensity: 3,
      toneMapped: false,
    });
    const yellow = nodes.yellow_WhiteCar_0 as THREE.Mesh | undefined;
    if (yellow) {
      yellow.material = new THREE.MeshPhysicalMaterial({
        roughness: 0.3,
        metalness: 0.05,
        color: "#111111",
        envMapIntensity: 0.75,
        clearcoatRoughness: 0,
        clearcoat: 1,
      });
    }
  }, [nodes, materials]);
  /* eslint-enable react-hooks/immutability */

  useLayoutEffect(() => {
    const yellow = nodes.yellow_WhiteCar_0 as THREE.Mesh | undefined;
    const mat = yellow?.material;
    if (mat instanceof THREE.MeshPhysicalMaterial) mat.color.set(paintColor);
  }, [nodes, paintColor]);

  return <primitive {...props} object={scene} />;
}

/*
License: MIT — see `public/porsche-911-930-turbo/LICENSE`
Source: https://github.com/UtkarshPathrabe/Porche-911-930-Turbo-1975-3D-Model
Title: Porsche 911 930 Turbo (1975) glTF
*/
function Porsche911({
  paintColor,
  position,
  scale,
  rotation,
  ...props
}: EnvmapCarProps) {
  const gltf = useGLTF(
    "/porsche-911-930-turbo/scene.gltf",
  ) as unknown as LamborghiniGltf;
  const { scene, nodes, materials } = gltf;
  const [px, py, pz] = tuple3FromR3fPosition(position);
  const s = uniformScaleFromProps(scale);
  /** 스케일이 자식에만 적용될 때: `groupY + s * box.min.y === ENVMAP_FLOOR_Y` */
  const floorAlignY = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return ENVMAP_FLOOR_Y - s * box.min.y;
  }, [scene, s]);

  useLayoutEffect(() => {
    Object.values(nodes).forEach((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.receiveShadow = true;
        mesh.castShadow = true;
      }
    });
    const plastics = materials["930_plastics"] as
      | THREE.MeshStandardMaterial
      | undefined;
    if (plastics) {
      applyProps(plastics, {
        color: "#222",
        roughness: 0.6,
        roughnessMap: null,
        normalScale: new THREE.Vector2(4, 4),
      });
    }
    const glassMat = materials.glass as THREE.MeshStandardMaterial | undefined;
    if (glassMat)
      applyProps(glassMat, { color: "black", roughness: 0, clearcoat: 0.1 });
    const coat = materials.coat as THREE.MeshStandardMaterial | undefined;
    if (coat)
      applyProps(coat, { envMapIntensity: 4, roughness: 0.5, metalness: 1 });
    const chromes = materials["930_chromes"] as
      | THREE.MeshStandardMaterial
      | undefined;
    if (chromes)
      applyProps(chromes, {
        metalness: 1,
        roughness: 0.12,
        envMapIntensity: 1.25,
      });
    const paint = materials.paint as THREE.MeshStandardMaterial | undefined;
    if (paint) {
      applyProps(paint, {
        envMapIntensity: 2,
        roughness: 0.45,
        metalness: 0.8,
        color: paintColor,
      });
    }
  }, [nodes, materials, paintColor]);

  return (
    <group position={[px, py + floorAlignY, pz]}>
      <group scale={scale} rotation={rotation} {...props}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

function EnvmapVehicle({
  model,
  paintColor,
}: {
  model: EnvmapCarModelId;
  paintColor: string;
}) {
  if (model === "porsche") {
    return (
      <Porsche911
        paintColor={paintColor}
        scale={1.5}
        position={[-0.5, -0.2, 0]}
        rotation={[0, Math.PI / 1.5, 0]}
      />
    );
  }
  return (
    <Lamborghini
      paintColor={paintColor}
      rotation={[0, Math.PI / 1.5, 0]}
      scale={0.015}
    />
  );
}

type EnvmapPostEffectsProps = {
  enabled: boolean;
  bloomLuminanceThreshold: number;
  bloomLuminanceSmoothing: number;
  bloomIntensity: number;
  bloomMipmapBlur: boolean;
  lutEnabled: boolean;
};

/** 원본 Effects.js: `enabled` 시 Bloom + LUT. SSR 슬라이더는 UI 만 유지(현재 스택 미지원). */
function EnvmapPostEffects({
  enabled,
  bloomLuminanceThreshold,
  bloomLuminanceSmoothing,
  bloomIntensity,
  bloomMipmapBlur,
  lutEnabled,
}: EnvmapPostEffectsProps) {
  const texture = useLoader(LUTCubeLoader, "/F-6800-STD.cube");
  if (!enabled) return null;
  const bloom = (
    <Bloom
      luminanceThreshold={bloomLuminanceThreshold}
      luminanceSmoothing={bloomLuminanceSmoothing}
      intensity={bloomIntensity}
      mipmapBlur={bloomMipmapBlur}
    />
  );
  if (lutEnabled) {
    return (
      <EffectComposer enableNormalPass={false}>
        {bloom}
        <LUT lut={texture} />
      </EffectComposer>
    );
  }
  return <EffectComposer enableNormalPass={false}>{bloom}</EffectComposer>;
}

useGLTF.preload("/lambo.glb");
useGLTF.preload("/porsche-911-930-turbo/scene.gltf");

const AUTO_ROTATE_RESUME_MS = 1600;
/** 낮을수록 느림(three 기본 2 대비). */
const AUTO_ROTATE_SPEED = 0.74;

/** 드래그 중엔 자동 회전 끔, 손 떼면 잠시 후 현재 각도에서 다시 은은한 자전. */
function EnvmapOrbitControls() {
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResumeTimer = useCallback(() => {
    if (resumeRef.current != null) {
      clearTimeout(resumeRef.current);
      resumeRef.current = null;
    }
  }, []);

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer]);

  return (
    <OrbitControls
      enablePan={false}
      enableZoom
      minDistance={8}
      maxDistance={24}
      minPolarAngle={Math.PI / 3.5}
      maxPolarAngle={Math.PI / 2 - 0.02}
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={AUTO_ROTATE_SPEED}
      onStart={() => {
        clearResumeTimer();
        setAutoRotate(false);
      }}
      onEnd={() => {
        clearResumeTimer();
        resumeRef.current = setTimeout(() => {
          setAutoRotate(true);
          resumeRef.current = null;
        }, AUTO_ROTATE_RESUME_MS);
      }}
    />
  );
}

/** 3D 히어로(헤더·푸터 사이 main) 안쪽 여백. 상단은 캔버스 안으로 들이고, 하단은 홈 도트(absolute bottom-5)와 겹침 여유. */
const OVERLAY_TOP_CLASS = "top-14";
/** `top-14`(3.5rem) + `bottom-24`(6rem) 예약. 래퍼에 `bottom-*` 를 같이 쓰면 접어도 높이가 꽉 차서 ring 이 “펼친 것처럼” 남음 → max-height 만 씀. */
const LEVA_PANEL_MAX_H_CLASS = "max-h-[calc(100%-9.5rem)]";

export function HomeHeroEnvmap3D({ className }: { className?: string }) {
  const params = useControls("Effects", envmapEffectsSchema, {
    collapsed: true,
  });
  const vehicle = useControls("Vehicle", vehicleControlsSchema, {
    collapsed: true,
  });
  /** 진입 시 오른쪽 패널은 접힌 상태(타이틀 바만). */
  const [effectsPanelCollapsed, setEffectsPanelCollapsed] = useState(true);
  const statsParentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("relative min-h-0 w-full flex-1", className)}>
      {/*
        Leva 기본은 viewport fixed → 헤더 침범. fill + 이 래퍼로 main(3D) 영역 안에만 두고,
        max-height = top~bottom 인셋, 넘치면 스크롤.
      */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div
          ref={statsParentRef}
          className={cn(
            "pointer-events-auto absolute left-3 z-30",
            OVERLAY_TOP_CLASS,
          )}
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-auto absolute right-3 flex w-[min(18rem,calc(100%-1.5rem))] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg transition-[box-shadow,ring-color]",
            OVERLAY_TOP_CLASS,
            LEVA_PANEL_MAX_H_CLASS,
            effectsPanelCollapsed
              ? "shadow-sm ring-1 ring-border/30"
              : "shadow-lg ring-1 ring-border/50",
          )}
        >
          <div
            className={cn(
              "min-h-0 overflow-x-hidden overscroll-y-contain",
              effectsPanelCollapsed
                ? "max-h-none flex-none overflow-y-hidden"
                : "max-h-full flex-1 overflow-y-auto",
            )}
          >
            <Leva
              fill
              collapsed={{
                collapsed: effectsPanelCollapsed,
                onChange: setEffectsPanelCollapsed,
              }}
              titleBar={{ title: "Effects", drag: false, filter: true }}
            />
          </div>
        </div>
      </div>
      <Canvas
        className="relative z-0 h-full w-full touch-none"
        gl={{ logarithmicDepthBuffer: true, antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 15], fov: 25 }}
      >
        <Stats
          showPanel={0}
          parent={statsParentRef as RefObject<HTMLElement>}
          className="absolute! left-0! top-0! z-1!"
        />
        <color attach="background" args={["#15151a"]} />
        <Suspense fallback={null}>
          <EnvmapVehicle
            key={vehicle.model}
            model={vehicle.model as EnvmapCarModelId}
            paintColor={vehicle.carBody}
          />
          <hemisphereLight intensity={0.5} />
          <ContactShadows
            resolution={1024}
            frames={1}
            position={[0, -1.16, 0]}
            scale={15}
            blur={0.5}
            opacity={1}
            far={20}
          />
          <mesh
            scale={4}
            position={[3, -1.161, -1.5]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2.5]}
          >
            <ringGeometry args={[0.9, 1, 4, 1]} />
            <meshStandardMaterial color="white" roughness={0.75} />
          </mesh>
          <mesh
            scale={4}
            position={[-3, -1.161, -1]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2.5]}
          >
            <ringGeometry args={[0.9, 1, 3, 1]} />
            <meshStandardMaterial color="white" roughness={0.75} />
          </mesh>
          <Environment resolution={512}>
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, -9]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, -6]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, -3]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, 0]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, 3]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, 6]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-x={Math.PI / 2}
              position={[0, 4, 9]}
              scale={[10, 1, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-y={Math.PI / 2}
              position={[-50, 2, 0]}
              scale={[100, 2, 1]}
            />
            <Lightformer
              intensity={2}
              rotation-y={-Math.PI / 2}
              position={[50, 2, 0]}
              scale={[100, 2, 1]}
            />
            <Lightformer
              form="ring"
              color="red"
              intensity={10}
              scale={2}
              position={[10, 5, 10]}
              onUpdate={(self) => {
                self.lookAt(0, 0, 0);
              }}
            />
          </Environment>
          <EnvmapPostEffects
            enabled={params.enabled}
            bloomLuminanceThreshold={params.bloomLuminanceThreshold}
            bloomLuminanceSmoothing={params.bloomLuminanceSmoothing}
            bloomIntensity={params.bloomIntensity}
            bloomMipmapBlur={params.bloomMipmapBlur}
            lutEnabled={params.lutEnabled}
          />
        </Suspense>
        <EnvmapOrbitControls />
      </Canvas>
    </div>
  );
}
