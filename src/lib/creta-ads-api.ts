// 광고 플랫폼 클라이언트 API(서버 액션 브리지) + 화면 공용 라벨
import {
  addCretaAdCreativeAction,
  createCretaAdCampaignAction,
  createCretaAdvertiserAction,
  cretaAdCampaignReportAction,
  deleteCretaAdCampaignAction,
  deleteCretaAdCreativeAction,
  deleteCretaAdvertiserAction,
  listCretaAdActiveCreativesAction,
  listCretaAdCampaignsAction,
  listCretaAdvertisersAction,
  logCretaAdPlayAction,
  updateCretaAdCampaignAction,
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
  creatives: CretaAdCreative[];
  inFlight: boolean;
  updatedAt: string;
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
