/**
 * CodeSandbox [BestServedBold Christmas Baubles (zxpv7)](https://codesandbox.io/p/sandbox/zxpv7?file=%2Fsrc%2FApp.js)
 * 의 `App.js`를 TypeScript + 최신 R3F/Rapier API에 맞게 포팅했습니다.
 */
// 보블+Rapier 물리 히어로(zxpv7 포팅)
import { Environment, useGLTF } from "@react-three/drei";
import { Canvas, type RootState, useFrame } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import type { RapierRigidBody } from "@react-three/rapier";
import {
  BallCollider,
  CylinderCollider,
  Physics,
  RigidBody,
} from "@react-three/rapier";
import { Suspense, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

THREE.ColorManagement.enabled = true;

const baubleMaterial = new THREE.MeshLambertMaterial({
  color: "#c0a0a0",
  emissive: "red",
});
const capMaterial = new THREE.MeshStandardMaterial({
  metalness: 0.75,
  roughness: 0.15,
  color: "#8a492f",
  emissive: "#600000",
  envMapIntensity: 20,
});
const sphereGeometry = new THREE.SphereGeometry(1, 28, 28);

const baubles = [...Array(50)].map(() => ({
  scale: [0.75, 0.75, 1, 1, 1.25][Math.floor(Math.random() * 5)] as number,
}));

function Bauble({
  scale,
  r = THREE.MathUtils.randFloatSpread,
}: {
  scale: number;
  r?: typeof THREE.MathUtils.randFloatSpread;
}) {
  const { nodes } = useGLTF("/cap.glb");
  const mesh1 = nodes.Mesh_1 as THREE.Mesh;
  const api = useRef<RapierRigidBody>(null);
  const impulseScratch = useRef(new THREE.Vector3());
  const factorScratch = useRef(new THREE.Vector3());

  useFrame((_state: RootState, delta: number) => {
    const body = api.current;
    if (!body) return;
    const d = Math.min(0.1, delta);
    const t = body.translation();
    const v = impulseScratch.current;
    const f = factorScratch.current;
    f.set(-50 * d * scale, -150 * d * scale, -50 * d * scale);
    v.set(t.x, t.y, t.z).normalize().multiply(f);
    body.applyImpulse({ x: v.x, y: v.y, z: v.z }, true);
  });

  return (
    <RigidBody
      linearDamping={0.75}
      angularDamping={0.15}
      friction={0.2}
      position={[r(20), r(20) - 25, r(20) - 10]}
      ref={api}
      colliders={false}
    >
      <BallCollider args={[scale]} />
      <CylinderCollider
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 1.2 * scale]}
        args={[0.15 * scale, 0.275 * scale]}
      />
      <mesh
        castShadow
        receiveShadow
        scale={scale}
        geometry={sphereGeometry}
        material={baubleMaterial}
      />
      <mesh
        castShadow
        scale={2.5 * scale}
        position={[0, 0, -1.8 * scale]}
        geometry={mesh1.geometry}
        material={capMaterial}
      />
    </RigidBody>
  );
}

const pointerTarget = new THREE.Vector3();

const pointerSmooth = new THREE.Vector3();

function Pointer() {
  const ref = useRef<RapierRigidBody>(null);
  useFrame(({ pointer, viewport }) => {
    pointerTarget.set(
      (pointer.x * viewport.width) / 2,
      (pointer.y * viewport.height) / 2,
      0,
    );
    pointerSmooth.lerp(pointerTarget, 0.2);
    ref.current?.setNextKinematicTranslation({
      x: pointerSmooth.x,
      y: pointerSmooth.y,
      z: pointerSmooth.z,
    });
  });
  return (
    <RigidBody
      position={[100, 100, 100]}
      type="kinematicPosition"
      colliders={false}
      ref={ref}
    >
      <BallCollider args={[2]} />
    </RigidBody>
  );
}

useGLTF.preload("/cap.glb");

export function HomeHero3D({ className }: { className?: string }) {
  return (
    <div className={cn("min-h-0 w-full flex-1", className)}>
      <Canvas
        className="h-full w-full"
        /** `true`(soft) 는 three r183+ 에서 PCFSoftShadowMap 폐기 경고 — `percentage` = PCFShadowMap */
        shadows="percentage"
        gl={{ alpha: true, stencil: false, depth: false, antialias: false }}
        camera={{ position: [0, 0, 20], fov: 32.5, near: 1, far: 100 }}
        onCreated={(state) => {
          state.gl.toneMappingExposure = 1.5;
        }}
      >
        <ambientLight intensity={1} />
        <spotLight
          position={[20, 20, 25]}
          penumbra={1}
          angle={0.2}
          color="white"
          castShadow
          shadow-mapSize={[512, 512]}
        />
        <directionalLight position={[0, 5, -4]} intensity={4} />
        <directionalLight position={[0, -15, 0]} intensity={4} color="red" />
        <Suspense fallback={null}>
          <Physics gravity={[0, 0, 0]}>
            <Pointer />
            {baubles.map((props, i) => (
              <Bauble key={i} {...props} />
            ))}
          </Physics>
          <Environment files="/adamsbridge.hdr" />
        </Suspense>
        <EffectComposer enableNormalPass={false}>
          <N8AO color="red" aoRadius={2} intensity={1.15} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
