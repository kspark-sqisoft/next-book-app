/**
 * CodeSandbox [Cards (dc5fjy)](https://codesandbox.io/p/sandbox/dc5fjy) `App.js` 와 동일한 시즌 배치·ActiveCard 프리뷰.
 */
import * as THREE from "three";
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type RootState, type ThreeElements } from "@react-three/fiber";
import { Billboard, Image, ScrollControls, Text, useScroll } from "@react-three/drei";
import { easing } from "maath";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { cardImages } from "@/assets/cards";

THREE.ColorManagement.enabled = true;

const INTER_FONT =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff";

const ADJECTIVES = [
  "misty", "quiet", "golden", "silver", "ancient", "wild", "soft", "bright", "deep", "calm",
];
const NOUNS = [
  "forest", "river", "meadow", "harbor", "summit", "garden", "canopy", "shore", "valley", "ridge",
];

/** 원본 App.js 와 같은 호 분할 + summer/winter 세로 오프셋 */
const SEASON_ROWS = [
  { category: "spring", from: 0, len: Math.PI / 4 },
  { category: "summer", from: Math.PI / 4, len: Math.PI / 2, position: [0, 0.4, 0] as const },
  { category: "autumn", from: Math.PI / 4 + Math.PI / 2, len: Math.PI / 2 },
  {
    category: "winter",
    from: Math.PI * 1.25,
    len: Math.PI * 2 - Math.PI * 1.25,
    position: [0, -0.4, 0] as const,
  },
] as const;

/** 원본은 z≈9·fov 15 — 홈에서는 뒤로·시야 넓힘. Y는 올려 링을 위에서 내려다봄 */
const CAMERA_Z_REST = 22;
const CAMERA_FOV = 24;
const CAMERA_Y_BASE = 8.75;
const lookTarget = new THREE.Vector3(0, 1.35, 0);

function Scene({
  textColor,
  ...props
}: { textColor: string } & ThreeElements["group"]) {
  const ref = useRef<THREE.Group>(null);
  const scroll = useScroll();
  const [hovered, setHovered] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useFrame((state: RootState, delta: number) => {
    const g = ref.current;
    if (g) g.rotation.y = -scroll.offset * (Math.PI * 2);
    state.events.update?.();
    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 2, state.pointer.y * 1.35 + CAMERA_Y_BASE, CAMERA_Z_REST],
      0.3,
      delta,
    );
    state.camera.lookAt(lookTarget);
  });

  return (
    <group ref={ref} {...props}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 12, 8]} intensity={1.1} />
      {SEASON_ROWS.map((row) => (
        <Cards
          key={row.category}
          textColor={textColor}
          category={row.category}
          from={row.from}
          len={row.len}
          {...("position" in row && row.position ? { position: row.position } : {})}
          onPointerOver={(i, url) => {
            setHovered(i);
            setPreviewUrl(url);
          }}
          onPointerOut={() => {
            setHovered(null);
            setPreviewUrl(null);
          }}
        />
      ))}
      <ActiveCard textColor={textColor} hovered={hovered} previewUrl={previewUrl} />
    </group>
  );
}

function Card({
  url,
  active,
  hovered,
  ...props
}: {
  url: string;
  active: boolean;
  hovered: boolean;
} & ThreeElements["group"]) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_state: RootState, delta: number) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const f = hovered ? 1.4 : active ? 1.25 : 1;
    easing.damp3(mesh.position, [0, hovered ? 0.25 : 0, 0], 0.1, delta);
    easing.damp3(mesh.scale, [1.618 * f, 1 * f, 1], 0.15, delta);
  });
  return (
    <group {...props}>
      <Image
        ref={meshRef}
        url={url}
        transparent
        toneMapped={false}
        radius={0.075}
        scale={[1.618, 1]}
        side={THREE.DoubleSide}
      />
    </group>
  );
}

function Cards({
  textColor,
  category,
  from = 0,
  len = Math.PI * 2,
  radius = 5.25,
  onPointerOver,
  onPointerOut,
  ...props
}: {
  textColor: string;
  category: string;
  from?: number;
  len?: number;
  radius?: number;
  onPointerOver?: (index: number, url: string) => void;
  onPointerOut?: () => void;
} & ThreeElements["group"]) {
  const [hovered, setHovered] = useState<number | null>(null);
  const amount = Math.round(len * 22);
  const textPosition = from + (amount / 2 / amount) * len;

  return (
    <group {...props}>
      <Billboard position={[Math.sin(textPosition) * radius * 1.4, 0.5, Math.cos(textPosition) * radius * 1.4]}>
        <Text font={INTER_FONT} fontSize={0.25} anchorX="center" color={textColor}>
          {category}
        </Text>
      </Billboard>
      {Array.from({ length: amount - 3 }, (_, i) => {
        const angle = from + (i / amount) * len;
        const url = cardImages[i % cardImages.length]!;
        return (
          <Card
            key={`${category}-${i}`}
            url={url}
            active={hovered !== null}
            hovered={hovered === i}
            position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
            rotation={[0, Math.PI / 2 + angle, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(i);
              onPointerOver?.(i, url);
            }}
            onPointerOut={() => {
              setHovered(null);
              onPointerOut?.();
            }}
          />
        );
      })}
    </group>
  );
}

type ImageShaderMaterial = THREE.ShaderMaterial & { zoom: number; opacity: number };

function ActiveCard({
  textColor,
  hovered,
  previewUrl,
}: {
  textColor: string;
  hovered: number | null;
  previewUrl: string | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const displayUrl = previewUrl ?? cardImages[0]!;
  const name = useMemo(() => {
    if (hovered === null) return "";
    const a = ADJECTIVES[hovered % ADJECTIVES.length]!;
    const b = NOUNS[(hovered * 3) % NOUNS.length]!;
    return `${a} ${b}`;
  }, [hovered]);

  useLayoutEffect(() => {
    const mat = meshRef.current?.material as ImageShaderMaterial | undefined;
    if (!mat) return;
    mat.zoom = 0.8;
    if (hovered === null) mat.opacity = 0;
  }, [hovered, previewUrl]);

  useFrame((_state: RootState, delta: number) => {
    const mat = meshRef.current?.material as ImageShaderMaterial | undefined;
    if (!mat) return;
    easing.damp(mat, "zoom", 1, 0.5, delta);
    easing.damp(mat, "opacity", hovered !== null ? 1 : 0, 0.3, delta);
  });

  return (
    <Billboard follow>
      <Text
        font={INTER_FONT}
        fontSize={0.5}
        position={[2.15, 3.85, 0]}
        anchorX="left"
        color={textColor}
      >
        {hovered !== null ? `${name}\n${hovered}` : " "}
      </Text>
      <Image
        ref={meshRef}
        transparent
        toneMapped={false}
        radius={0.3}
        position={[0, 1.5, 0]}
        scale={[3.5, 1.618 * 3.5]}
        url={displayUrl}
        side={THREE.DoubleSide}
      />
    </Billboard>
  );
}

export function HomeHeroCards3D({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const textColor = resolvedTheme === "dark" ? "#fafafa" : "#0a0a0a";

  return (
    <div className={cn("min-h-0 w-full flex-1", className)}>
      <Canvas
        className="h-full w-full touch-none"
        dpr={[1, 1.5]}
        camera={{ position: [0, CAMERA_Y_BASE, CAMERA_Z_REST], fov: CAMERA_FOV, near: 0.1, far: 400 }}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={4} infinite style={{ width: "100%", height: "100%" }}>
            <Scene textColor={textColor} position={[0, 1.5, 0]} />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}
