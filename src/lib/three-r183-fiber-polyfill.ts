/**
 * three@r183+ 에서 `new THREE.Clock()` 시 폐기 경고가 납니다.
 * `@react-three/fiber` 스토어는 아직 `THREE.Clock` 을 쓰므로, 동작은 three 소스와 동일하게 두고
 * 경고만 없는 구현으로 덮어씁니다. (`three/src/core/Clock.js` 로직 복제, warn 제거)
 *
 * 이 모듈은 `main.tsx` 에서 다른 코드보다 먼저 import 되어야 합니다.
 *
 * 참고: 번들러/ESM 에서 `three` 네임스페이스의 `Clock` 이 `configurable: false` 이면
 * 패치는 불가능하며(조용히 건너뜀), 그 경우에는 공식 Clock 경고가 그대로 나올 수 있습니다.
 * HMR·재평가로 이 파일이 두 번 돌면 `defineProperty` 가 다시 실패하지 않도록 전역 가드를 둡니다.
 */
import * as THREE from "three";

class ClockWithoutR183DeprecationWarning {
  autoStart: boolean;
  startTime = 0;
  oldTime = 0;
  elapsedTime = 0;
  running = false;

  constructor(autoStart = true) {
    this.autoStart = autoStart;
  }

  start(): void {
    this.startTime = performance.now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop(): void {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }

  getElapsedTime(): number {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta(): number {
    let diff = 0;

    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }

    if (this.running) {
      const newTime = performance.now();
      diff = (newTime - this.oldTime) / 1000;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }

    return diff;
  }
}

const PATCH_FLAG = "__reactAuthThreeClockPolyfillApplied__";

function globalStore(): Record<string, boolean | undefined> {
  return globalThis as unknown as Record<string, boolean | undefined>;
}

function markApplied(): void {
  globalStore()[PATCH_FLAG] = true;
}

function alreadyApplied(): boolean {
  return Boolean(globalStore()[PATCH_FLAG]);
}

if (!alreadyApplied()) {
  try {
    const Replacement =
      ClockWithoutR183DeprecationWarning as unknown as typeof THREE.Clock;
    const desc = Object.getOwnPropertyDescriptor(THREE, "Clock");

    if (desc?.value === Replacement) {
      markApplied();
    } else if (desc?.configurable === true) {
      Object.defineProperty(THREE, "Clock", {
        value: Replacement,
        writable: true,
        configurable: true,
        enumerable: desc.enumerable,
      });
      markApplied();
    } else {
      /* 덮어쓸 수 없음 — 경고는 유지되나 런타임 오류는 방지 */
      markApplied();
    }
  } catch {
    markApplied();
  }
}
