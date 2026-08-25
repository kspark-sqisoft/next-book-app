// 광고 플랫폼 클라이언트 API(서버 액션 브리지) + 화면 공용 라벨
import {
  addCretaAdCreativeAction,
  createCretaAdCampaignAction,
  createCretaAdvertiserAction,
  cretaAdCampaignReportAction,
  cretaAdHourlyReportAction,
  cretaAdSlotInventoryAction,
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
} from "@/actions/creta-ads";
import { getAccessToken, humanizeServerActionError } from "@/lib/api";

export const CRETA_AD_CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  live: "라이브",
  paused: "일시중지",
};

export type CretaAdvertiser = {
  id: number;
  name: string;
  contact: string;
  ownerName: string | null;
  campaignCount: number;
  updatedAt: string;
};

export type CretaAdCreative = {
  id: number;
  campaignId: number;
  name: string;
  kind: "image" | "video";
  src: string;
  status: "pending" | "approved" | "rejected";
};

export const CRETA_AD_CREATIVE_STATUS_LABEL: Record<
  CretaAdCreative["status"],
  string
> = {
  pending: "심의 중",
  approved: "승인",
  rejected: "반려",
};

export type CretaAdCampaign = {
  id: number;
  advertiserId: number;
  advertiserName: string;
  name: string;
  status: "live" | "paused";
  startDate: string;
  endDate: string;
  weight: number;
  cpm: number;
  dayTarget: "all" | "weekday" | "weekend";
  startMin: number | null;
  endMin: number | null;
  maxPerHour: number | null;
  creatives: CretaAdCreative[];
  inFlight: boolean;
  phase: "scheduled" | "live" | "paused" | "ended";
  updatedAt: string;
};

export type CretaAdSetting = {
  loopEveryN: number;
  spotSec: number;
  houseName: string;
  houseKind: "image" | "video";
  houseSrc: string;
};

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
  lastPlayedAt: string | null;
};

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

function requireToken(): string {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return token;
}

export async function fetchCretaAdvertisers(): Promise<CretaAdvertiser[]> {
  return run(() => listCretaAdvertisersAction()) as unknown as Promise<
    CretaAdvertiser[]
  >;
}

export async function createCretaAdvertiser(input: {
  name: string;
  contact?: string;
}): Promise<{ id: number }> {
  return run(() => createCretaAdvertiserAction(requireToken(), input));
}

export async function updateCretaAdvertiser(
  id: number,
  input: { name?: string; contact?: string },
): Promise<void> {
  await run(() => updateCretaAdvertiserAction(requireToken(), id, input));
}

export async function deleteCretaAdvertiser(id: number): Promise<void> {
  await run(() => deleteCretaAdvertiserAction(requireToken(), id));
}

export async function fetchCretaAdCampaigns(): Promise<CretaAdCampaign[]> {
  return run(() => listCretaAdCampaignsAction()) as unknown as Promise<
    CretaAdCampaign[]
  >;
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
}): Promise<{ id: number }> {
  return run(() => createCretaAdCampaignAction(requireToken(), input));
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
  },
): Promise<void> {
  await run(() => updateCretaAdCampaignAction(requireToken(), id, input));
}

export async function deleteCretaAdCampaign(id: number): Promise<void> {
  await run(() => deleteCretaAdCampaignAction(requireToken(), id));
}

export async function addCretaAdCreative(input: {
  campaignId: number;
  name: string;
  kind: "image" | "video";
  src: string;
}): Promise<{ id: number }> {
  return run(() => addCretaAdCreativeAction(requireToken(), input));
}

export async function deleteCretaAdCreative(id: number): Promise<void> {
  await run(() => deleteCretaAdCreativeAction(requireToken(), id));
}

/** 광고 위젯 재생용 — 활성 캠페인 소재(가중치 포함) */
export async function fetchCretaAdActiveCreatives(): Promise<
  CretaAdActiveCreative[]
> {
  return run(() => listCretaAdActiveCreativesAction()) as unknown as Promise<
    CretaAdActiveCreative[]
  >;
}

/** 재생 기록 — 실패해도 화면 재생을 막지 않는다(fire-and-forget용) */
export async function logCretaAdPlay(input: {
  creativeId: number;
  bookId?: number | null;
  slotElementId: string;
  durationSec: number;
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
  return run(() => cretaAdCampaignReportAction(days)) as unknown as Promise<
    CretaAdCampaignReportRow[]
  >;
}

export async function fetchCretaAdSetting(): Promise<CretaAdSetting> {
  return run(() =>
    getCretaAdSettingAction(),
  ) as unknown as Promise<CretaAdSetting>;
}

export async function updateCretaAdSetting(input: {
  loopEveryN?: number;
  spotSec?: number;
  houseName?: string;
  houseKind?: "image" | "video";
  houseSrc?: string;
}): Promise<CretaAdSetting> {
  return run(() =>
    updateCretaAdSettingAction(requireToken(), input),
  ) as unknown as Promise<CretaAdSetting>;
}

export type CretaAdHourlyRow = { hour: number; plays: number };
export type CretaAdSlotRow = {
  slotElementId: string;
  bookId: number | null;
  plays: number;
  lastPlayedAt: string | null;
};

export async function fetchCretaAdHourlyReport(
  days = 30,
): Promise<CretaAdHourlyRow[]> {
  return run(() => cretaAdHourlyReportAction(days)) as unknown as Promise<
    CretaAdHourlyRow[]
  >;
}

export async function fetchCretaAdSlotReport(
  days = 30,
): Promise<CretaAdSlotRow[]> {
  return run(() => cretaAdSlotReportAction(days)) as unknown as Promise<
    CretaAdSlotRow[]
  >;
}

export type CretaAdAuditRow = {
  id: number;
  entityKind: "advertiser" | "campaign" | "creative" | "setting";
  entityName: string;
  action: string;
  detail: string;
  actorName: string;
  createdAt: string;
};

export const CRETA_AD_AUDIT_KIND_LABEL: Record<
  CretaAdAuditRow["entityKind"],
  string
> = {
  advertiser: "광고주",
  campaign: "캠페인",
  creative: "소재",
  setting: "설정",
};

export type CretaAdSlotInventoryRow = {
  bookId: number;
  bookTitle: string;
  slotElementId: string;
  slotName: string;
  slotSec: number;
  deviceCount: number;
  hourlyCapacity: number;
};

/** 소재 심의(관리자) — 승인/반려 */
export async function reviewCretaAdCreative(
  id: number,
  decision: "approved" | "rejected",
): Promise<void> {
  await run(() => reviewCretaAdCreativeAction(requireToken(), id, decision));
}

export async function fetchCretaAdAudit(): Promise<CretaAdAuditRow[]> {
  return run(() => listCretaAdAuditAction()) as unknown as Promise<
    CretaAdAuditRow[]
  >;
}

export async function fetchCretaAdSlotInventory(): Promise<
  CretaAdSlotInventoryRow[]
> {
  return run(() => cretaAdSlotInventoryAction()) as unknown as Promise<
    CretaAdSlotInventoryRow[]
  >;
}

/** 소재 순서 이동 — 앞(-1)/뒤(1) */
export async function moveCretaAdCreative(
  id: number,
  direction: -1 | 1,
): Promise<void> {
  await run(() => moveCretaAdCreativeAction(requireToken(), id, direction));
}
