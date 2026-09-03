// 재생 리포트(Proof-of-Play) 클라이언트 API + 표시 헬퍼
import {
  getCretaDeviceUptimeAction,
  getCretaPlayReportAction,
} from "@/actions/creta-reports";
import { humanizeServerActionError } from "@/lib/api";
import type { CretaDeviceUptimePublic } from "@/server/services/creta-device-uptime.service";
// 서버 DTO를 단일 출처로 삼는다(타입 전용 import 라 런타임에는 지워진다)
import type { CretaPlayReportPublic } from "@/server/services/creta-play-log.service";

export const PLAY_REPORT_RANGES = [1, 7, 30] as const;
export type PlayReportRange = (typeof PLAY_REPORT_RANGES)[number];

export type CretaPlayReport = CretaPlayReportPublic;

export async function fetchCretaPlayReport(
  rangeDays: PlayReportRange,
): Promise<CretaPlayReport> {
  try {
    return await getCretaPlayReportAction(rangeDays);
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

export const DEVICE_UPTIME_RANGES = [7, 30] as const;
export type DeviceUptimeRange = (typeof DEVICE_UPTIME_RANGES)[number];

export type CretaDeviceUptime = CretaDeviceUptimePublic;

export async function fetchCretaDeviceUptime(
  rangeDays: DeviceUptimeRange,
): Promise<CretaDeviceUptime> {
  try {
    return await getCretaDeviceUptimeAction(rangeDays);
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

/** 초 → "N시간 M분" / "M분" / "S초" */
export function formatPlayDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}
