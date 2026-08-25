// 광고 플랫폼(1단계) 서비스 — 광고주·캠페인·소재 CRUD + 활성 소재 조회(편성) + 재생 로그.
// 편성은 클라이언트(광고 위젯)가 슬롯 길이 공통 클록으로 순환하고, 여기서는
// "지금 활성인 캠페인의 소재 목록(가중치 반영)"과 재생 기록·집계만 책임진다.
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  cretaAdCampaign,
  cretaAdCreative,
  cretaAdPlayLog,
  cretaAdSetting,
  cretaAdvertiser,
  user as userTable,
} from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";

const NAME_MAX = 120;
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 10;
const CPM_MAX = 100_000_000;

export type CretaAdvertiserPublic = {
  id: number;
  name: string;
  contact: string;
  ownerName: string | null;
  campaignCount: number;
  updatedAt: Date;
};

export type CretaAdCampaignPublic = {
  id: number;
  advertiserId: number;
  advertiserName: string;
  name: string;
  status: "live" | "paused";
  startDate: string;
  endDate: string;
  weight: number;
  cpm: number;
  /** 요일 타기팅: all|weekday|weekend */
  dayTarget: "all" | "weekday" | "weekend";
  /** 시간대 타기팅(분). null = 종일 */
  startMin: number | null;
  endMin: number | null;
  creatives: CretaAdCreativePublic[];
  /** 오늘 기준 기간 안 여부(참고 표시용) */
  inFlight: boolean;
  /** 파생 단계: 시작 전 scheduled → live/paused → 기간 지남 ended */
  phase: "scheduled" | "live" | "paused" | "ended";
  updatedAt: Date;
};

/** 광고 전역 설정(단일 행) — 루프 삽입·하우스 광고 */
export type CretaAdSettingPublic = {
  loopEveryN: number;
  spotSec: number;
  houseName: string;
  houseKind: "image" | "video";
  houseSrc: string;
};

export type CretaAdCreativePublic = {
  id: number;
  campaignId: number;
  name: string;
  kind: "image" | "video";
  src: string;
};

/** 광고 위젯이 재생할 활성 소재 — 캠페인 가중치·이름 포함 */
export type CretaAdActiveCreative = CretaAdCreativePublic & {
  campaignName: string;
  weight: number;
};

function assertName(v: unknown, label: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new HttpError(400, `${label}을(를) 입력하세요.`);
  if (s.length > NAME_MAX) {
    throw new HttpError(400, `${label}은(는) ${NAME_MAX}자 이하여야 합니다.`);
  }
  return s;
}

function assertDate(v: unknown, label: string): string {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, `${label}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return s;
}

/** 오늘(로컬) YYYY-MM-DD — 기간(flight) 판정용 */
function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function normalizeAdSrc(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) throw new HttpError(400, "소재 src를 입력하세요.");
  const noQuery = s.includes("?") ? s.slice(0, s.indexOf("?")) : s;
  const uploadsIdx = noQuery.indexOf("/uploads/");
  if (uploadsIdx >= 0) return noQuery.slice(uploadsIdx, uploadsIdx + 512);
  if (/^https:\/\//.test(s)) return s.slice(0, 512);
  throw new HttpError(
    400,
    "소재 src는 /uploads/ 경로 또는 https URL이어야 합니다.",
  );
}

function assertDaypart(input: {
  dayTarget?: string;
  startMin?: number | null;
  endMin?: number | null;
}): {
  dayTarget?: "all" | "weekday" | "weekend";
  startMin?: number | null;
  endMin?: number | null;
} {
  const out: {
    dayTarget?: "all" | "weekday" | "weekend";
    startMin?: number | null;
    endMin?: number | null;
  } = {};
  if (input.dayTarget != null) {
    if (!["all", "weekday", "weekend"].includes(input.dayTarget)) {
      throw new HttpError(
        400,
        "요일 타기팅은 all·weekday·weekend 중 하나여야 합니다.",
      );
    }
    out.dayTarget = input.dayTarget as "all" | "weekday" | "weekend";
  }
  const validMin = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1440;
  if (input.startMin !== undefined) {
    if (input.startMin !== null && !validMin(input.startMin)) {
      throw new HttpError(400, "시간대 시작(분)이 올바르지 않습니다.");
    }
    out.startMin = input.startMin;
  }
  if (input.endMin !== undefined) {
    if (input.endMin !== null && !validMin(input.endMin)) {
      throw new HttpError(400, "시간대 종료(분)가 올바르지 않습니다.");
    }
    out.endMin = input.endMin;
  }
  if (
    out.startMin != null &&
    out.endMin != null &&
    out.endMin <= out.startMin
  ) {
    throw new HttpError(400, "시간대 종료는 시작 이후여야 합니다.");
  }
  return out;
}

export class CretaAdsService {
  private db() {
    return getDb();
  }

  // ── 광고주 ──────────────────────────────────────────────

  async listAdvertisers(): Promise<CretaAdvertiserPublic[]> {
    const db = this.db();
    const rows = await db
      .select()
      .from(cretaAdvertiser)
      .orderBy(desc(cretaAdvertiser.id));
    const ownerIds = [
      ...new Set(
        rows.map((r) => r.ownerId).filter((n): n is number => n != null),
      ),
    ];
    const owners = ownerIds.length
      ? await db
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(inArray(userTable.id, ownerIds))
      : [];
    const ownerName = new Map(owners.map((u) => [u.id, u.name]));
    const counts = await db
      .select({
        advertiserId: cretaAdCampaign.advertiserId,
        count: sql<number>`count(*)::int`,
      })
      .from(cretaAdCampaign)
      .groupBy(cretaAdCampaign.advertiserId);
    const countMap = new Map(counts.map((c) => [c.advertiserId, c.count]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      contact: r.contact,
      ownerName: r.ownerId != null ? (ownerName.get(r.ownerId) ?? null) : null,
      campaignCount: countMap.get(r.id) ?? 0,
      updatedAt: r.updatedAt,
    }));
  }

  async createAdvertiser(
    input: { name: string; contact?: string },
    ownerId: number,
  ): Promise<{ id: number }> {
    const name = assertName(input.name, "광고주 이름");
    const contact = String(input.contact ?? "")
      .trim()
      .slice(0, 200);
    const [row] = await this.db()
      .insert(cretaAdvertiser)
      .values({ name, contact, ownerId })
      .returning({ id: cretaAdvertiser.id });
    if (!row) throw new HttpError(500, "광고주 등록에 실패했습니다.");
    return row;
  }

  async updateAdvertiser(
    id: number,
    input: { name?: string; contact?: string },
  ): Promise<void> {
    const set: Partial<typeof cretaAdvertiser.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name != null) set.name = assertName(input.name, "광고주 이름");
    if (input.contact != null) {
      set.contact = String(input.contact).trim().slice(0, 200);
    }
    const updated = await this.db()
      .update(cretaAdvertiser)
      .set(set)
      .where(eq(cretaAdvertiser.id, id))
      .returning({ id: cretaAdvertiser.id });
    if (updated.length === 0) {
      throw new HttpError(404, "광고주를 찾을 수 없습니다.");
    }
  }

  async removeAdvertiser(id: number): Promise<void> {
    const deleted = await this.db()
      .delete(cretaAdvertiser)
      .where(eq(cretaAdvertiser.id, id))
      .returning({ id: cretaAdvertiser.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "광고주를 찾을 수 없습니다.");
    }
  }

  // ── 캠페인 ──────────────────────────────────────────────

  private async mapCampaigns(
    rows: (typeof cretaAdCampaign.$inferSelect)[],
  ): Promise<CretaAdCampaignPublic[]> {
    const db = this.db();
    const advertiserIds = [...new Set(rows.map((r) => r.advertiserId))];
    const advertisers = advertiserIds.length
      ? await db
          .select({ id: cretaAdvertiser.id, name: cretaAdvertiser.name })
          .from(cretaAdvertiser)
          .where(inArray(cretaAdvertiser.id, advertiserIds))
      : [];
    const advName = new Map(advertisers.map((a) => [a.id, a.name]));
    const campaignIds = rows.map((r) => r.id);
    const creatives = campaignIds.length
      ? await db
          .select()
          .from(cretaAdCreative)
          .where(inArray(cretaAdCreative.campaignId, campaignIds))
          .orderBy(cretaAdCreative.id)
      : [];
    const today = todayStr();
    return rows.map((r) => ({
      id: r.id,
      advertiserId: r.advertiserId,
      advertiserName: advName.get(r.advertiserId) ?? "알 수 없음",
      name: r.name,
      status: r.status === "paused" ? "paused" : "live",
      startDate: r.startDate,
      endDate: r.endDate,
      weight: r.weight,
      cpm: r.cpm,
      dayTarget:
        r.dayTarget === "weekday" || r.dayTarget === "weekend"
          ? r.dayTarget
          : "all",
      startMin: r.startMin ?? null,
      endMin: r.endMin ?? null,
      inFlight: r.startDate <= today && today <= r.endDate,
      phase:
        today < r.startDate
          ? ("scheduled" as const)
          : today > r.endDate
            ? ("ended" as const)
            : r.status === "paused"
              ? ("paused" as const)
              : ("live" as const),
      updatedAt: r.updatedAt,
      creatives: creatives
        .filter((c) => c.campaignId === r.id)
        .map((c) => ({
          id: c.id,
          campaignId: c.campaignId,
          name: c.name,
          kind: c.kind === "video" ? ("video" as const) : ("image" as const),
          src: c.src,
        })),
    }));
  }

  async listCampaigns(): Promise<CretaAdCampaignPublic[]> {
    const rows = await this.db()
      .select()
      .from(cretaAdCampaign)
      .orderBy(desc(cretaAdCampaign.id));
    return this.mapCampaigns(rows);
  }

  async createCampaign(input: {
    advertiserId: number;
    name: string;
    startDate: string;
    endDate: string;
    weight?: number;
    cpm?: number;
    dayTarget?: string;
    startMin?: number | null;
    endMin?: number | null;
  }): Promise<{ id: number }> {
    const db = this.db();
    const adv = await db.query.cretaAdvertiser.findFirst({
      where: eq(cretaAdvertiser.id, Number(input.advertiserId)),
      columns: { id: true },
    });
    if (!adv) throw new HttpError(404, "광고주를 찾을 수 없습니다.");
    const name = assertName(input.name, "캠페인 이름");
    const startDate = assertDate(input.startDate, "시작일");
    const endDate = assertDate(input.endDate, "종료일");
    if (endDate < startDate) {
      throw new HttpError(400, "종료일은 시작일 이후여야 합니다.");
    }
    const weight = Number(input.weight ?? 1);
    if (
      !Number.isInteger(weight) ||
      weight < WEIGHT_MIN ||
      weight > WEIGHT_MAX
    ) {
      throw new HttpError(
        400,
        `가중치는 ${WEIGHT_MIN}~${WEIGHT_MAX} 사이 정수여야 합니다.`,
      );
    }
    const cpm = Number(input.cpm ?? 0);
    if (!Number.isInteger(cpm) || cpm < 0 || cpm > CPM_MAX) {
      throw new HttpError(400, "CPM 단가가 올바르지 않습니다.");
    }
    const daypart = assertDaypart(input);
    const [row] = await db
      .insert(cretaAdCampaign)
      .values({
        advertiserId: adv.id,
        name,
        startDate,
        endDate,
        weight,
        cpm,
        dayTarget: daypart.dayTarget ?? "all",
        startMin: daypart.startMin ?? null,
        endMin: daypart.endMin ?? null,
      })
      .returning({ id: cretaAdCampaign.id });
    if (!row) throw new HttpError(500, "캠페인 생성에 실패했습니다.");
    return row;
  }

  async updateCampaign(
    id: number,
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
    },
  ): Promise<void> {
    const set: Partial<typeof cretaAdCampaign.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name != null) set.name = assertName(input.name, "캠페인 이름");
    if (input.status != null) {
      if (input.status !== "live" && input.status !== "paused") {
        throw new HttpError(400, "상태는 live 또는 paused여야 합니다.");
      }
      set.status = input.status;
    }
    if (input.startDate != null) {
      set.startDate = assertDate(input.startDate, "시작일");
    }
    if (input.endDate != null)
      set.endDate = assertDate(input.endDate, "종료일");
    if (input.weight != null) {
      const weight = Number(input.weight);
      if (
        !Number.isInteger(weight) ||
        weight < WEIGHT_MIN ||
        weight > WEIGHT_MAX
      ) {
        throw new HttpError(
          400,
          `가중치는 ${WEIGHT_MIN}~${WEIGHT_MAX} 사이 정수여야 합니다.`,
        );
      }
      set.weight = weight;
    }
    if (input.cpm != null) {
      const cpm = Number(input.cpm);
      if (!Number.isInteger(cpm) || cpm < 0 || cpm > CPM_MAX) {
        throw new HttpError(400, "CPM 단가가 올바르지 않습니다.");
      }
      set.cpm = cpm;
    }
    const daypart = assertDaypart(input);
    if (daypart.dayTarget != null) set.dayTarget = daypart.dayTarget;
    if (daypart.startMin !== undefined) set.startMin = daypart.startMin;
    if (daypart.endMin !== undefined) set.endMin = daypart.endMin;
    const updated = await this.db()
      .update(cretaAdCampaign)
      .set(set)
      .where(eq(cretaAdCampaign.id, id))
      .returning({ id: cretaAdCampaign.id });
    if (updated.length === 0) {
      throw new HttpError(404, "캠페인을 찾을 수 없습니다.");
    }
  }

  async removeCampaign(id: number): Promise<void> {
    const deleted = await this.db()
      .delete(cretaAdCampaign)
      .where(eq(cretaAdCampaign.id, id))
      .returning({ id: cretaAdCampaign.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "캠페인을 찾을 수 없습니다.");
    }
  }

  // ── 소재 ────────────────────────────────────────────────

  async addCreative(input: {
    campaignId: number;
    name: string;
    kind: string;
    src: string;
  }): Promise<{ id: number }> {
    const db = this.db();
    const campaign = await db.query.cretaAdCampaign.findFirst({
      where: eq(cretaAdCampaign.id, Number(input.campaignId)),
      columns: { id: true },
    });
    if (!campaign) throw new HttpError(404, "캠페인을 찾을 수 없습니다.");
    if (input.kind !== "image" && input.kind !== "video") {
      throw new HttpError(400, "소재 kind는 image 또는 video여야 합니다.");
    }
    const [row] = await db
      .insert(cretaAdCreative)
      .values({
        campaignId: campaign.id,
        name: assertName(input.name, "소재 이름"),
        kind: input.kind,
        src: normalizeAdSrc(input.src),
      })
      .returning({ id: cretaAdCreative.id });
    if (!row) throw new HttpError(500, "소재 등록에 실패했습니다.");
    return row;
  }

  async removeCreative(id: number): Promise<void> {
    const deleted = await this.db()
      .delete(cretaAdCreative)
      .where(eq(cretaAdCreative.id, id))
      .returning({ id: cretaAdCreative.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "소재를 찾을 수 없습니다.");
    }
  }

  // ── 편성(활성 소재)·재생 로그 ────────────────────────────

  /** 지금 편성 대상인 소재 — live 상태 + 오늘이 기간 안인 캠페인의 소재 전부 */
  async listActiveCreatives(): Promise<CretaAdActiveCreative[]> {
    const db = this.db();
    const today = todayStr();
    const campaigns = await db
      .select()
      .from(cretaAdCampaign)
      .where(eq(cretaAdCampaign.status, "live"));
    const now = new Date();
    const dow = now.getDay(); // 0=일 … 6=토
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const inFlight = campaigns.filter((c) => {
      if (!(c.startDate <= today && today <= c.endDate)) return false;
      // 요일 타기팅
      if (c.dayTarget === "weekday" && (dow === 0 || dow === 6)) return false;
      if (c.dayTarget === "weekend" && dow >= 1 && dow <= 5) return false;
      // 시간대 타기팅(분) — 둘 다 지정된 경우만
      if (c.startMin != null && c.endMin != null) {
        if (nowMin < c.startMin || nowMin >= c.endMin) return false;
      }
      return true;
    });
    if (inFlight.length === 0) return [];
    const creatives = await db
      .select()
      .from(cretaAdCreative)
      .where(
        inArray(
          cretaAdCreative.campaignId,
          inFlight.map((c) => c.id),
        ),
      )
      .orderBy(cretaAdCreative.id);
    const byId = new Map(inFlight.map((c) => [c.id, c]));
    return creatives.map((c) => {
      const camp = byId.get(c.campaignId)!;
      return {
        id: c.id,
        campaignId: c.campaignId,
        campaignName: camp.name,
        name: c.name,
        kind: c.kind === "video" ? ("video" as const) : ("image" as const),
        src: c.src,
        weight: camp.weight,
      };
    });
  }

  /** 보기 모드 재생 기록 — 존재하는 소재만, 이름 비정규화 저장 */
  async logPlay(input: {
    creativeId: number;
    bookId?: number | null;
    slotElementId: string;
    durationSec: number;
  }): Promise<void> {
    const db = this.db();
    const creative = await db.query.cretaAdCreative.findFirst({
      where: eq(cretaAdCreative.id, Number(input.creativeId)),
    });
    if (!creative) return; // 삭제된 소재 로그는 무시
    const campaign = await db.query.cretaAdCampaign.findFirst({
      where: eq(cretaAdCampaign.id, creative.campaignId),
      columns: { id: true, name: true },
    });
    const slotElementId = String(input.slotElementId ?? "").slice(0, 80);
    if (!slotElementId) return;
    const durationSec = Number(input.durationSec);
    const dur =
      Number.isInteger(durationSec) && durationSec >= 1 && durationSec <= 600
        ? durationSec
        : 15;
    const bookId = Number(input.bookId);
    await db.insert(cretaAdPlayLog).values({
      campaignId: creative.campaignId,
      campaignName: campaign?.name ?? `#${creative.campaignId}`,
      creativeId: creative.id,
      creativeName: creative.name,
      bookId: Number.isInteger(bookId) && bookId > 0 ? bookId : null,
      slotElementId,
      durationSec: dur,
    });
  }

  // ── 전역 설정(루프 삽입·하우스 광고) ────────────────────

  /** 단일 행 설정 — 없으면 기본값 행을 만들어 반환 */
  async getSetting(): Promise<CretaAdSettingPublic> {
    const db = this.db();
    let row = await db.query.cretaAdSetting.findFirst();
    if (!row) {
      const [created] = await db.insert(cretaAdSetting).values({}).returning();
      row = created;
    }
    return {
      loopEveryN: row?.loopEveryN ?? 0,
      spotSec: row?.spotSec ?? 15,
      houseName: row?.houseName ?? "",
      houseKind: row?.houseKind === "video" ? "video" : "image",
      houseSrc: row?.houseSrc ?? "",
    };
  }

  async updateSetting(input: {
    loopEveryN?: number;
    spotSec?: number;
    houseName?: string;
    houseKind?: string;
    houseSrc?: string;
  }): Promise<CretaAdSettingPublic> {
    await this.getSetting(); // 행 보장
    const set: Partial<typeof cretaAdSetting.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.loopEveryN != null) {
      const n = Number(input.loopEveryN);
      if (!Number.isInteger(n) || n < 0 || n > 20) {
        throw new HttpError(400, "루프 삽입 주기는 0(끔)~20페이지여야 합니다.");
      }
      set.loopEveryN = n;
    }
    if (input.spotSec != null) {
      const n = Number(input.spotSec);
      if (!Number.isInteger(n) || n < 5 || n > 120) {
        throw new HttpError(400, "스팟 길이는 5~120초여야 합니다.");
      }
      set.spotSec = n;
    }
    if (input.houseName != null) {
      set.houseName = String(input.houseName).trim().slice(0, 120);
    }
    if (input.houseKind != null) {
      if (input.houseKind !== "image" && input.houseKind !== "video") {
        throw new HttpError(400, "하우스 소재 kind는 image|video여야 합니다.");
      }
      set.houseKind = input.houseKind;
    }
    if (input.houseSrc != null) {
      const raw = String(input.houseSrc).trim();
      set.houseSrc = raw ? normalizeAdSrc(raw) : "";
    }
    const db = this.db();
    const row = await db.query.cretaAdSetting.findFirst();
    await db
      .update(cretaAdSetting)
      .set(set)
      .where(eq(cretaAdSetting.id, row!.id));
    return this.getSetting();
  }

  /** 시간대(0~23시) 노출 분포 — 최근 days일 */
  async hourlyReport(days = 30): Promise<{ hour: number; plays: number }[]> {
    const db = this.db();
    const d = Math.min(365, Math.max(1, Math.trunc(days)));
    const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        hour: sql<number>`extract(hour from ${cretaAdPlayLog.playedAt})::int`,
        plays: sql<number>`count(*)::int`,
      })
      .from(cretaAdPlayLog)
      .where(and(gte(cretaAdPlayLog.playedAt, since)))
      .groupBy(sql`extract(hour from ${cretaAdPlayLog.playedAt})`)
      .orderBy(sql`extract(hour from ${cretaAdPlayLog.playedAt})`);
    return rows;
  }

  /** 구좌(슬롯)별 노출 집계 — 최근 days일 */
  async slotReport(days = 30): Promise<
    {
      slotElementId: string;
      bookId: number | null;
      plays: number;
      lastPlayedAt: Date | null;
    }[]
  > {
    const db = this.db();
    const d = Math.min(365, Math.max(1, Math.trunc(days)));
    const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    return db
      .select({
        slotElementId: cretaAdPlayLog.slotElementId,
        bookId: cretaAdPlayLog.bookId,
        plays: sql<number>`count(*)::int`,
        lastPlayedAt: sql<Date | null>`max(${cretaAdPlayLog.playedAt})`,
      })
      .from(cretaAdPlayLog)
      .where(and(gte(cretaAdPlayLog.playedAt, since)))
      .groupBy(cretaAdPlayLog.slotElementId, cretaAdPlayLog.bookId)
      .orderBy(desc(sql`count(*)`));
  }

  /** 캠페인별 노출수 집계(기본 리포트) — 최근 days일 */
  async campaignReport(days = 30): Promise<
    {
      campaignId: number;
      campaignName: string;
      plays: number;
      totalSec: number;
      lastPlayedAt: Date | null;
    }[]
  > {
    const db = this.db();
    const d = Math.min(365, Math.max(1, Math.trunc(days)));
    const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        campaignId: cretaAdPlayLog.campaignId,
        campaignName: cretaAdPlayLog.campaignName,
        plays: sql<number>`count(*)::int`,
        totalSec: sql<number>`coalesce(sum(${cretaAdPlayLog.durationSec}), 0)::int`,
        lastPlayedAt: sql<Date | null>`max(${cretaAdPlayLog.playedAt})`,
      })
      .from(cretaAdPlayLog)
      .where(and(gte(cretaAdPlayLog.playedAt, since)))
      .groupBy(cretaAdPlayLog.campaignId, cretaAdPlayLog.campaignName)
      .orderBy(desc(sql`count(*)`));
    return rows;
  }
}
