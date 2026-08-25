// 광고 플랫폼(1단계) 서비스 — 광고주·캠페인·소재 CRUD + 활성 소재 조회(편성) + 재생 로그.
// 편성은 클라이언트(광고 위젯)가 슬롯 길이 공통 클록으로 순환하고, 여기서는
// "지금 활성인 캠페인의 소재 목록(가중치 반영)"과 재생 기록·집계만 책임진다.
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  cretaAdCampaign,
  cretaAdCreative,
  cretaAdPlayLog,
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
  creatives: CretaAdCreativePublic[];
  /** 오늘 기준 기간 안 여부(참고 표시용) */
  inFlight: boolean;
  updatedAt: Date;
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
      inFlight: r.startDate <= today && today <= r.endDate,
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
    const [row] = await db
      .insert(cretaAdCampaign)
      .values({ advertiserId: adv.id, name, startDate, endDate, weight, cpm })
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
    const inFlight = campaigns.filter(
      (c) => c.startDate <= today && today <= c.endDate,
    );
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
