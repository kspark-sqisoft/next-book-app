"use client";

// 디바이스 오프라인/복구 앱 내 알림 — 디바이스 목록이 갱신될 때
// online 상태 전환을 감지해 토스트를 띄운다(크레타 사이드바에서 상시 구동).
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { CretaDevice } from "@/features/creta/creta-api";

export function useDeviceOfflineNotifier(
  devices: CretaDevice[] | undefined,
): void {
  /** 디바이스 id → 직전 online 상태. null이면 아직 기준 없음(첫 로드는 알림 생략) */
  const prevRef = useRef<Map<number, boolean> | null>(null);

  useEffect(() => {
    if (!devices) return;
    const prev = prevRef.current;
    const next = new Map(devices.map((d) => [d.id, d.online]));
    prevRef.current = next;
    if (!prev) return; // 첫 로드 — 현재 상태를 기준으로만 삼는다
    for (const d of devices) {
      const was = prev.get(d.id);
      if (was === undefined || was === d.online) continue;
      if (d.online) {
        toast.success(`「${d.name}」 디바이스가 다시 온라인이 되었습니다.`);
      } else {
        toast.error(`「${d.name}」 디바이스가 오프라인이 되었습니다.`, {
          duration: 8000,
        });
      }
    }
  }, [devices]);
}
