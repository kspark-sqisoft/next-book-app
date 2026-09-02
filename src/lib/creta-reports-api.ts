// 재생 리포트(Proof-of-Play) 클라이언트 API + 표시 헬퍼
import {
  getCretaDeviceUptimeAction,
  getCretaPlayReportAction,
} from "@/actions/creta-reports";
import { getAccessToken, humanizeServerActionError } from "@/lib/api";

function requireToken(): string {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return token;
}

export const PLAY_REPORT_RANGES = [1, 7, 30] as const;
export type PlayReportRange = (typeof PLAY_REPORT_RANGES)[number];

export type CretaPlayReport = {
  rangeDays: PlayReportRange;
  generatedAt: string;
  totalPlays: number;
  totalDurationSec: number;
  deviceCount: number;
  contentCount: number;
  byContent: {
    kind: string;
    contentId: number | null;
    title: string;
    plays: number;
    durationSec: number;
    lastPlayedAt: string;
  }[];
  byDevice: {
    deviceId: number;
    deviceName: string;
    plays: number;
    durationSec: number;
    lastPlayedAt: string;
  }[];
  recent: {
    id: number;
    deviceId: number;
    deviceName: string;
    kind: string;
    title: string;
    startedAt: string;
    durationSec: number;
  }[];
};

export async function fetchCretaPlayReport(
  rangeDays: PlayReportRange,
): Promise<CretaPlayReport> {
  try {
    return (await getCretaPlayReportAction(
      requireToken(),
      rangeDays,
    )) as unknown as CretaPlayReport;
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

export const DEVICE_UPTIME_RANGES = [7, 30] as const;
export type DeviceUptimeRange = (typeof DEVICE_UPTIME_RANGES)[number];

export type CretaDeviceUptime = {
  rangeDays: DeviceUptimeRange;
  generatedAt: string;
  overallUptimePct: number;
  overallErrorPct: number;
  byDay: {
    date: string;
    online: number;
    error: number;
    offline: number;
  }[];
  byDevice: {
    deviceId: number;
    deviceName: string;
    location: string;
    uptimePct: number;
    errorPct: number;
    offlinePct: number;
    samples: number;
  }[];
};

export async function fetchCretaDeviceUptime(
  rangeDays: DeviceUptimeRange,
): Promise<CretaDeviceUptime> {
  try {
    return (await getCretaDeviceUptimeAction(
      requireToken(),
      rangeDays,
    )) as unknown as CretaDeviceUptime;
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
