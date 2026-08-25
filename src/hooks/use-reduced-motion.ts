"use client";

import { useSyncExternalStore } from "react";

/**
 * OS의 "동작 줄이기" 설정 구독 — 켜져 있으면 연출을 건너뛰고 결과 상태로 바로 간다.
 * 서버 스냅샷은 항상 false(SSR 불일치 방지) — 하이드레이션 후 실제 값으로 맞춰진다.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
