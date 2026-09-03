// 광고 플랫폼 클라이언트 API(서버 액션 브리지) + 화면 공용 라벨
import {
  addCretaAdCreativeAction,
  createCretaAdCampaignAction,
  createCretaAdvertiserAction,
  cretaAdCampaignReportAction,
  cretaAdDeviceReportAction,
  cretaAdHourlyReportAction,
  cretaAdScreenInventoryAction,
  cretaAdSlotReportAction,
  deleteCretaAdCampaignAction,
  deleteCretaAdCreativeAction,
  deleteCretaAdvertiserAction,
  getCretaAdSettingAction,
  listCretaAdActiveCreativesAction,
  listCretaAdAuditAction,
  listCretaAdCampaignsAction,
  listCretaAdvertisersAction,
  logCretaAdPlayAction,
  moveCretaAdCreativeAction,
  reviewCretaAdCreativeAction,
  updateCretaAdCampaignAction,
  updateCretaAdSettingAction,
  updateCretaAdvertiserAction,
  uploadCretaAdMediaAction,
} from "@/actions/creta-ads";
import { humanizeServerActionError } from "@/lib/api";
// 서버 DTO를 단일 출처로 삼는다(타입 전용 import 라 런타임에는 지워진다)
import type {
  CretaAdAuditPublic,
  CretaAdCampaignPublic,
  CretaAdCreativePublic,
  CretaAdSettingPublic,
  CretaAdvertiserPublic,
} from "@/server/services/creta-ads.service";

export const CRETA_AD_CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  live: "라이브",
  paused: "일시중지",
};

export type CretaAdvertiser = CretaAdvertiserPublic;

export type CretaAdCreative = CretaAdCreativePublic;

export const CRETA_AD_CREATIVE_STATUS_LABEL: Record<
  CretaAdCreative["status"],
  string
> = {
  pending: "심의 중",
  approved: "승인",
  rejected: "반려",
};

export type CretaAdCampaign = CretaAdCampaignPublic;

export type CretaAdSetting = CretaAdSettingPublic;

export const CRETA_AD_PHASE_LABEL: Record<CretaAdCampaign["phase"], string> = {
  scheduled: "예정",
  live: "라이브",
  paused: "일시중지",
  ended: "종료",
};

export const CRETA_AD_DAY_TARGET_LABEL: Record<
  CretaAdCampaign["dayTarget"],
  string
> = {
  all: "매일",
  weekday: "평일",
  weekend: "주말",
};

export type CretaAdActiveCreative = CretaAdCreative & {
  campaignName: string;
  weight: number;
};

export type CretaAdCampaignReportRow = {
  campaignId: number;
  campaignName: string;
  plays: number;
  totalSec: number;
  /** 서버 액션 경로라 Date 가 그대로 온다(React Flight가 Date를 왕복 보존) */
  lastPlayedAt: Date | null;
};

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

export async function fetchCretaAdvertisers(): Promise<CretaAdvertiser[]> {
  return run(() => listCretaAdvertisersAction());
}

export async function createCretaAdvertiser(input: {
  name: string;
  contact?: string;
}): Promise<{ id: number }> {
  return run(() => createCretaAdvertiserAction(input));
}

export async function updateCretaAdvertiser(
  id: number,
  input: { name?: string; contact?: string },
): Promise<void> {
  await run(() => updateCretaAdvertiserAction(id, input));
}

export async function deleteCretaAdvertiser(id: number): Promise<void> {
  await run(() => deleteCretaAdvertiserAction(id));
}

export async function fetchCretaAdCampaigns(): Promise<CretaAdCampaign[]> {
  return run(() => listCretaAdCampaignsAction());
}

export async function createCretaAdCampaign(input: {
  advertiserId: number;
  name: string;
  startDate: string;
  endDate: string;
  weight?: number;
  cpm?: number;
  dayTarget?: "all" | "weekday" | "weekend";
  startMin?: number | null;
  endMin?: number | null;
  maxPerHour?: number | null;
  /** 대상 화면(디바이스 태그). 비우면 전체 화면 대상 */
  targetTags?: string[];
}): Promise<{ id: number }> {
  return run(() => createCretaAdCampaignAction(input));
}

export async function updateCretaAdCampaign(
  id: number,
  input: {
    name?: string;
    status?: "live" | "paused";
    startDate?: string;
    endDate?: string;
    weight?: number;
    cpm?: number;
    dayTarget?: "all" | "weekday" | "weekend";
    startMin?: number | null;
    endMin?: number | null;
    maxPerHour?: number | null;
    /** 전달하면 통째로 교체. 생략하면 기존 대상 유지 */
    targetTags?: string[];
  },
): Promise<void> {
  await run(() => updateCretaAdCampaignAction(id, input));
}

export async function deleteCretaAdCampaign(id: number): Promise<void> {
  await run(() => deleteCretaAdCampaignAction(id));
}

export async function addCretaAdCreative(input: {
  campaignId: number;
  name: string;
  kind: "image" | "video";
  src: string;
}): Promise<{ id: number }> {
  return run(() => addCretaAdCreativeAction(input));
}

export async function deleteCretaAdCreative(id: number): Promise<void> {
  await run(() => deleteCretaAdCreativeAction(id));
}

/**
 * 광고 위젯 재생용 — 활성 캠페인 소재(가중치 포함).
 * `deviceId`를 주면 그 화면 대상 캠페인만(없으면 편성 후보 전체).
 */
export async function fetchCretaAdActiveCreatives(
  deviceId?: number | null,
): Promise<CretaAdActiveCreative[]> {
  return run(() => listCretaAdActiveCreativesAction(deviceId));
}

/** 재생 기록 — 실패해도 화면 재생을 막지 않는다(fire-and-forget용) */
export async function logCretaAdPlay(input: {
  creativeId: number;
  bookId?: number | null;
  slotElementId: string;
  durationSec: number;
  /** 노출된 화면 — 디바이스 문맥이 있을 때만 */
  deviceId?: number | null;
}): Promise<void> {
  try {
    await logCretaAdPlayAction(input);
  } catch {
    /* 로그 실패는 무시 */
  }
}

export async function fetchCretaAdCampaignReport(
  days = 30,
): Promise<CretaAdCampaignReportRow[]> {
  return run(() => cretaAdCampaignReportAction(days));
}

export async function fetchCretaAdSetting(): Promise<CretaAdSetting> {
  return run(() => getCretaAdSettingAction());
}

export async function updateCretaAdSetting(input: {
  loopEveryN?: number;
  spotSec?: number;
  houseName?: string;
  houseKind?: "image" | "video";
  houseSrc?: string;
}): Promise<CretaAdSetting> {
  return run(() => updateCretaAdSettingAction(input));
}

export type CretaAdHourlyRow = { hour: number; plays: number };
export type CretaAdSlotRow = {
  slotElementId: string;
  bookId: number | null;
  plays: number;
  /** 서버 액션 경로라 Date 가 그대로 온다 */
  lastPlayedAt: Date | null;
};

export async function fetchCretaAdHourlyReport(
  days = 30,
): Promise<CretaAdHourlyRow[]> {
  return run(() => cretaAdHourlyReportAction(days));
}

export async function fetchCretaAdSlotReport(
  days = 30,
): Promise<CretaAdSlotRow[]> {
  return run(() => cretaAdSlotReportAction(days));
}

export type CretaAdAuditRow = CretaAdAuditPublic;

export const CRETA_AD_AUDIT_KIND_LABEL: Record<
  CretaAdAuditRow["entityKind"],
  string
> = {
  advertiser: "광고주",
  campaign: "캠페인",
  creative: "소재",
  setting: "설정",
};

export type CretaAdScreenChannelRow = {
  kind: "slot" | "adloop";
  label: string;
  spotSec: number;
};

export type CretaAdScreenInventoryRow = {
  deviceId: number;
  deviceName: string;
  location: string;
  online: boolean;
  tags: string[];
  channels: CretaAdScreenChannelRow[];
  hourlyCapacity: number;
  liveCampaigns: number;
};

export type CretaAdDeviceReportRow = {
  deviceId: number | null;
  deviceName: string;
  plays: number;
  seconds: number;
};

/** 소재 심의(관리자) — 승인/반려 */
export async function reviewCretaAdCreative(
  id: number,
  decision: "approved" | "rejected",
): Promise<void> {
  await run(() => reviewCretaAdCreativeAction(id, decision));
}

export async function fetchCretaAdAudit(): Promise<CretaAdAuditRow[]> {
  return run(() => listCretaAdAuditAction());
}

export async function fetchCretaAdScreenInventory(): Promise<
  CretaAdScreenInventoryRow[]
> {
  return run(() => cretaAdScreenInventoryAction());
}

export async function fetchCretaAdDeviceReport(
  days = 30,
): Promise<CretaAdDeviceReportRow[]> {
  return run(() => cretaAdDeviceReportAction(days));
}

/** 소재 순서 이동 — 앞(-1)/뒤(1) */
export async function moveCretaAdCreative(
  id: number,
  direction: -1 | 1,
): Promise<void> {
  await run(() => moveCretaAdCreativeAction(id, direction));
}

/** 광고 미디어 업로드 — 성공 시 종류와 /uploads URL 반환 */
export async function uploadCretaAdMedia(
  file: File,
): Promise<{ kind: "image" | "video"; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  return run(() => uploadCretaAdMediaAction(fd));
}
