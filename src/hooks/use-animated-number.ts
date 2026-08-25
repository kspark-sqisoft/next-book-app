"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

/** 끝에서 부드럽게 감속 — 게이지가 목표치에 안착하는 느낌 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 0에서 `target` 까지 차오르는 값. 값이 바뀌면 **현재 표시값에서 이어서** 움직이므로
 * 폴링으로 수치가 갱신돼도 처음부터 다시 차오르지 않는다.
 *
 * 동작 줄이기 설정이 켜져 있으면 연출 없이 목표치를 그대로 돌려준다.
 */
export function useAnimatedNumber(
  target: number,
  options?: { durationMs?: number; delayMs?: number },
): number {
  const durationMs = options?.durationMs ?? 700;
  const delayMs = options?.delayMs ?? 0;
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion && durationMs > 0;

  const [value, setValue] = useState(0);
  /** rAF 콜백이 최신 표시값을 읽어야 해서 상태와 별도로 유지 */
  const valueRef = useRef(0);

  useEffect(() => {
    if (!animate) return;
    const from = valueRef.current;
    if (from === target) return;

    let raf = 0;
    let startedAt = 0;
    const step = (now: number) => {
      if (startedAt === 0) startedAt = now;
      const elapsed = now - startedAt - delayMs;
      if (elapsed < 0) {
        raf = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      const next = from + (target - from) * easeOutCubic(t);
      valueRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, delayMs, animate]);

  // 연출을 끈 경우엔 상태를 거치지 않고 목표치를 그대로 준다(효과 안 setState 회피)
  return animate ? value : target;
}
