// 긴급 알림 클라이언트 API(서버 액션 브리지) + 화면 공용 라벨·색
import {
  activateCretaAlertAction,
  deactivateCretaAlertAction,
  getActiveCretaAlertAction,
} from "@/actions/creta-alerts";
import { humanizeServerActionError } from "@/lib/api";

export const CRETA_ALERT_LEVELS = ["긴급", "주의", "안내"] as const;
export type CretaAlertLevel = (typeof CRETA_ALERT_LEVELS)[number];

export type CretaAlert = {
  id: number;
  message: string;
  level: CretaAlertLevel;
  /** true면 모든 디바이스 대상(deviceIds 무시) */
  allDevices: boolean;
  deviceIds: number[];
  createdAt: string;
  createdByName: string | null;
};

/** 레벨별 배너·배지 색(라이트·다크 공통 토큰) */
export const CRETA_ALERT_LEVEL_CLASS: Record<
  CretaAlertLevel,
  { banner: string; badge: string }
> = {
  긴급: {
    banner: "border-red-500/60 bg-red-600 text-white",
    badge: "bg-white/20 text-white",
  },
  주의: {
    banner: "border-amber-500/60 bg-amber-500 text-black",
    badge: "bg-black/15 text-black",
  },
  안내: {
    banner: "border-sky-500/60 bg-sky-600 text-white",
    badge: "bg-white/20 text-white",
  },
};

/** 활성 알림이 이 디바이스를 덮는지 */
export function cretaAlertCoversDevice(
  alert: CretaAlert | null | undefined,
  deviceId: number,
): boolean {
  if (!alert) return false;
  return alert.allDevices || alert.deviceIds.includes(deviceId);
}

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

export async function fetchActiveCretaAlert(): Promise<CretaAlert | null> {
  return run(() =>
    getActiveCretaAlertAction(),
  ) as unknown as Promise<CretaAlert | null>;
}

/** 발송 — deviceIds가 비어 있으면 모든 디바이스 대상 */
export async function activateCretaAlert(input: {
  message: string;
  level: CretaAlertLevel;
  deviceIds?: number[];
}): Promise<CretaAlert> {
  return run(() =>
    activateCretaAlertAction(input),
  ) as unknown as Promise<CretaAlert>;
}

export async function deactivateCretaAlert(): Promise<void> {
  await run(() => deactivateCretaAlertAction());
}
