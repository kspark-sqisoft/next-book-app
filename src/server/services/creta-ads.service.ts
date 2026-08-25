// 광고 플랫폼(1단계) 서비스 — 광고주·캠페인·소재 CRUD + 활성 소재 조회(편성) + 재생 로그.
// 편성은 클라이언트(광고 위젯)가 슬롯 길이 공통 클록으로 순환하고, 여기서는
// "지금 활성인 캠페인의 소재 목록(가중치 반영)"과 재생 기록·집계만 책임진다.
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  book as bookTable,
  bookPage,
  cretaAdAuditLog,
  cretaAdCampaign,
  cretaAdCreative,
  cretaAdPlayLog,
  cretaAdSetting,
  cretaAdvertiser,
  cretaDevice,
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
  /** 시간당 재생 상한. null = 무제한 */
  maxPerHour: number | null;
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
  /** 심의 상태 — approved만 편성 투입 */
  status: "pending" | "approved" | "rejected";
};

/** 감사 로그 행 */
export type CretaAdAuditPublic = {
  id: number;
  entityKind: "advertiser" | "campaign" | "creative" | "setting";
  entityName: string;
  action: string;
  detail: string;
  actorName: string;
  createdAt: Date;
};

/** 구좌 인벤토리(판매 가능량) — 광고 위젯이 걸린 북·디바이스·시간당 노출 능력 */
export type CretaAdSlotInventory = {
  bookId: number;
  bookTitle: string;
  slotElementId: string;
  slotName: string;
  slotSec: number;
  /** 이 북을 소스로 재생 중인 디바이스 수(직접 지정 기준) */
  deviceCount: number;
  /** 시간당 노출 능력 = 3600/slotSec × max(1, 디바이스 수) */
  hourlyCapacity: number;
};

/** 감사 로그 행위자(JWT에서 전달) */
export type CretaAdActor = { sub: number; name: string; role: string };

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

/** 시간당 재생 상한 — null/0 = 무제한, 1~600 */
function assertMaxPerHour(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (n === 0) return null;
  if (!Number.isInteger(n) || n < 1 || n > 600) {
    throw new HttpError(
      400,
      "시간당 재생 상한은 1~600(0=무제한)이어야 합니다.",
    );
  }
  return n;
}

export class CretaAdsService {
  private db() {
    return getDb();
  }

  /** 감사 로그 — 실패해도 본 작업을 막지 않는다 */
  private async audit(
    actor: CretaAdActor | null,
    entityKind: CretaAdAuditPublic["entityKind"],
    entityName: string,
    action: string,
    detail = "",
  ): Promise<void> {
    try {
      await this.db()
        .insert(cretaAdAuditLog)
        .values({
          entityKind,
          entityName: entityName.slice(0, 120),
          action: action.slice(0, 16),
          detail: detail.slice(0, 300),
          actorName: (actor?.name || "알 수 없음").slice(0, 80),
        });
    } catch {
      /* 감사 로그 실패는 무시 */
    }
  }

  /** 최근 변경 이력 */
  async listAudit(limit = 30): Promise<CretaAdAuditPublic[]> {
    const rows = await this.db()
      .select()
      .from(cretaAdAuditLog)
      .orderBy(desc(cretaAdAuditLog.id))
      .limit(Math.min(100, Math.max(1, limit)));
    return rows.map((r) => ({
      id: r.id,
      entityKind:
        r.entityKind === "advertiser" ||
        r.entityKind === "campaign" ||
        r.entityKind === "creative"
          ? r.entityKind
          : ("setting" as const),
      entityName: r.entityName,
      action: r.action,
      detail: r.detail,
      actorName: r.actorName,
      createdAt: r.createdAt,
    }));
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
    actor: CretaAdActor,
  ): Promise<{ id: number }> {
    const name = assertName(input.name, "광고주 이름");
    const contact = String(input.contact ?? "")
      .trim()
      .slice(0, 200);
    const [row] = await this.db()
      .insert(cretaAdvertiser)
      .values({ name, contact, ownerId: actor.sub })
      .returning({ id: cretaAdvertiser.id });
    if (!row) throw new HttpError(500, "광고주 등록에 실패했습니다.");
    await this.audit(actor, "advertiser", name, "create", "광고주 등록");
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

  async removeAdvertiser(id: number, actor: CretaAdActor): Promise<void> {
    const deleted = await this.db()
      .delete(cretaAdvertiser)
      .where(eq(cretaAdvertiser.id, id))
      .returning({ id: cretaAdvertiser.id, name: cretaAdvertiser.name });
    if (deleted.length === 0) {
      throw new HttpError(404, "광고주를 찾을 수 없습니다.");
    }
    await this.audit(
      actor,
      "advertiser",
      deleted[0].name,
      "delete",
      "광고주 삭제(소속 캠페인·소재 포함)",
    );
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
          .orderBy(cretaAdCreative.position, cretaAdCreative.id)
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
      maxPerHour: r.maxPerHour ?? null,
      creatives: creatives
        .filter((c) => c.campaignId === r.id)
        .map((c) => ({
          id: c.id,
          campaignId: c.campaignId,
          name: c.name,
          kind: c.kind === "video" ? ("video" as const) : ("image" as const),
          src: c.src,
          status:
            c.status === "pending"
              ? ("pending" as const)
              : c.status === "rejected"
                ? ("rejected" as const)
                : ("approved" as const),
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

  async createCampaign(
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
    },
    actor: CretaAdActor,
  ): Promise<{ id: number }> {
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
    const maxPerHour = assertMaxPerHour(input.maxPerHour);
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
        maxPerHour: maxPerHour ?? null,
      })
      .returning({ id: cretaAdCampaign.id });
    if (!row) throw new HttpError(500, "캠페인 생성에 실패했습니다.");
    await this.audit(
      actor,
      "campaign",
      name,
      "create",
      `기간 ${startDate}~${endDate} · 가중치 ${weight}`,
    );
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
      maxPerHour?: number | null;
    },
    actor: CretaAdActor,
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
    if (input.maxPerHour !== undefined) {
      set.maxPerHour = assertMaxPerHour(input.maxPerHour) ?? null;
    }
    const updated = await this.db()
      .update(cretaAdCampaign)
      .set(set)
      .where(eq(cretaAdCampaign.id, id))
      .returning({ id: cretaAdCampaign.id, name: cretaAdCampaign.name });
    if (updated.length === 0) {
      throw new HttpError(404, "캠페인을 찾을 수 없습니다.");
    }
    await this.audit(
      actor,
      "campaign",
      updated[0].name,
      "update",
      input.status != null
        ? input.status === "paused"
          ? "일시중지"
          : "라이브 전환"
        : "캠페인 설정 변경",
    );
  }

  async removeCampaign(id: number, actor: CretaAdActor): Promise<void> {
    const deleted = await this.db()
      .delete(cretaAdCampaign)
      .where(eq(cretaAdCampaign.id, id))
      .returning({ id: cretaAdCampaign.id, name: cretaAdCampaign.name });
    if (deleted.length === 0) {
      throw new HttpError(404, "캠페인을 찾을 수 없습니다.");
    }
    await this.audit(
      actor,
      "campaign",
      deleted[0].name,
      "delete",
      "캠페인 삭제",
    );
  }

  // ── 소재 ────────────────────────────────────────────────

  async addCreative(
    input: {
      campaignId: number;
      name: string;
      kind: string;
      src: string;
    },
    actor: CretaAdActor,
  ): Promise<{ id: number }> {
    const db = this.db();
    const campaign = await db.query.cretaAdCampaign.findFirst({
      where: eq(cretaAdCampaign.id, Number(input.campaignId)),
      columns: { id: true },
    });
    if (!campaign) throw new HttpError(404, "캠페인을 찾을 수 없습니다.");
    if (input.kind !== "image" && input.kind !== "video") {
      throw new HttpError(400, "소재 kind는 image 또는 video여야 합니다.");
    }
    // 심의: 관리자가 올리면 즉시 승인, 일반 사용자는 관리자 승인 후 편성 투입
    const status = actor.role === "admin" ? "approved" : "pending";
    const name = assertName(input.name, "소재 이름");
    const [{ maxPos }] = await db
      .select({
        maxPos: sql<number>`coalesce(max(${cretaAdCreative.position}), 0)::int`,
      })
      .from(cretaAdCreative)
      .where(eq(cretaAdCreative.campaignId, campaign.id));
    const [row] = await db
      .insert(cretaAdCreative)
      .values({
        campaignId: campaign.id,
        name,
        kind: input.kind,
        src: normalizeAdSrc(input.src),
        status,
        position: maxPos + 1,
      })
      .returning({ id: cretaAdCreative.id });
    if (!row) throw new HttpError(500, "소재 등록에 실패했습니다.");
    await this.audit(
      actor,
      "creative",
      name,
      "create",
      status === "approved"
        ? "소재 등록(관리자 즉시 승인)"
        : "소재 등록 — 심의 대기",
    );
    return row;
  }

  /** 소재 순서 이동 — 같은 캠페인 안에서 앞/뒤 소재와 자리를 바꾼다 */
  async moveCreative(
    id: number,
    direction: -1 | 1,
    actor: CretaAdActor,
  ): Promise<void> {
    const db = this.db();
    const target = await db.query.cretaAdCreative.findFirst({
      where: eq(cretaAdCreative.id, id),
    });
    if (!target) throw new HttpError(404, "소재를 찾을 수 없습니다.");
    const siblings = await db
      .select()
      .from(cretaAdCreative)
      .where(eq(cretaAdCreative.campaignId, target.campaignId))
      .orderBy(cretaAdCreative.position, cretaAdCreative.id);
    const idx = siblings.findIndex((c) => c.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    // 같은 position 값(레거시 0 등) 대비 — 정렬 인덱스 기준으로 재부여
    await db.transaction(async (tx) => {
      await tx
        .update(cretaAdCreative)
        .set({ position: swapIdx + 1 })
        .where(eq(cretaAdCreative.id, target.id));
      await tx
        .update(cretaAdCreative)
        .set({ position: idx + 1 })
        .where(eq(cretaAdCreative.id, other.id));
    });
    await this.audit(
      actor,
      "creative",
      target.name,
      "update",
      direction === -1 ? "순서 앞으로" : "순서 뒤로",
    );
  }

  /** 소재 심의(관리자 전용) — 승인하면 편성 투입, 반려하면 제외 */
  async reviewCreative(
    id: number,
    decision: "approved" | "rejected",
    actor: CretaAdActor,
  ): Promise<void> {
    if (actor.role !== "admin") {
      throw new HttpError(403, "소재 심의는 관리자만 할 수 있습니다.");
    }
    if (decision !== "approved" && decision !== "rejected") {
      throw new HttpError(400, "심의 결과는 approved|rejected여야 합니다.");
    }
    const updated = await this.db()
      .update(cretaAdCreative)
      .set({ status: decision })
      .where(eq(cretaAdCreative.id, id))
      .returning({ id: cretaAdCreative.id, name: cretaAdCreative.name });
    if (updated.length === 0) {
      throw new HttpError(404, "소재를 찾을 수 없습니다.");
    }
    await this.audit(
      actor,
      "creative",
      updated[0].name,
      decision === "approved" ? "approve" : "reject",
      decision === "approved" ? "심의 승인 — 편성 투입" : "심의 반려",
    );
  }

  async removeCreative(id: number, actor: CretaAdActor): Promise<void> {
    const deleted = await this.db()
      .delete(cretaAdCreative)
      .where(eq(cretaAdCreative.id, id))
      .returning({ id: cretaAdCreative.id, name: cretaAdCreative.name });
    if (deleted.length === 0) {
      throw new HttpError(404, "소재를 찾을 수 없습니다.");
    }
    await this.audit(actor, "creative", deleted[0].name, "delete", "소재 삭제");
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
    // 시간당 재생 상한 — 최근 1시간 노출수가 상한 이상인 캠페인은 이번 편성에서 제외
    const capped = inFlight.filter((c) => c.maxPerHour != null);
    let hourlyPlays = new Map<number, number>();
    if (capped.length > 0) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const rows = await db
        .select({
          campaignId: cretaAdPlayLog.campaignId,
          plays: sql<number>`count(*)::int`,
        })
        .from(cretaAdPlayLog)
        .where(
          and(
            gte(cretaAdPlayLog.playedAt, hourAgo),
            inArray(
              cretaAdPlayLog.campaignId,
              capped.map((c) => c.id),
            ),
          ),
        )
        .groupBy(cretaAdPlayLog.campaignId);
      hourlyPlays = new Map(rows.map((r) => [r.campaignId, r.plays]));
    }
    const eligible = inFlight.filter(
      (c) =>
        c.maxPerHour == null || (hourlyPlays.get(c.id) ?? 0) < c.maxPerHour,
    );
    if (eligible.length === 0) return [];
    const creatives = await db
      .select()
      .from(cretaAdCreative)
      .where(
        and(
          inArray(
            cretaAdCreative.campaignId,
            eligible.map((c) => c.id),
          ),
          // 심의 승인된 소재만 편성 투입
          eq(cretaAdCreative.status, "approved"),
        ),
      )
      .orderBy(cretaAdCreative.position, cretaAdCreative.id);
    const byId = new Map(eligible.map((c) => [c.id, c]));
    return creatives.map((c) => {
      const camp = byId.get(c.campaignId)!;
      return {
        id: c.id,
        campaignId: c.campaignId,
        campaignName: camp.name,
        name: c.name,
        kind: c.kind === "video" ? ("video" as const) : ("image" as const),
        src: c.src,
        status: "approved" as const,
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

  async updateSetting(
    input: {
      loopEveryN?: number;
      spotSec?: number;
      houseName?: string;
      houseKind?: string;
      houseSrc?: string;
    },
    actor: CretaAdActor,
  ): Promise<CretaAdSettingPublic> {
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
    await this.audit(
      actor,
      "setting",
      "광고 전역 설정",
      "update",
      "루프 삽입·하우스 광고 설정 변경",
    );
    return this.getSetting();
  }

  /**
   * 구좌 인벤토리(판매 가능량) — 모든 북 페이지에서 광고 위젯을 찾아
   * 슬롯 길이·연결 디바이스 수·시간당 노출 능력을 계산한다.
   */
  async slotInventory(): Promise<CretaAdSlotInventory[]> {
    const db = this.db();
    const pages = await db
      .select({
        bookId: bookPage.bookId,
        elementsJson: bookPage.elementsJson,
      })
      .from(bookPage);
    type SlotHit = {
      bookId: number;
      slotElementId: string;
      slotName: string;
      slotSec: number;
    };
    const hits: SlotHit[] = [];
    for (const pg of pages) {
      let els: unknown;
      try {
        els = JSON.parse(pg.elementsJson);
      } catch {
        continue;
      }
      if (!Array.isArray(els)) continue;
      for (const el of els) {
        if (!el || typeof el !== "object") continue;
        const o = el as Record<string, unknown>;
        if (o.type !== "adSlot" || typeof o.id !== "string") continue;
        const sec =
          typeof o.adSlotSec === "number" &&
          Number.isInteger(o.adSlotSec) &&
          o.adSlotSec >= 5 &&
          o.adSlotSec <= 120
            ? o.adSlotSec
            : 15;
        hits.push({
          bookId: pg.bookId,
          slotElementId: o.id,
          slotName:
            typeof o.adSlotName === "string" && o.adSlotName.trim()
              ? o.adSlotName.trim().slice(0, 80)
              : "이름 없는 구좌",
          slotSec: sec,
        });
      }
    }
    if (hits.length === 0) return [];
    const bookIds = [...new Set(hits.map((h) => h.bookId))];
    const books = await db
      .select({ id: bookTable.id, title: bookTable.title })
      .from(bookTable)
      .where(inArray(bookTable.id, bookIds));
    const titleMap = new Map(books.map((b) => [b.id, b.title]));
    // 이 북을 직접 소스로 재생 중인 디바이스 수(플레이리스트·스케줄 경유는 제외 — 단순 계산)
    const devices = await db
      .select({ sourceBookId: cretaDevice.sourceBookId })
      .from(cretaDevice)
      .where(eq(cretaDevice.sourceType, "book"));
    const deviceCount = new Map<number, number>();
    for (const d of devices) {
      if (d.sourceBookId == null) continue;
      deviceCount.set(
        d.sourceBookId,
        (deviceCount.get(d.sourceBookId) ?? 0) + 1,
      );
    }
    return hits.map((h) => {
      const devs = deviceCount.get(h.bookId) ?? 0;
      return {
        ...h,
        bookTitle: titleMap.get(h.bookId) ?? `북 #${h.bookId}`,
        deviceCount: devs,
        hourlyCapacity: Math.floor((3600 / h.slotSec) * Math.max(1, devs)),
      };
    });
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
