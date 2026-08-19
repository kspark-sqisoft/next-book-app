// 크레타 사이니지 도메인 서비스: 플레이리스트·스케줄·디바이스 CRUD와
// 썸네일(북 첫 페이지 커버) 해석. 디바이스의 IP·플레이어 버전 등은 시뮬레이션 파생값.
import { asc, count, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  book as bookTable,
  bookPage,
  cretaDevice,
  cretaPlaylist,
  cretaPlaylistItem,
  cretaSchedule,
  cretaScheduleSlot,
} from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";
import type {
  BookCanvasElementPublic,
  BookListCoverPreviewPublic,
} from "@/server/services/books.service";

export type CretaCoverPublic = BookListCoverPreviewPublic | null;

/** 북/플레이리스트/스케줄을 가리키는 공통 참조(썸네일 포함) */
export type CretaContentRefPublic = {
  kind: "book" | "playlist" | "schedule";
  id: number;
  title: string;
  cover: CretaCoverPublic;
};

export type CretaPlaylistListItemPublic = {
  id: number;
  name: string;
  description: string;
  loop: boolean;
  visibility: string;
  itemCount: number;
  /** 대표 썸네일 = 첫 북의 커버 */
  cover: CretaCoverPublic;
  updatedAt: Date;
};

export type CretaPlaylistItemPublic = {
  itemId: number;
  bookId: number;
  title: string;
  pageCount: number;
  cover: CretaCoverPublic;
};

export type CretaPlaylistDetailPublic = {
  id: number;
  name: string;
  description: string;
  loop: boolean;
  visibility: string;
  items: CretaPlaylistItemPublic[];
};

export type CretaSlotRepeat =
  | "once"
  | "daily"
  | "weekday"
  | "weekend"
  | "range";

/** 시간대 생성·수정 공통 입력 */
export type CretaSlotInput = {
  startMin: number;
  endMin: number;
  sourceType: "book" | "playlist";
  bookId?: number;
  playlistId?: number;
  repeat?: CretaSlotRepeat;
  repeatStart?: string | null;
  repeatEnd?: string | null;
};

export type CretaScheduleSlotPublic = {
  id: number;
  startMin: number;
  endMin: number;
  repeat: CretaSlotRepeat;
  repeatStart: string | null;
  repeatEnd: string | null;
  content: CretaContentRefPublic | null;
};

export type CretaScheduleListItemPublic = {
  id: number;
  name: string;
  slotCount: number;
  autoApply: boolean;
  defaultContent: CretaContentRefPublic | null;
  appliedDeviceNames: string[];
};

export type CretaScheduleDetailPublic = {
  id: number;
  name: string;
  autoApply: boolean;
  defaultContent: CretaContentRefPublic | null;
  slots: CretaScheduleSlotPublic[];
  appliedDevices: { id: number; name: string }[];
};

export type CretaDevicePublic = {
  id: number;
  name: string;
  location: string;
  platform: string;
  resolution: string;
  orientation: string;
  online: boolean;
  source: CretaContentRefPublic | null;
  createdAt: Date;
};

const NAME_MAX = 120;

/** [aStart,aEnd) 와 [bStart,bEnd) 가 겹치는지 */
export function cretaRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function assertName(raw: unknown, label: string): string {
  const name = String(raw ?? "").trim();
  if (!name) throw new HttpError(400, `${label}을(를) 입력해 주세요.`);
  if (name.length > NAME_MAX)
    throw new HttpError(400, `${label}은(는) ${NAME_MAX}자 이하여야 합니다.`);
  return name;
}

const SLOT_REPEATS: CretaSlotRepeat[] = [
  "once",
  "daily",
  "weekday",
  "weekend",
  "range",
];

export class CretaService {
  private db() {
    return getDb();
  }

  // ── 썸네일·참조 해석 ──────────────────────────────────────────────

  /** 북 id들의 첫 페이지 커버(느슨한 파싱 — 손상 데이터는 빈 요소로) */
  private async coversByBookIds(
    ids: number[],
  ): Promise<Map<number, CretaCoverPublic>> {
    const map = new Map<number, CretaCoverPublic>();
    const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (uniq.length === 0) return map;
    const db = this.db();
    const books = await db
      .select({
        id: bookTable.id,
        slideWidth: bookTable.slideWidth,
        slideHeight: bookTable.slideHeight,
      })
      .from(bookTable)
      .where(inArray(bookTable.id, uniq));
    const pages = await db
      .select({
        bookId: bookPage.bookId,
        elementsJson: bookPage.elementsJson,
        backgroundColor: bookPage.backgroundColor,
      })
      .from(bookPage)
      .where(inArray(bookPage.bookId, uniq))
      .orderBy(asc(bookPage.sortOrder), asc(bookPage.id));
    const firstPage = new Map<
      number,
      { elementsJson: string; backgroundColor: string }
    >();
    for (const p of pages) {
      if (!firstPage.has(p.bookId)) firstPage.set(p.bookId, p);
    }
    for (const b of books) {
      const fp = firstPage.get(b.id);
      if (!fp) {
        map.set(b.id, null);
        continue;
      }
      let elements: BookCanvasElementPublic[] = [];
      try {
        const v = JSON.parse(fp.elementsJson || "[]") as unknown;
        if (Array.isArray(v)) elements = v as BookCanvasElementPublic[];
      } catch {
        elements = [];
      }
      map.set(b.id, {
        slideWidth: b.slideWidth,
        slideHeight: b.slideHeight,
        backgroundColor: fp.backgroundColor?.trim() || "#ffffff",
        elements,
      });
    }
    return map;
  }

  /** 북 참조(제목+커버) */
  private async bookRefs(
    ids: number[],
  ): Promise<Map<number, CretaContentRefPublic>> {
    const map = new Map<number, CretaContentRefPublic>();
    const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (uniq.length === 0) return map;
    const db = this.db();
    const rows = await db
      .select({ id: bookTable.id, title: bookTable.title })
      .from(bookTable)
      .where(inArray(bookTable.id, uniq));
    const covers = await this.coversByBookIds(uniq);
    for (const r of rows) {
      map.set(r.id, {
        kind: "book",
        id: r.id,
        title: r.title,
        cover: covers.get(r.id) ?? null,
      });
    }
    return map;
  }

  /** 플레이리스트 참조(이름 + 첫 북 커버) */
  private async playlistRefs(
    ids: number[],
  ): Promise<Map<number, CretaContentRefPublic>> {
    const map = new Map<number, CretaContentRefPublic>();
    const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (uniq.length === 0) return map;
    const db = this.db();
    const rows = await db
      .select({ id: cretaPlaylist.id, name: cretaPlaylist.name })
      .from(cretaPlaylist)
      .where(inArray(cretaPlaylist.id, uniq));
    const items = await db
      .select({
        playlistId: cretaPlaylistItem.playlistId,
        bookId: cretaPlaylistItem.bookId,
      })
      .from(cretaPlaylistItem)
      .where(inArray(cretaPlaylistItem.playlistId, uniq))
      .orderBy(asc(cretaPlaylistItem.position), asc(cretaPlaylistItem.id));
    const firstBook = new Map<number, number>();
    for (const it of items) {
      if (!firstBook.has(it.playlistId))
        firstBook.set(it.playlistId, it.bookId);
    }
    const covers = await this.coversByBookIds([...firstBook.values()]);
    for (const r of rows) {
      const fb = firstBook.get(r.id);
      map.set(r.id, {
        kind: "playlist",
        id: r.id,
        title: r.name,
        cover: fb ? (covers.get(fb) ?? null) : null,
      });
    }
    return map;
  }

  /** 스케줄 참조(이름 + 기본 재생 콘텐츠의 커버) */
  private async scheduleRefs(
    ids: number[],
  ): Promise<Map<number, CretaContentRefPublic>> {
    const map = new Map<number, CretaContentRefPublic>();
    const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (uniq.length === 0) return map;
    const db = this.db();
    const rows = await db
      .select()
      .from(cretaSchedule)
      .where(inArray(cretaSchedule.id, uniq));
    const bookIds = rows
      .filter((r) => r.defaultSourceType === "book" && r.defaultBookId)
      .map((r) => r.defaultBookId!);
    const playlistIds = rows
      .filter((r) => r.defaultSourceType === "playlist" && r.defaultPlaylistId)
      .map((r) => r.defaultPlaylistId!);
    const [bRefs, pRefs] = await Promise.all([
      this.bookRefs(bookIds),
      this.playlistRefs(playlistIds),
    ]);
    for (const r of rows) {
      let cover: CretaCoverPublic = null;
      if (r.defaultSourceType === "book" && r.defaultBookId) {
        cover = bRefs.get(r.defaultBookId)?.cover ?? null;
      } else if (r.defaultSourceType === "playlist" && r.defaultPlaylistId) {
        cover = pRefs.get(r.defaultPlaylistId)?.cover ?? null;
      }
      map.set(r.id, { kind: "schedule", id: r.id, title: r.name, cover });
    }
    return map;
  }

  /** 스케줄 행의 기본 재생 참조 해석 */
  private async resolveScheduleDefault(row: {
    defaultSourceType: string;
    defaultBookId: number | null;
    defaultPlaylistId: number | null;
  }): Promise<CretaContentRefPublic | null> {
    if (row.defaultSourceType === "book" && row.defaultBookId) {
      const refs = await this.bookRefs([row.defaultBookId]);
      return refs.get(row.defaultBookId) ?? null;
    }
    if (row.defaultSourceType === "playlist" && row.defaultPlaylistId) {
      const refs = await this.playlistRefs([row.defaultPlaylistId]);
      return refs.get(row.defaultPlaylistId) ?? null;
    }
    return null;
  }

  // ── 플레이리스트 ─────────────────────────────────────────────────

  async listPlaylists(): Promise<CretaPlaylistListItemPublic[]> {
    const db = this.db();
    const rows = await db
      .select()
      .from(cretaPlaylist)
      .orderBy(desc(cretaPlaylist.updatedAt));
    const ids = rows.map((r) => r.id);
    const countsMap = new Map<number, number>();
    if (ids.length > 0) {
      const counts = await db
        .select({ playlistId: cretaPlaylistItem.playlistId, n: count() })
        .from(cretaPlaylistItem)
        .where(inArray(cretaPlaylistItem.playlistId, ids))
        .groupBy(cretaPlaylistItem.playlistId);
      for (const c of counts) countsMap.set(c.playlistId, Number(c.n));
    }
    const refs = await this.playlistRefs(ids);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      loop: r.loop,
      visibility: r.visibility,
      itemCount: countsMap.get(r.id) ?? 0,
      cover: refs.get(r.id)?.cover ?? null,
      updatedAt: r.updatedAt,
    }));
  }

  async getPlaylist(id: number): Promise<CretaPlaylistDetailPublic> {
    const db = this.db();
    const row = await db.query.cretaPlaylist.findFirst({
      where: eq(cretaPlaylist.id, id),
    });
    if (!row) throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
    const items = await db
      .select({
        itemId: cretaPlaylistItem.id,
        bookId: cretaPlaylistItem.bookId,
        title: bookTable.title,
      })
      .from(cretaPlaylistItem)
      .innerJoin(bookTable, eq(cretaPlaylistItem.bookId, bookTable.id))
      .where(eq(cretaPlaylistItem.playlistId, id))
      .orderBy(asc(cretaPlaylistItem.position), asc(cretaPlaylistItem.id));
    const bookIds = items.map((it) => it.bookId);
    const covers = await this.coversByBookIds(bookIds);
    const pageCounts = new Map<number, number>();
    if (bookIds.length > 0) {
      const counts = await db
        .select({ bookId: bookPage.bookId, n: count() })
        .from(bookPage)
        .where(inArray(bookPage.bookId, bookIds))
        .groupBy(bookPage.bookId);
      for (const c of counts) pageCounts.set(c.bookId, Number(c.n));
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      loop: row.loop,
      visibility: row.visibility,
      items: items.map((it) => ({
        itemId: it.itemId,
        bookId: it.bookId,
        title: it.title,
        pageCount: pageCounts.get(it.bookId) ?? 0,
        cover: covers.get(it.bookId) ?? null,
      })),
    };
  }

  async createPlaylist(input: {
    name: string;
    description?: string;
    loop?: boolean;
    visibility?: string;
  }): Promise<CretaPlaylistDetailPublic> {
    const name = assertName(input.name, "플레이리스트 이름");
    const description = String(input.description ?? "")
      .trim()
      .slice(0, 300);
    const visibility =
      input.visibility === "멤버 공개" ? "멤버 공개" : "전체 공개";
    const db = this.db();
    const [row] = await db
      .insert(cretaPlaylist)
      .values({
        name,
        description,
        loop: input.loop !== false,
        visibility,
      })
      .returning();
    if (!row) throw new HttpError(500, "플레이리스트 생성에 실패했습니다.");
    return this.getPlaylist(row.id);
  }

  async deletePlaylist(id: number): Promise<void> {
    const db = this.db();
    const deleted = await db
      .delete(cretaPlaylist)
      .where(eq(cretaPlaylist.id, id))
      .returning({ id: cretaPlaylist.id });
    if (deleted.length === 0)
      throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
  }

  async addPlaylistItem(
    playlistId: number,
    bookId: number,
  ): Promise<CretaPlaylistDetailPublic> {
    const db = this.db();
    const playlist = await db.query.cretaPlaylist.findFirst({
      where: eq(cretaPlaylist.id, playlistId),
    });
    if (!playlist) throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
    const book = await db.query.book.findFirst({
      where: eq(bookTable.id, bookId),
    });
    if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");
    const existing = await db
      .select({ position: cretaPlaylistItem.position })
      .from(cretaPlaylistItem)
      .where(eq(cretaPlaylistItem.playlistId, playlistId))
      .orderBy(desc(cretaPlaylistItem.position))
      .limit(1);
    const nextPosition = (existing[0]?.position ?? 0) + 1;
    await db.insert(cretaPlaylistItem).values({
      playlistId,
      bookId,
      position: nextPosition,
    });
    await this.touchPlaylist(playlistId);
    return this.getPlaylist(playlistId);
  }

  async removePlaylistItem(
    playlistId: number,
    itemId: number,
  ): Promise<CretaPlaylistDetailPublic> {
    const db = this.db();
    const deleted = await db
      .delete(cretaPlaylistItem)
      .where(eq(cretaPlaylistItem.id, itemId))
      .returning({ playlistId: cretaPlaylistItem.playlistId });
    if (deleted.length === 0 || deleted[0]!.playlistId !== playlistId)
      throw new HttpError(404, "플레이리스트 항목을 찾을 수 없습니다.");
    await this.touchPlaylist(playlistId);
    return this.getPlaylist(playlistId);
  }

  /** 항목을 위(-1)/아래(+1)로 한 칸 이동 — 인접 항목과 position 교환 */
  async movePlaylistItem(
    playlistId: number,
    itemId: number,
    direction: -1 | 1,
  ): Promise<CretaPlaylistDetailPublic> {
    const db = this.db();
    const items = await db
      .select({
        id: cretaPlaylistItem.id,
        position: cretaPlaylistItem.position,
      })
      .from(cretaPlaylistItem)
      .where(eq(cretaPlaylistItem.playlistId, playlistId))
      .orderBy(asc(cretaPlaylistItem.position), asc(cretaPlaylistItem.id));
    const index = items.findIndex((it) => it.id === itemId);
    if (index < 0)
      throw new HttpError(404, "플레이리스트 항목을 찾을 수 없습니다.");
    const target = index + direction;
    if (target < 0 || target >= items.length)
      return this.getPlaylist(playlistId);
    const a = items[index]!;
    const b = items[target]!;
    // position 값이 같아진 손상 데이터도 복구되도록 정렬 순서 기준으로 재부여
    await db.transaction(async (tx) => {
      await tx
        .update(cretaPlaylistItem)
        .set({ position: b.position })
        .where(eq(cretaPlaylistItem.id, a.id));
      await tx
        .update(cretaPlaylistItem)
        .set({ position: a.position })
        .where(eq(cretaPlaylistItem.id, b.id));
    });
    await this.touchPlaylist(playlistId);
    return this.getPlaylist(playlistId);
  }

  private async touchPlaylist(id: number): Promise<void> {
    await this.db()
      .update(cretaPlaylist)
      .set({ updatedAt: new Date() })
      .where(eq(cretaPlaylist.id, id));
  }

  // ── 스케줄 ───────────────────────────────────────────────────────

  async listSchedules(): Promise<CretaScheduleListItemPublic[]> {
    const db = this.db();
    const rows = await db
      .select()
      .from(cretaSchedule)
      .orderBy(desc(cretaSchedule.updatedAt));
    const ids = rows.map((r) => r.id);
    const slotCounts = new Map<number, number>();
    const deviceNames = new Map<number, string[]>();
    if (ids.length > 0) {
      const counts = await db
        .select({ scheduleId: cretaScheduleSlot.scheduleId, n: count() })
        .from(cretaScheduleSlot)
        .where(inArray(cretaScheduleSlot.scheduleId, ids))
        .groupBy(cretaScheduleSlot.scheduleId);
      for (const c of counts) slotCounts.set(c.scheduleId, Number(c.n));
      const devices = await db
        .select({
          scheduleId: cretaDevice.sourceScheduleId,
          name: cretaDevice.name,
        })
        .from(cretaDevice)
        .where(inArray(cretaDevice.sourceScheduleId, ids));
      for (const d of devices) {
        if (d.scheduleId === null) continue;
        if (!deviceNames.has(d.scheduleId)) deviceNames.set(d.scheduleId, []);
        deviceNames.get(d.scheduleId)!.push(d.name);
      }
    }
    const defaults = await Promise.all(
      rows.map((r) => this.resolveScheduleDefault(r)),
    );
    return rows.map((r, i) => ({
      id: r.id,
      name: r.name,
      slotCount: slotCounts.get(r.id) ?? 0,
      autoApply: r.autoApply,
      defaultContent: defaults[i] ?? null,
      appliedDeviceNames: deviceNames.get(r.id) ?? [],
    }));
  }

  async getSchedule(id: number): Promise<CretaScheduleDetailPublic> {
    const db = this.db();
    const row = await db.query.cretaSchedule.findFirst({
      where: eq(cretaSchedule.id, id),
    });
    if (!row) throw new HttpError(404, "스케줄을 찾을 수 없습니다.");
    const slots = await db
      .select()
      .from(cretaScheduleSlot)
      .where(eq(cretaScheduleSlot.scheduleId, id))
      .orderBy(asc(cretaScheduleSlot.startMin));
    const [bRefs, pRefs] = await Promise.all([
      this.bookRefs(
        slots
          .filter((s) => s.sourceType === "book" && s.bookId)
          .map((s) => s.bookId!),
      ),
      this.playlistRefs(
        slots
          .filter((s) => s.sourceType === "playlist" && s.playlistId)
          .map((s) => s.playlistId!),
      ),
    ]);
    const devices = await db
      .select({ id: cretaDevice.id, name: cretaDevice.name })
      .from(cretaDevice)
      .where(eq(cretaDevice.sourceScheduleId, id));
    return {
      id: row.id,
      name: row.name,
      autoApply: row.autoApply,
      defaultContent: await this.resolveScheduleDefault(row),
      slots: slots.map((s) => ({
        id: s.id,
        startMin: s.startMin,
        endMin: s.endMin,
        repeat: (SLOT_REPEATS.includes(s.repeat as CretaSlotRepeat)
          ? s.repeat
          : "once") as CretaSlotRepeat,
        repeatStart: s.repeatStart,
        repeatEnd: s.repeatEnd,
        content:
          s.sourceType === "book" && s.bookId
            ? (bRefs.get(s.bookId) ?? null)
            : s.sourceType === "playlist" && s.playlistId
              ? (pRefs.get(s.playlistId) ?? null)
              : null,
      })),
      appliedDevices: devices,
    };
  }

  async createSchedule(input: {
    name: string;
  }): Promise<CretaScheduleDetailPublic> {
    const name = assertName(input.name, "스케줄 이름");
    const db = this.db();
    const [row] = await db.insert(cretaSchedule).values({ name }).returning();
    if (!row) throw new HttpError(500, "스케줄 생성에 실패했습니다.");
    return this.getSchedule(row.id);
  }

  async deleteSchedule(id: number): Promise<void> {
    const db = this.db();
    const deleted = await db
      .delete(cretaSchedule)
      .where(eq(cretaSchedule.id, id))
      .returning({ id: cretaSchedule.id });
    if (deleted.length === 0)
      throw new HttpError(404, "스케줄을 찾을 수 없습니다.");
  }

  async updateSchedule(
    id: number,
    patch: {
      autoApply?: boolean;
      defaultSourceType?: "none" | "book" | "playlist";
      defaultBookId?: number | null;
      defaultPlaylistId?: number | null;
    },
  ): Promise<CretaScheduleDetailPublic> {
    const db = this.db();
    const row = await db.query.cretaSchedule.findFirst({
      where: eq(cretaSchedule.id, id),
    });
    if (!row) throw new HttpError(404, "스케줄을 찾을 수 없습니다.");
    const set: Partial<typeof cretaSchedule.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.autoApply !== undefined) set.autoApply = patch.autoApply;
    if (patch.defaultSourceType !== undefined) {
      if (patch.defaultSourceType === "book") {
        const bookId = Number(patch.defaultBookId);
        const book = Number.isFinite(bookId)
          ? await db.query.book.findFirst({ where: eq(bookTable.id, bookId) })
          : null;
        if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");
        set.defaultSourceType = "book";
        set.defaultBookId = bookId;
        set.defaultPlaylistId = null;
      } else if (patch.defaultSourceType === "playlist") {
        const playlistId = Number(patch.defaultPlaylistId);
        const playlist = Number.isFinite(playlistId)
          ? await db.query.cretaPlaylist.findFirst({
              where: eq(cretaPlaylist.id, playlistId),
            })
          : null;
        if (!playlist)
          throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
        set.defaultSourceType = "playlist";
        set.defaultPlaylistId = playlistId;
        set.defaultBookId = null;
      } else {
        set.defaultSourceType = "none";
        set.defaultBookId = null;
        set.defaultPlaylistId = null;
      }
    }
    await db.update(cretaSchedule).set(set).where(eq(cretaSchedule.id, id));
    return this.getSchedule(id);
  }

  /** 시간대 입력 공통 검증(범위·겹침·콘텐츠 존재) — 수정 시 자기 자신은 겹침에서 제외 */
  private async prepareSlotValues(
    scheduleId: number,
    input: CretaSlotInput,
    excludeSlotId?: number,
  ): Promise<{
    startMin: number;
    endMin: number;
    sourceType: "book" | "playlist";
    bookId: number | null;
    playlistId: number | null;
    repeat: CretaSlotRepeat;
    repeatStart: string | null;
    repeatEnd: string | null;
  }> {
    const db = this.db();
    const schedule = await db.query.cretaSchedule.findFirst({
      where: eq(cretaSchedule.id, scheduleId),
    });
    if (!schedule) throw new HttpError(404, "스케줄을 찾을 수 없습니다.");

    const startMin = Math.floor(Number(input.startMin));
    const endMin = Math.floor(Number(input.endMin));
    if (
      !Number.isFinite(startMin) ||
      !Number.isFinite(endMin) ||
      startMin < 0 ||
      endMin > 24 * 60 ||
      startMin >= endMin
    ) {
      throw new HttpError(400, "시작 시각은 종료 시각보다 앞서야 합니다.");
    }

    const existing = await db
      .select({
        id: cretaScheduleSlot.id,
        startMin: cretaScheduleSlot.startMin,
        endMin: cretaScheduleSlot.endMin,
      })
      .from(cretaScheduleSlot)
      .where(eq(cretaScheduleSlot.scheduleId, scheduleId));
    for (const s of existing) {
      if (excludeSlotId !== undefined && s.id === excludeSlotId) continue;
      if (cretaRangesOverlap(startMin, endMin, s.startMin, s.endMin)) {
        throw new HttpError(400, "기존 시간대와 겹칩니다.");
      }
    }

    let bookId: number | null = null;
    let playlistId: number | null = null;
    if (input.sourceType === "book") {
      const id = Number(input.bookId);
      const book = Number.isFinite(id)
        ? await db.query.book.findFirst({ where: eq(bookTable.id, id) })
        : null;
      if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");
      bookId = id;
    } else if (input.sourceType === "playlist") {
      const id = Number(input.playlistId);
      const playlist = Number.isFinite(id)
        ? await db.query.cretaPlaylist.findFirst({
            where: eq(cretaPlaylist.id, id),
          })
        : null;
      if (!playlist)
        throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
      playlistId = id;
    } else {
      throw new HttpError(400, "재생 대상은 크레타북 또는 플레이리스트입니다.");
    }

    const repeat: CretaSlotRepeat = SLOT_REPEATS.includes(
      input.repeat as CretaSlotRepeat,
    )
      ? (input.repeat as CretaSlotRepeat)
      : "once";
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    // "이 날짜만(once)"은 기준일을 repeatStart에 저장(달력에서 해당 날짜에만 표시)
    const repeatStart =
      (repeat === "range" || repeat === "once") &&
      dateRe.test(String(input.repeatStart ?? ""))
        ? String(input.repeatStart)
        : null;
    const repeatEnd =
      repeat === "range" && dateRe.test(String(input.repeatEnd ?? ""))
        ? String(input.repeatEnd)
        : null;

    return {
      startMin,
      endMin,
      sourceType: input.sourceType,
      bookId,
      playlistId,
      repeat,
      repeatStart,
      repeatEnd,
    };
  }

  async addScheduleSlot(
    scheduleId: number,
    input: CretaSlotInput,
  ): Promise<CretaScheduleDetailPublic> {
    const db = this.db();
    const values = await this.prepareSlotValues(scheduleId, input);
    await db.insert(cretaScheduleSlot).values({ scheduleId, ...values });
    await db
      .update(cretaSchedule)
      .set({ updatedAt: new Date() })
      .where(eq(cretaSchedule.id, scheduleId));
    return this.getSchedule(scheduleId);
  }

  /** 지정 시간대 수정(시각·재생 대상·반복) */
  async updateScheduleSlot(
    scheduleId: number,
    slotId: number,
    input: CretaSlotInput,
  ): Promise<CretaScheduleDetailPublic> {
    const db = this.db();
    const slot = await db.query.cretaScheduleSlot.findFirst({
      where: eq(cretaScheduleSlot.id, slotId),
    });
    if (!slot || slot.scheduleId !== scheduleId)
      throw new HttpError(404, "시간대를 찾을 수 없습니다.");
    const values = await this.prepareSlotValues(scheduleId, input, slotId);
    await db
      .update(cretaScheduleSlot)
      .set(values)
      .where(eq(cretaScheduleSlot.id, slotId));
    await db
      .update(cretaSchedule)
      .set({ updatedAt: new Date() })
      .where(eq(cretaSchedule.id, scheduleId));
    return this.getSchedule(scheduleId);
  }

  async removeScheduleSlot(
    scheduleId: number,
    slotId: number,
  ): Promise<CretaScheduleDetailPublic> {
    const db = this.db();
    const deleted = await db
      .delete(cretaScheduleSlot)
      .where(eq(cretaScheduleSlot.id, slotId))
      .returning({ scheduleId: cretaScheduleSlot.scheduleId });
    if (deleted.length === 0 || deleted[0]!.scheduleId !== scheduleId)
      throw new HttpError(404, "시간대를 찾을 수 없습니다.");
    return this.getSchedule(scheduleId);
  }

  // ── 디바이스 ─────────────────────────────────────────────────────

  /** 디바이스 행 → 공개 DTO(재생 소스 참조 해석 포함) */
  private async mapDevices(
    rows: (typeof cretaDevice.$inferSelect)[],
  ): Promise<CretaDevicePublic[]> {
    const [bRefs, pRefs, sRefs] = await Promise.all([
      this.bookRefs(
        rows
          .filter((r) => r.sourceType === "book" && r.sourceBookId)
          .map((r) => r.sourceBookId!),
      ),
      this.playlistRefs(
        rows
          .filter((r) => r.sourceType === "playlist" && r.sourcePlaylistId)
          .map((r) => r.sourcePlaylistId!),
      ),
      this.scheduleRefs(
        rows
          .filter((r) => r.sourceType === "schedule" && r.sourceScheduleId)
          .map((r) => r.sourceScheduleId!),
      ),
    ]);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      platform: r.platform,
      resolution: r.resolution,
      orientation: r.orientation,
      online: r.online,
      source:
        r.sourceType === "book" && r.sourceBookId
          ? (bRefs.get(r.sourceBookId) ?? null)
          : r.sourceType === "playlist" && r.sourcePlaylistId
            ? (pRefs.get(r.sourcePlaylistId) ?? null)
            : r.sourceType === "schedule" && r.sourceScheduleId
              ? (sRefs.get(r.sourceScheduleId) ?? null)
              : null,
      createdAt: r.createdAt,
    }));
  }

  async listDevices(): Promise<CretaDevicePublic[]> {
    const rows = await this.db()
      .select()
      .from(cretaDevice)
      .orderBy(asc(cretaDevice.id));
    return this.mapDevices(rows);
  }

  async getDevice(id: number): Promise<CretaDevicePublic> {
    const row = await this.db().query.cretaDevice.findFirst({
      where: eq(cretaDevice.id, id),
    });
    if (!row) throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    const [device] = await this.mapDevices([row]);
    return device!;
  }

  async createDevice(input: {
    name: string;
    location?: string;
    platform?: string;
    resolution?: string;
    orientation?: string;
  }): Promise<CretaDevicePublic> {
    const name = assertName(input.name, "디바이스 이름");
    const db = this.db();
    const [row] = await db
      .insert(cretaDevice)
      .values({
        name,
        location: String(input.location ?? "")
          .trim()
          .slice(0, 120),
        platform:
          String(input.platform ?? "Windows")
            .trim()
            .slice(0, 40) || "Windows",
        resolution:
          String(input.resolution ?? "1920×1080")
            .trim()
            .slice(0, 20) || "1920×1080",
        orientation: input.orientation === "세로" ? "세로" : "가로",
      })
      .returning();
    if (!row) throw new HttpError(500, "디바이스 등록에 실패했습니다.");
    const [device] = await this.mapDevices([row]);
    return device!;
  }

  async deleteDevice(id: number): Promise<void> {
    const deleted = await this.db()
      .delete(cretaDevice)
      .where(eq(cretaDevice.id, id))
      .returning({ id: cretaDevice.id });
    if (deleted.length === 0)
      throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
  }

  async updateDeviceOnline(
    id: number,
    online: boolean,
  ): Promise<CretaDevicePublic> {
    const db = this.db();
    const updated = await db
      .update(cretaDevice)
      .set({ online, updatedAt: new Date() })
      .where(eq(cretaDevice.id, id))
      .returning({ id: cretaDevice.id });
    if (updated.length === 0)
      throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    return this.getDevice(id);
  }

  /** 디바이스 재생 소스 지정(북/플레이리스트/스케줄/없음) */
  async updateDeviceSource(
    id: number,
    input: {
      type: "none" | "book" | "playlist" | "schedule";
      refId?: number;
    },
  ): Promise<CretaDevicePublic> {
    const db = this.db();
    const row = await db.query.cretaDevice.findFirst({
      where: eq(cretaDevice.id, id),
    });
    if (!row) throw new HttpError(404, "디바이스를 찾을 수 없습니다.");

    const set: Partial<typeof cretaDevice.$inferInsert> = {
      updatedAt: new Date(),
      sourceBookId: null,
      sourcePlaylistId: null,
      sourceScheduleId: null,
      sourceType: "none",
    };
    if (input.type === "book") {
      const refId = Number(input.refId);
      const book = Number.isFinite(refId)
        ? await db.query.book.findFirst({ where: eq(bookTable.id, refId) })
        : null;
      if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");
      set.sourceType = "book";
      set.sourceBookId = refId;
    } else if (input.type === "playlist") {
      const refId = Number(input.refId);
      const playlist = Number.isFinite(refId)
        ? await db.query.cretaPlaylist.findFirst({
            where: eq(cretaPlaylist.id, refId),
          })
        : null;
      if (!playlist)
        throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
      set.sourceType = "playlist";
      set.sourcePlaylistId = refId;
    } else if (input.type === "schedule") {
      const refId = Number(input.refId);
      const schedule = Number.isFinite(refId)
        ? await db.query.cretaSchedule.findFirst({
            where: eq(cretaSchedule.id, refId),
          })
        : null;
      if (!schedule) throw new HttpError(404, "스케줄을 찾을 수 없습니다.");
      set.sourceType = "schedule";
      set.sourceScheduleId = refId;
    }
    await db.update(cretaDevice).set(set).where(eq(cretaDevice.id, id));
    return this.getDevice(id);
  }
}
