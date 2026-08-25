"use server";

// 광고 플랫폼 서버 액션 — 조회 공개, 변경 로그인(다른 크레타 도메인과 동일 정책).
// 재생 로그(logAdPlay)는 보기 화면에서 익명으로도 쌓여야 해 토큰을 요구하지 않는다.
import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import { saveBookMainAndPoster } from "@/server/books/save-book-media";
import { HttpError } from "@/server/http/http-error";
import { BooksService } from "@/server/services/books.service";
import {
  type CretaAdActiveCreative,
  type CretaAdActor,
  type CretaAdAuditPublic,
  type CretaAdCampaignPublic,
  type CretaAdScreenInventory,
  type CretaAdSettingPublic,
  CretaAdsService,
  type CretaAdvertiserPublic,
} from "@/server/services/creta-ads.service";

/** JWT → 서비스 행위자(감사 로그·권한용) */
function toActor(u: {
  sub: number;
  name: string;
  email: string;
  role: string;
}): CretaAdActor {
  return { sub: u.sub, name: u.name || u.email, role: u.role };
}

const TAG = "creta-ads-actions";

export async function listCretaAdvertisersAction(): Promise<
  CretaAdvertiserPublic[]
> {
  try {
    return await new CretaAdsService().listAdvertisers();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaAdvertiserAction(
  accessToken: string | null | undefined,
  input: { name: string; contact?: string },
): Promise<{ id: number }> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaAdsService().createAdvertiser(
      { name: String(input?.name ?? ""), contact: input?.contact },
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaAdvertiserAction(
  accessToken: string | null | undefined,
  advertiserId: number,
  input: { name?: string; contact?: string },
): Promise<void> {
  try {
    await requireUserFromToken(accessToken);
    await new CretaAdsService().updateAdvertiser(
      assertPositiveIntId(advertiserId),
      input ?? {},
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaAdvertiserAction(
  accessToken: string | null | undefined,
  advertiserId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaAdsService().removeAdvertiser(
      assertPositiveIntId(advertiserId),
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function listCretaAdCampaignsAction(): Promise<
  CretaAdCampaignPublic[]
> {
  try {
    return await new CretaAdsService().listCampaigns();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaAdCampaignAction(
  accessToken: string | null | undefined,
  input: {
    advertiserId: number;
    name: string;
    startDate: string;
    endDate: string;
    weight?: number;
    cpm?: number;
    dayTarget?: string;
    startMin?: number | null;
    endMin?: number | null;
    maxPerHour?: number | null;
    targetTags?: string[];
  },
): Promise<{ id: number }> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaAdsService().createCampaign(
      input ?? ({} as never),
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaAdCampaignAction(
  accessToken: string | null | undefined,
  campaignId: number,
  input: {
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    weight?: number;
    cpm?: number;
    dayTarget?: string;
    startMin?: number | null;
    endMin?: number | null;
    maxPerHour?: number | null;
    targetTags?: string[];
  },
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaAdsService().updateCampaign(
      assertPositiveIntId(campaignId),
      input ?? {},
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaAdCampaignAction(
  accessToken: string | null | undefined,
  campaignId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaAdsService().removeCampaign(
      assertPositiveIntId(campaignId),
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function addCretaAdCreativeAction(
  accessToken: string | null | undefined,
  input: { campaignId: number; name: string; kind: string; src: string },
): Promise<{ id: number }> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaAdsService().addCreative(
      input ?? ({} as never),
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaAdCreativeAction(
  accessToken: string | null | undefined,
  creativeId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaAdsService().removeCreative(
      assertPositiveIntId(creativeId),
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/**
 * 광고 위젯 재생용 — 지금 편성 대상인 소재 목록(가중치 포함).
 * `deviceId`를 주면 그 화면을 대상으로 하는 캠페인만 남긴다(없으면 편성 후보 전체).
 */
export async function listCretaAdActiveCreativesAction(
  deviceId?: number | null,
): Promise<CretaAdActiveCreative[]> {
  try {
    return await new CretaAdsService().listActiveCreatives({ deviceId });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 보기 모드에서 소재 표시 시 재생 기록(Proof-of-Play) — 로그인 없이 허용 */
export async function logCretaAdPlayAction(input: {
  creativeId: number;
  bookId?: number | null;
  slotElementId: string;
  durationSec: number;
  deviceId?: number | null;
}): Promise<void> {
  try {
    await new CretaAdsService().logPlay(input ?? ({} as never));
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function cretaAdCampaignReportAction(
  days?: number,
): Promise<Awaited<ReturnType<CretaAdsService["campaignReport"]>>> {
  try {
    return await new CretaAdsService().campaignReport(days ?? 30);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 광고 전역 설정(루프 삽입·하우스 광고) — 조회 공개 */
export async function getCretaAdSettingAction(): Promise<CretaAdSettingPublic> {
  try {
    return await new CretaAdsService().getSetting();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaAdSettingAction(
  accessToken: string | null | undefined,
  input: {
    loopEveryN?: number;
    spotSec?: number;
    houseName?: string;
    houseKind?: string;
    houseSrc?: string;
  },
): Promise<CretaAdSettingPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaAdsService().updateSetting(
      input ?? {},
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function cretaAdHourlyReportAction(
  days?: number,
): Promise<Awaited<ReturnType<CretaAdsService["hourlyReport"]>>> {
  try {
    return await new CretaAdsService().hourlyReport(days ?? 30);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function cretaAdSlotReportAction(
  days?: number,
): Promise<Awaited<ReturnType<CretaAdsService["slotReport"]>>> {
  try {
    return await new CretaAdsService().slotReport(days ?? 30);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 소재 심의(관리자 전용) — 승인/반려 */
export async function reviewCretaAdCreativeAction(
  accessToken: string | null | undefined,
  creativeId: number,
  decision: "approved" | "rejected",
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaAdsService().reviewCreative(
      assertPositiveIntId(creativeId),
      decision,
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 광고 변경 이력(감사 로그) — 최근 30건 */
export async function listCretaAdAuditAction(): Promise<CretaAdAuditPublic[]> {
  try {
    return await new CretaAdsService().listAudit(30);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 화면 인벤토리(판매 가능량) — 디바이스 × 시간당 노출 능력 */
export async function cretaAdScreenInventoryAction(): Promise<
  CretaAdScreenInventory[]
> {
  try {
    return await new CretaAdsService().screenInventory();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 디바이스별 광고 노출 리포트 */
export async function cretaAdDeviceReportAction(
  days?: number,
): Promise<Awaited<ReturnType<CretaAdsService["deviceReport"]>>> {
  try {
    return await new CretaAdsService().deviceReport(days ?? 30);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 소재 순서 이동 — 같은 캠페인 안에서 앞(-1)/뒤(1) */
export async function moveCretaAdCreativeAction(
  accessToken: string | null | undefined,
  creativeId: number,
  direction: -1 | 1,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaAdsService().moveCreative(
      assertPositiveIntId(creativeId),
      direction === -1 ? -1 : 1,
      toActor(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 광고 소재·하우스 광고 미디어 업로드 — 북 업로드 저장소를 재사용(로그인 필요) */
export async function uploadCretaAdMediaAction(
  accessToken: string | null | undefined,
  formData: FormData,
): Promise<{ kind: "image" | "video"; url: string }> {
  try {
    await requireUserFromToken(accessToken);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new HttpError(400, "file 필드가 필요합니다.");
    }
    const { main } = await saveBookMainAndPoster(file, null);
    return new BooksService().mapUploadedFile(main);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
