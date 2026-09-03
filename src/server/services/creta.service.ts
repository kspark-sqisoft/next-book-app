import "server-only";

// 크레타 사이니지 도메인 서비스: 플레이리스트·스케줄·디바이스 CRUD와
// 썸네일(북 첫 페이지 커버) 해석. 디바이스의 IP·플레이어 버전 등은 시뮬레이션 파생값.
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  type AuthActor,
  canMutateOwnedResource,
  isAdminRole,
} from "@/server/auth/auth-policy";
import { getDb } from "@/server/db";
import {
  book as bookTable,
  bookPage,
  bookShare,
  cretaDevice,
  cretaDeviceTag,
  cretaPlaylist,
  cretaPlaylistItem,
  cretaPlaylistShare,
  cretaSchedule,
  cretaScheduleShare,
  cretaScheduleSlot,
  user as userTable,
} from "@/server/db/schema";
import { AVATARS_SUBDIR } from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import type {
  BookCanvasElementPublic,
  BookListCoverPreviewPublic,
} from "@/server/services/books.service";
import { CretaCommentsService } from "@/server/services/creta-comments.service";
import { CretaLikesService } from "@/server/services/creta-likes.service";

export type CretaCoverPublic = BookListCoverPreviewPublic | null;

/** 플레이어 최신 버전(시뮬레이션) — 이보다 낮으면 상세에 "업데이트" 버튼 표시 */
export const CRETA_PLAYER_LATEST = "v1.2.0";

/** 북/플레이리스트/스케줄/광고 전용을 가리키는 공통 참조(썸네일 포함) */
export type CretaContentRefPublic = {
  kind: "book" | "playlist" | "schedule" | "ad";
  id: number;
  title: string;
  cover: CretaCoverPublic;
  /** 라이브 미리보기용 북(북=자신, 플레이리스트=첫 북, 스케줄=기본 재생의 북) */
  previewBookId?: number | null;
};

/** 소유자(공개 정보). null = 공용 항목 */
export type CretaOwnerPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

/** 공유받은 사용자 요약 */
export type CretaSharedUserPublic = { id: number; name: string };

/** 크레타 > 계정: 항목 한 줄 */
export type CretaOverviewItemPublic = {
  id: number;
  title: string;
  updatedAt: Date;
  /** 소유자 이름(공용이면 null) */
  ownerName: string | null;
  /** 내가 만든 항목일 때 공유한 사람들 이름 */
  sharedWith: string[];
};

export type CretaMyOverviewPublic = {
  user: {
    id: number;
    name: string;
    email: string;
    role: "user" | "admin";
    imageUrl: string | null;
  };
  books: {
    owned: CretaOverviewItemPublic[];
    shared: CretaOverviewItemPublic[];
  };
  playlists: {
    owned: CretaOverviewItemPublic[];
    shared: CretaOverviewItemPublic[];
  };
  schedules: {
    owned: CretaOverviewItemPublic[];
    shared: CretaOverviewItemPublic[];
  };
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
  owner: CretaOwnerPublic | null;
  sharedWith: CretaSharedUserPublic[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
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
  owner: CretaOwnerPublic | null;
  sharedUserIds: number[];
  sharedWith: CretaSharedUserPublic[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
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
  /** 지금(KST) 편성된 시간대의 콘텐츠, 없으면 기본 재생 — 목록 카드 배경용 */
  currentContent: CretaContentRefPublic | null;
  appliedDeviceNames: string[];
  owner: CretaOwnerPublic | null;
  sharedWith: CretaSharedUserPublic[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
};

export type CretaScheduleDetailPublic = {
  id: number;
  name: string;
  autoApply: boolean;
  defaultContent: CretaContentRefPublic | null;
  slots: CretaScheduleSlotPublic[];
  appliedDevices: { id: number; name: string }[];
  owner: CretaOwnerPublic | null;
  sharedUserIds: number[];
  sharedWith: CretaSharedUserPublic[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
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
  /** 태그(정렬됨) — 태그 단위 일괄 배포·필터에 사용 */
  tags: string[];
  /** 원격 제어(시뮬레이션): 볼륨·밝기(0~100), 플레이어 버전 */
  volume: number;
  brightness: number;
  playerVersion: string;
  /** 전원 예약 "HH:MM"(매일). null = 예약 없음 */
  powerOnTime: string | null;
  powerOffTime: string | null;
  /** 전원 예약 제외 요일(0=일…6=토) */
  powerExcludeDays: number[];
  /** 전원 예약 제외 날짜(YYYY-MM-DD, 오름차순) */
  powerExcludeDates: string[];
  /** 단말 상태(시뮬레이션): ok | error */
  health: "ok" | "error";
  createdAt: Date;
};

/** `visibility` 컬럼이 갖는 두 값 중 공개 쪽 — 커뮤니티 갤러리 노출 기준 */
const PLAYLIST_VISIBILITY_PUBLIC = "전체 공개";

const NAME_MAX = 120;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const POWER_EXCLUDE_DATES_MAX = 60;

/** CSV → 요일 배열(0~6, 중복 제거·정렬) */
function parseExcludeDays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 0 && n <= 6) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** CSV → 날짜 배열(YYYY-MM-DD, 중복 제거·정렬) */
function parseExcludeDates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (YMD_RE.test(s)) out.add(s);
  }
  return [...out].sort();
}

function assertExcludeDays(raw: unknown): number[] {
  if (raw == null) return [];
  if (!Array.isArray(raw))
    throw new HttpError(400, "제외 요일 형식이 올바르지 않습니다.");
  const out = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 6)
      throw new HttpError(400, "제외 요일은 0(일)~6(토) 사이여야 합니다.");
    out.add(n);
  }
  if (out.size >= 7)
    throw new HttpError(400, "모든 요일을 제외할 수는 없습니다.");
  return [...out].sort((a, b) => a - b);
}

function assertExcludeDates(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw))
    throw new HttpError(400, "제외 날짜 형식이 올바르지 않습니다.");
  const out = new Set<string>();
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (!YMD_RE.test(s))
      throw new HttpError(400, "제외 날짜는 YYYY-MM-DD 형식이어야 합니다.");
    out.add(s);
  }
  if (out.size > POWER_EXCLUDE_DATES_MAX)
    throw new HttpError(
      400,
      `제외 날짜는 최대 ${POWER_EXCLUDE_DATES_MAX}개까지 지정할 수 있습니다.`,
    );
  return [...out].sort();
}

/** 전원 예약 시각 — "HH:MM" 또는 null(해제). 그 외는 400 */
function assertPowerTime(raw: unknown, label: string): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!HHMM_RE.test(s)) {
    throw new HttpError(400, `${label}은(는) HH:MM 형식이어야 합니다.`);
  }
  return s;
}

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

/** 서버 시간대와 무관하게 한국 시각 기준(스케줄 분 단위는 현장 시각 의미) */
type KstNow = { minutes: number; weekday: number; iso: string };
function kstNow(): KstNow {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    iso: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
  };
}

/** 반복 규칙·시각 범위상 지금 이 시간대가 편성 중인지 */
function slotAppliesNow(
  s: {
    startMin: number;
    endMin: number;
    repeat: string;
    repeatStart: string | null;
    repeatEnd: string | null;
  },
  now: KstNow,
): boolean {
  if (!(s.startMin <= now.minutes && now.minutes < s.endMin)) return false;
  switch (s.repeat) {
    case "daily":
      return true;
    case "weekday":
      return now.weekday >= 1 && now.weekday <= 5;
    case "weekend":
      return now.weekday === 0 || now.weekday === 6;
    case "range":
      return Boolean(
        s.repeatStart &&
        s.repeatEnd &&
        s.repeatStart <= now.iso &&
        now.iso <= s.repeatEnd,
      );
    default:
      // once: 날짜가 지정돼 있으면 그날만, 없으면 매일로 간주
      return s.repeatStart ? s.repeatStart === now.iso : true;
  }
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
        previewBookId: r.id,
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
        previewBookId: fb ?? null,
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
      let previewBookId: number | null = null;
      if (r.defaultSourceType === "book" && r.defaultBookId) {
        cover = bRefs.get(r.defaultBookId)?.cover ?? null;
        previewBookId = r.defaultBookId;
      } else if (r.defaultSourceType === "playlist" && r.defaultPlaylistId) {
        const p = pRefs.get(r.defaultPlaylistId);
        cover = p?.cover ?? null;
        previewBookId = p?.previewBookId ?? null;
      }
      map.set(r.id, {
        kind: "schedule",
        id: r.id,
        title: r.name,
        cover,
        previewBookId,
      });
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

  /**
   * `publicOnly`는 커뮤니티 갤러리(비로그인 접근)용 — 북의 `publishedOnly`와 같은 역할이다.
   * 이 필터가 없으면 "멤버 공개" 플레이리스트까지 갤러리에 노출된다.
   */
  async listPlaylists(opts?: {
    publicOnly?: boolean;
  }): Promise<CretaPlaylistListItemPublic[]> {
    const db = this.db();
    const rows = await db
      .select()
      .from(cretaPlaylist)
      .where(
        opts?.publicOnly
          ? eq(cretaPlaylist.visibility, PLAYLIST_VISIBILITY_PUBLIC)
          : undefined,
      )
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
    const [owners, shares] = await Promise.all([
      this.ownerRefs(rows.map((r) => r.ownerId)),
      this.sharesFor("playlist", ids),
    ]);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      loop: r.loop,
      visibility: r.visibility,
      itemCount: countsMap.get(r.id) ?? 0,
      cover: refs.get(r.id)?.cover ?? null,
      updatedAt: r.updatedAt,
      owner: r.ownerId != null ? (owners.get(r.ownerId) ?? null) : null,
      sharedWith: shares.get(r.id) ?? [],
      sharedToAll: r.sharedToAll === true,
    }));
  }

  // ── 소유자·공유 ───────────────────────────────────────────────────

  /** 사용자 id → 소유자 공개 정보 */
  private async ownerRefs(
    ids: (number | null)[],
  ): Promise<Map<number, CretaOwnerPublic>> {
    const map = new Map<number, CretaOwnerPublic>();
    const uniq = [...new Set(ids.filter((n): n is number => n != null))];
    if (uniq.length === 0) return map;
    const rows = await this.db()
      .select({
        id: userTable.id,
        name: userTable.name,
        profileImageFilename: userTable.profileImageFilename,
      })
      .from(userTable)
      .where(inArray(userTable.id, uniq));
    for (const u of rows) {
      map.set(u.id, {
        id: u.id,
        name: u.name,
        imageUrl: u.profileImageFilename
          ? `/uploads/${AVATARS_SUBDIR}/${u.profileImageFilename}`
          : null,
      });
    }
    return map;
  }

  /** 항목 id → 공유받은 사용자 목록(공유 순) */
  private async sharesFor(
    kind: "playlist" | "schedule",
    ids: number[],
  ): Promise<Map<number, CretaSharedUserPublic[]>> {
    const map = new Map<number, CretaSharedUserPublic[]>();
    if (ids.length === 0) return map;
    const db = this.db();
    const rows =
      kind === "playlist"
        ? await db
            .select({
              targetId: cretaPlaylistShare.playlistId,
              userId: userTable.id,
              name: userTable.name,
            })
            .from(cretaPlaylistShare)
            .innerJoin(userTable, eq(userTable.id, cretaPlaylistShare.userId))
            .where(inArray(cretaPlaylistShare.playlistId, ids))
            .orderBy(asc(cretaPlaylistShare.id))
        : await db
            .select({
              targetId: cretaScheduleShare.scheduleId,
              userId: userTable.id,
              name: userTable.name,
            })
            .from(cretaScheduleShare)
            .innerJoin(userTable, eq(userTable.id, cretaScheduleShare.userId))
            .where(inArray(cretaScheduleShare.scheduleId, ids))
            .orderBy(asc(cretaScheduleShare.id));
    for (const r of rows) {
      const list = map.get(r.targetId) ?? [];
      list.push({ id: r.userId, name: r.name });
      map.set(r.targetId, list);
    }
    return map;
  }

  /**
   * 편집 권한: 소유자 없음(공용) = 로그인 사용자 누구나, 그 외 소유자·관리자·공유받은 사용자.
   * 404/403은 호출부 메시지로 통일하기 위해 label을 받는다.
   */
  private async assertCanEdit(
    kind: "playlist" | "schedule",
    actor: AuthActor,
    id: number,
    label: string,
  ): Promise<{ ownerId: number | null }> {
    const db = this.db();
    const row =
      kind === "playlist"
        ? await db.query.cretaPlaylist.findFirst({
            where: eq(cretaPlaylist.id, id),
            columns: { ownerId: true, sharedToAll: true },
          })
        : await db.query.cretaSchedule.findFirst({
            where: eq(cretaSchedule.id, id),
            columns: { ownerId: true, sharedToAll: true },
          });
    if (!row) throw new HttpError(404, `${label}을(를) 찾을 수 없습니다.`);
    if (row.ownerId == null) return row; // 공용
    if (row.sharedToAll === true) return row; // 모든 사용자 공유
    if (canMutateOwnedResource(actor, row.ownerId)) return row;
    const shared =
      kind === "playlist"
        ? await db.query.cretaPlaylistShare.findFirst({
            where: and(
              eq(cretaPlaylistShare.playlistId, id),
              eq(cretaPlaylistShare.userId, actor.id),
            ),
            columns: { id: true },
          })
        : await db.query.cretaScheduleShare.findFirst({
            where: and(
              eq(cretaScheduleShare.scheduleId, id),
              eq(cretaScheduleShare.userId, actor.id),
            ),
            columns: { id: true },
          });
    if (!shared)
      throw new HttpError(
        403,
        `${label} 편집 권한이 없습니다. 소유자에게 공유를 요청하세요.`,
      );
    return row;
  }

  /** 삭제·공유 관리: 소유자·관리자만. 공용 항목은 관리자만 */
  private async assertCanManage(
    kind: "playlist" | "schedule",
    actor: AuthActor,
    id: number,
    label: string,
  ): Promise<{ ownerId: number | null }> {
    const db = this.db();
    const row =
      kind === "playlist"
        ? await db.query.cretaPlaylist.findFirst({
            where: eq(cretaPlaylist.id, id),
            columns: { ownerId: true },
          })
        : await db.query.cretaSchedule.findFirst({
            where: eq(cretaSchedule.id, id),
            columns: { ownerId: true },
          });
    if (!row) throw new HttpError(404, `${label}을(를) 찾을 수 없습니다.`);
    if (row.ownerId == null) {
      if (!isAdminRole(actor.role))
        throw new HttpError(
          403,
          `공용 ${label}은(는) 관리자만 관리할 수 있습니다.`,
        );
      return row;
    }
    if (!canMutateOwnedResource(actor, row.ownerId))
      throw new HttpError(403, `${label} 소유자·관리자만 할 수 있습니다.`);
    return row;
  }

  private async assertShareTarget(userId: number, ownerId: number | null) {
    if (ownerId != null && userId === ownerId)
      throw new HttpError(400, "소유자에게는 공유할 수 없습니다.");
    const target = await this.db().query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { id: true },
    });
    if (!target) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  }

  async setPlaylistShare(
    id: number,
    actor: AuthActor,
    userId: number,
    shared: boolean,
  ): Promise<CretaPlaylistDetailPublic> {
    const { ownerId } = await this.assertCanManage(
      "playlist",
      actor,
      id,
      "플레이리스트",
    );
    await this.assertShareTarget(userId, ownerId);
    const db = this.db();
    if (shared) {
      await db
        .insert(cretaPlaylistShare)
        .values({ playlistId: id, userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(cretaPlaylistShare)
        .where(
          and(
            eq(cretaPlaylistShare.playlistId, id),
            eq(cretaPlaylistShare.userId, userId),
          ),
        );
    }
    return this.getPlaylist(id);
  }

  /** 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
  async setPlaylistShareAll(
    id: number,
    actor: AuthActor,
    shared: boolean,
  ): Promise<CretaPlaylistDetailPublic> {
    await this.assertCanManage("playlist", actor, id, "플레이리스트");
    await this.db()
      .update(cretaPlaylist)
      .set({ sharedToAll: shared })
      .where(eq(cretaPlaylist.id, id));
    return this.getPlaylist(id);
  }

  /** 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
  async setScheduleShareAll(
    id: number,
    actor: AuthActor,
    shared: boolean,
  ): Promise<CretaScheduleDetailPublic> {
    await this.assertCanManage("schedule", actor, id, "스케줄");
    await this.db()
      .update(cretaSchedule)
      .set({ sharedToAll: shared })
      .where(eq(cretaSchedule.id, id));
    return this.getSchedule(id);
  }

  async setScheduleShare(
    id: number,
    actor: AuthActor,
    userId: number,
    shared: boolean,
  ): Promise<CretaScheduleDetailPublic> {
    const { ownerId } = await this.assertCanManage(
      "schedule",
      actor,
      id,
      "스케줄",
    );
    await this.assertShareTarget(userId, ownerId);
    const db = this.db();
    if (shared) {
      await db
        .insert(cretaScheduleShare)
        .values({ scheduleId: id, userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(cretaScheduleShare)
        .where(
          and(
            eq(cretaScheduleShare.scheduleId, id),
            eq(cretaScheduleShare.userId, userId),
          ),
        );
    }
    return this.getSchedule(id);
  }

  async getPlaylist(
    id: number,
    opts?: { publicOnly?: boolean },
  ): Promise<CretaPlaylistDetailPublic> {
    const db = this.db();
    const row = await db.query.cretaPlaylist.findFirst({
      where: eq(cretaPlaylist.id, id),
    });
    if (!row) throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
    // 비로그인 상세는 전체 공개만 — 존재 여부도 흘리지 않게 404로 통일
    if (opts?.publicOnly && row.visibility !== PLAYLIST_VISIBILITY_PUBLIC) {
      throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
    }
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
    const [owners, shares] = await Promise.all([
      this.ownerRefs([row.ownerId]),
      this.sharesFor("playlist", [id]),
    ]);
    const sharedWith = shares.get(id) ?? [];
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
      owner: row.ownerId != null ? (owners.get(row.ownerId) ?? null) : null,
      sharedUserIds: sharedWith.map((u) => u.id),
      sharedWith,
      sharedToAll: row.sharedToAll === true,
    };
  }

  async createPlaylist(
    input: {
      name: string;
      description?: string;
      loop?: boolean;
      visibility?: string;
    },
    ownerId: number,
  ): Promise<CretaPlaylistDetailPublic> {
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
        ownerId,
      })
      .returning();
    if (!row) throw new HttpError(500, "플레이리스트 생성에 실패했습니다.");
    return this.getPlaylist(row.id);
  }

  async deletePlaylist(id: number, actor: AuthActor): Promise<void> {
    await this.assertCanManage("playlist", actor, id, "플레이리스트");
    const db = this.db();
    const deleted = await db
      .delete(cretaPlaylist)
      .where(eq(cretaPlaylist.id, id))
      .returning({ id: cretaPlaylist.id });
    if (deleted.length === 0)
      throw new HttpError(404, "플레이리스트를 찾을 수 없습니다.");
    await new CretaCommentsService().removeAllForTarget("playlist", id);
    await new CretaLikesService().removeAllForTarget("playlist", id);
  }

  async addPlaylistItem(
    playlistId: number,
    actor: AuthActor,
    bookId: number,
  ): Promise<CretaPlaylistDetailPublic> {
    await this.assertCanEdit("playlist", actor, playlistId, "플레이리스트");
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
    actor: AuthActor,
    itemId: number,
  ): Promise<CretaPlaylistDetailPublic> {
    await this.assertCanEdit("playlist", actor, playlistId, "플레이리스트");
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
    actor: AuthActor,
    itemId: number,
    direction: -1 | 1,
  ): Promise<CretaPlaylistDetailPublic> {
    await this.assertCanEdit("playlist", actor, playlistId, "플레이리스트");
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
    // 지금 이 순간 편성된 시간대의 콘텐츠 — 목록 카드 배경 썸네일용(없으면 기본 재생)
    const currentMap = new Map<number, CretaContentRefPublic | null>();
    if (ids.length > 0) {
      const slotRows = await db
        .select()
        .from(cretaScheduleSlot)
        .where(inArray(cretaScheduleSlot.scheduleId, ids))
        .orderBy(asc(cretaScheduleSlot.startMin), asc(cretaScheduleSlot.id));
      const now = kstNow();
      const active = new Map<number, (typeof slotRows)[number]>();
      for (const s of slotRows) {
        if (active.has(s.scheduleId)) continue;
        if (slotAppliesNow(s, now)) active.set(s.scheduleId, s);
      }
      const activeSlots = [...active.values()];
      const [bRefs, pRefs] = await Promise.all([
        this.bookRefs(
          activeSlots
            .filter((s) => s.sourceType === "book" && s.bookId)
            .map((s) => s.bookId!),
        ),
        this.playlistRefs(
          activeSlots
            .filter((s) => s.sourceType === "playlist" && s.playlistId)
            .map((s) => s.playlistId!),
        ),
      ]);
      for (const [sid, s] of active) {
        currentMap.set(
          sid,
          s.sourceType === "book" && s.bookId
            ? (bRefs.get(s.bookId) ?? null)
            : s.sourceType === "playlist" && s.playlistId
              ? (pRefs.get(s.playlistId) ?? null)
              : null,
        );
      }
    }
    const [defaults, owners, shares] = await Promise.all([
      Promise.all(rows.map((r) => this.resolveScheduleDefault(r))),
      this.ownerRefs(rows.map((r) => r.ownerId)),
      this.sharesFor("schedule", ids),
    ]);
    return rows.map((r, i) => ({
      id: r.id,
      name: r.name,
      slotCount: slotCounts.get(r.id) ?? 0,
      autoApply: r.autoApply,
      defaultContent: defaults[i] ?? null,
      currentContent: currentMap.get(r.id) ?? defaults[i] ?? null,
      appliedDeviceNames: deviceNames.get(r.id) ?? [],
      owner: r.ownerId != null ? (owners.get(r.ownerId) ?? null) : null,
      sharedWith: shares.get(r.id) ?? [],
      sharedToAll: r.sharedToAll === true,
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
    const [owners, shares] = await Promise.all([
      this.ownerRefs([row.ownerId]),
      this.sharesFor("schedule", [id]),
    ]);
    const sharedWith = shares.get(id) ?? [];
    return {
      id: row.id,
      name: row.name,
      autoApply: row.autoApply,
      owner: row.ownerId != null ? (owners.get(row.ownerId) ?? null) : null,
      sharedUserIds: sharedWith.map((u) => u.id),
      sharedWith,
      sharedToAll: row.sharedToAll === true,
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

  async createSchedule(
    input: { name: string },
    ownerId: number,
  ): Promise<CretaScheduleDetailPublic> {
    const name = assertName(input.name, "스케줄 이름");
    const db = this.db();
    const [row] = await db
      .insert(cretaSchedule)
      .values({ name, ownerId })
      .returning();
    if (!row) throw new HttpError(500, "스케줄 생성에 실패했습니다.");
    return this.getSchedule(row.id);
  }

  async deleteSchedule(id: number, actor: AuthActor): Promise<void> {
    await this.assertCanManage("schedule", actor, id, "스케줄");
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
    actor: AuthActor,
    patch: {
      autoApply?: boolean;
      defaultSourceType?: "none" | "book" | "playlist";
      defaultBookId?: number | null;
      defaultPlaylistId?: number | null;
    },
  ): Promise<CretaScheduleDetailPublic> {
    await this.assertCanEdit("schedule", actor, id, "스케줄");
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
    actor: AuthActor,
    input: CretaSlotInput,
  ): Promise<CretaScheduleDetailPublic> {
    await this.assertCanEdit("schedule", actor, scheduleId, "스케줄");
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
    actor: AuthActor,
    slotId: number,
    input: CretaSlotInput,
  ): Promise<CretaScheduleDetailPublic> {
    await this.assertCanEdit("schedule", actor, scheduleId, "스케줄");
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
    actor: AuthActor,
    slotId: number,
  ): Promise<CretaScheduleDetailPublic> {
    await this.assertCanEdit("schedule", actor, scheduleId, "스케줄");
    const db = this.db();
    const deleted = await db
      .delete(cretaScheduleSlot)
      .where(eq(cretaScheduleSlot.id, slotId))
      .returning({ scheduleId: cretaScheduleSlot.scheduleId });
    if (deleted.length === 0 || deleted[0]!.scheduleId !== scheduleId)
      throw new HttpError(404, "시간대를 찾을 수 없습니다.");
    return this.getSchedule(scheduleId);
  }

  // ── 계정 현황(내가 만든/공유받은 항목) ────────────────────────────

  async myOverview(userId: number): Promise<CretaMyOverviewPublic> {
    const db = this.db();
    const me = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImageFilename: true,
      },
    });
    if (!me) throw new HttpError(404, "사용자를 찾을 수 없습니다.");

    const bookSharesTable = bookShare;
    const [
      ownedBooks,
      sharedBooksRows,
      ownedPl,
      sharedPlRows,
      ownedSc,
      sharedScRows,
    ] = await Promise.all([
      db
        .select({
          id: bookTable.id,
          title: bookTable.title,
          updatedAt: bookTable.updatedAt,
        })
        .from(bookTable)
        .where(eq(bookTable.authorId, userId))
        .orderBy(desc(bookTable.updatedAt)),
      db
        .select({
          id: bookTable.id,
          title: bookTable.title,
          updatedAt: bookTable.updatedAt,
          ownerName: userTable.name,
        })
        .from(bookSharesTable)
        .innerJoin(bookTable, eq(bookTable.id, bookSharesTable.bookId))
        .innerJoin(userTable, eq(userTable.id, bookTable.authorId))
        .where(eq(bookSharesTable.userId, userId))
        .orderBy(desc(bookTable.updatedAt)),
      db
        .select({
          id: cretaPlaylist.id,
          title: cretaPlaylist.name,
          updatedAt: cretaPlaylist.updatedAt,
        })
        .from(cretaPlaylist)
        .where(eq(cretaPlaylist.ownerId, userId))
        .orderBy(desc(cretaPlaylist.updatedAt)),
      db
        .select({
          id: cretaPlaylist.id,
          title: cretaPlaylist.name,
          updatedAt: cretaPlaylist.updatedAt,
          ownerName: userTable.name,
        })
        .from(cretaPlaylistShare)
        .innerJoin(
          cretaPlaylist,
          eq(cretaPlaylist.id, cretaPlaylistShare.playlistId),
        )
        .leftJoin(userTable, eq(userTable.id, cretaPlaylist.ownerId))
        .where(eq(cretaPlaylistShare.userId, userId))
        .orderBy(desc(cretaPlaylist.updatedAt)),
      db
        .select({
          id: cretaSchedule.id,
          title: cretaSchedule.name,
          updatedAt: cretaSchedule.updatedAt,
        })
        .from(cretaSchedule)
        .where(eq(cretaSchedule.ownerId, userId))
        .orderBy(desc(cretaSchedule.updatedAt)),
      db
        .select({
          id: cretaSchedule.id,
          title: cretaSchedule.name,
          updatedAt: cretaSchedule.updatedAt,
          ownerName: userTable.name,
        })
        .from(cretaScheduleShare)
        .innerJoin(
          cretaSchedule,
          eq(cretaSchedule.id, cretaScheduleShare.scheduleId),
        )
        .leftJoin(userTable, eq(userTable.id, cretaSchedule.ownerId))
        .where(eq(cretaScheduleShare.userId, userId))
        .orderBy(desc(cretaSchedule.updatedAt)),
    ]);

    // 내가 만든 항목의 공유 대상 이름
    const [bookShareNames, plShareNames, scShareNames] = await Promise.all([
      this.shareNamesForBooks(ownedBooks.map((b) => b.id)),
      this.sharesFor(
        "playlist",
        ownedPl.map((p) => p.id),
      ),
      this.sharesFor(
        "schedule",
        ownedSc.map((s) => s.id),
      ),
    ]);

    const owned = (
      rows: { id: number; title: string; updatedAt: Date }[],
      names: Map<number, CretaSharedUserPublic[]>,
    ): CretaOverviewItemPublic[] =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        updatedAt: r.updatedAt,
        ownerName: me.name,
        sharedWith: (names.get(r.id) ?? []).map((u) => u.name),
      }));
    const shared = (
      rows: {
        id: number;
        title: string;
        updatedAt: Date;
        ownerName: string | null;
      }[],
    ): CretaOverviewItemPublic[] =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        updatedAt: r.updatedAt,
        ownerName: r.ownerName,
        sharedWith: [],
      }));

    return {
      user: {
        id: me.id,
        name: me.name,
        email: me.email,
        role: me.role === "admin" ? "admin" : "user",
        imageUrl: me.profileImageFilename
          ? `/uploads/${AVATARS_SUBDIR}/${me.profileImageFilename}`
          : null,
      },
      books: {
        owned: owned(ownedBooks, bookShareNames),
        shared: shared(sharedBooksRows),
      },
      playlists: {
        owned: owned(ownedPl, plShareNames),
        shared: shared(sharedPlRows),
      },
      schedules: {
        owned: owned(ownedSc, scShareNames),
        shared: shared(sharedScRows),
      },
    };
  }

  private async shareNamesForBooks(
    ids: number[],
  ): Promise<Map<number, CretaSharedUserPublic[]>> {
    const map = new Map<number, CretaSharedUserPublic[]>();
    if (ids.length === 0) return map;
    const rows = await this.db()
      .select({
        targetId: bookShare.bookId,
        userId: userTable.id,
        name: userTable.name,
      })
      .from(bookShare)
      .innerJoin(userTable, eq(userTable.id, bookShare.userId))
      .where(inArray(bookShare.bookId, ids))
      .orderBy(asc(bookShare.id));
    for (const r of rows) {
      const list = map.get(r.targetId) ?? [];
      list.push({ id: r.userId, name: r.name });
      map.set(r.targetId, list);
    }
    return map;
  }

  // ── 디바이스 ─────────────────────────────────────────────────────

  /** 디바이스 행 → 공개 DTO(재생 소스 참조 해석 포함) */
  private async mapDevices(
    rows: (typeof cretaDevice.$inferSelect)[],
  ): Promise<CretaDevicePublic[]> {
    const [bRefs, pRefs, sRefs, tagRows] = await Promise.all([
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
      rows.length > 0
        ? this.db()
            .select({
              deviceId: cretaDeviceTag.deviceId,
              tag: cretaDeviceTag.tag,
            })
            .from(cretaDeviceTag)
            .where(
              inArray(
                cretaDeviceTag.deviceId,
                rows.map((r) => r.id),
              ),
            )
            .orderBy(asc(cretaDeviceTag.tag))
        : Promise.resolve([]),
    ]);
    const tagsByDevice = new Map<number, string[]>();
    for (const t of tagRows) {
      const list = tagsByDevice.get(t.deviceId) ?? [];
      list.push(t.tag);
      tagsByDevice.set(t.deviceId, list);
    }
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
              : r.sourceType === "ad"
                ? {
                    kind: "ad" as const,
                    id: 0,
                    title: "광고 전용 루프",
                    cover: null,
                  }
                : null,
      tags: tagsByDevice.get(r.id) ?? [],
      volume: r.volume ?? 70,
      brightness: r.brightness ?? 80,
      playerVersion: r.playerVersion || "v1.1.0",
      powerOnTime: r.powerOnTime ?? null,
      powerOffTime: r.powerOffTime ?? null,
      powerExcludeDays: parseExcludeDays(r.powerExcludeDays),
      powerExcludeDates: parseExcludeDates(r.powerExcludeDates),
      health: r.health === "error" ? "error" : "ok",
      createdAt: r.createdAt,
    }));
  }

  /** 단말 상태 시뮬레이션(정상/비정상) */
  async updateDeviceHealth(
    id: number,
    health: "ok" | "error",
  ): Promise<CretaDevicePublic> {
    const db = this.db();
    const updated = await db
      .update(cretaDevice)
      .set({
        health: health === "error" ? "error" : "ok",
        updatedAt: new Date(),
      })
      .where(eq(cretaDevice.id, id))
      .returning({ id: cretaDevice.id });
    if (updated.length === 0)
      throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    return this.getDevice(id);
  }

  /** 디바이스 전원 예약(매일 켜짐/꺼짐 시각). 둘 다 null이면 예약 해제 */
  async updateDevicePower(
    id: number,
    input: {
      powerOnTime?: string | null;
      powerOffTime?: string | null;
      powerExcludeDays?: number[] | null;
      powerExcludeDates?: string[] | null;
    },
  ): Promise<CretaDevicePublic> {
    const powerOnTime = assertPowerTime(input.powerOnTime, "켜짐 시각");
    const powerOffTime = assertPowerTime(input.powerOffTime, "꺼짐 시각");
    if (powerOnTime && powerOffTime && powerOnTime === powerOffTime) {
      throw new HttpError(400, "켜짐 시각과 꺼짐 시각이 같을 수 없습니다.");
    }
    const days = assertExcludeDays(input.powerExcludeDays);
    const dates = assertExcludeDates(input.powerExcludeDates);
    const db = this.db();
    const updated = await db
      .update(cretaDevice)
      .set({
        powerOnTime,
        powerOffTime,
        powerExcludeDays: days.length ? days.join(",") : null,
        powerExcludeDates: dates.length ? dates.join(",") : null,
        updatedAt: new Date(),
      })
      .where(eq(cretaDevice.id, id))
      .returning({ id: cretaDevice.id });
    if (updated.length === 0)
      throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    return this.getDevice(id);
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
  /** 재생 소스 입력 검증 → cretaDevice update set (디바이스 단건·태그 일괄 배포 공용) */
  private async buildDeviceSourceSet(input: {
    type: "none" | "book" | "playlist" | "schedule" | "ad";
    refId?: number;
  }): Promise<Partial<typeof cretaDevice.$inferInsert>> {
    const db = this.db();
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
    } else if (input.type === "ad") {
      // 광고 전용 재생 — 활성 캠페인 소재만 100% 루프(참조 id 불필요)
      set.sourceType = "ad";
    }
    return set;
  }

  async updateDeviceSource(
    id: number,
    input: {
      type: "none" | "book" | "playlist" | "schedule" | "ad";
      refId?: number;
    },
  ): Promise<CretaDevicePublic> {
    const db = this.db();
    const row = await db.query.cretaDevice.findFirst({
      where: eq(cretaDevice.id, id),
    });
    if (!row) throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    const set = await this.buildDeviceSourceSet(input);
    await db.update(cretaDevice).set(set).where(eq(cretaDevice.id, id));
    return this.getDevice(id);
  }

  /** 원격 제어(시뮬레이션): 볼륨·밝기 설정(0~100) */
  async updateDeviceControls(
    id: number,
    input: { volume?: number; brightness?: number },
  ): Promise<CretaDevicePublic> {
    const set: Partial<typeof cretaDevice.$inferInsert> = {
      updatedAt: new Date(),
    };
    for (const key of ["volume", "brightness"] as const) {
      const v = input[key];
      if (v == null) continue;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) {
        throw new HttpError(
          400,
          `${key === "volume" ? "볼륨" : "밝기"}은 0~100 사이 정수여야 합니다.`,
        );
      }
      set[key] = v;
    }
    const updated = await this.db()
      .update(cretaDevice)
      .set(set)
      .where(eq(cretaDevice.id, id))
      .returning({ id: cretaDevice.id });
    if (updated.length === 0)
      throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    return this.getDevice(id);
  }

  /** 원격 제어(시뮬레이션): 플레이어를 최신 버전으로 업데이트 */
  async upgradeDevicePlayer(id: number): Promise<CretaDevicePublic> {
    const updated = await this.db()
      .update(cretaDevice)
      .set({ playerVersion: CRETA_PLAYER_LATEST, updatedAt: new Date() })
      .where(eq(cretaDevice.id, id))
      .returning({ id: cretaDevice.id });
    if (updated.length === 0)
      throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    return this.getDevice(id);
  }

  /** 디바이스 태그 설정(전체 교체) — 각 1~40자, 최대 10개, 중복 제거·정렬 */
  async updateDeviceTags(
    id: number,
    tags: unknown,
  ): Promise<CretaDevicePublic> {
    const list = normalizeDeviceTags(tags);
    const db = this.db();
    const row = await db.query.cretaDevice.findFirst({
      where: eq(cretaDevice.id, id),
      columns: { id: true },
    });
    if (!row) throw new HttpError(404, "디바이스를 찾을 수 없습니다.");
    await db.transaction(async (tx) => {
      await tx.delete(cretaDeviceTag).where(eq(cretaDeviceTag.deviceId, id));
      if (list.length > 0) {
        await tx
          .insert(cretaDeviceTag)
          .values(list.map((tag) => ({ deviceId: id, tag })));
      }
    });
    return this.getDevice(id);
  }

  /** 태그 일괄 배포 — 이 태그가 붙은 모든 디바이스의 재생 소스를 한 번에 바꾼다 */
  async assignSourceByTag(
    tag: string,
    input: { type: "book" | "playlist" | "schedule"; refId: number },
  ): Promise<{ count: number; devices: CretaDevicePublic[] }> {
    const t = String(tag ?? "").trim();
    if (!t) throw new HttpError(400, "태그를 선택하세요.");
    const db = this.db();
    const targets = await db
      .select({ deviceId: cretaDeviceTag.deviceId })
      .from(cretaDeviceTag)
      .where(eq(cretaDeviceTag.tag, t));
    const ids = [...new Set(targets.map((r) => r.deviceId))];
    if (ids.length === 0) {
      throw new HttpError(404, "이 태그가 붙은 디바이스가 없습니다.");
    }
    const set = await this.buildDeviceSourceSet(input);
    await db.update(cretaDevice).set(set).where(inArray(cretaDevice.id, ids));
    const rows = await db
      .select()
      .from(cretaDevice)
      .where(inArray(cretaDevice.id, ids))
      .orderBy(asc(cretaDevice.id));
    return { count: rows.length, devices: await this.mapDevices(rows) };
  }
}

/** 태그 입력 정규화 — 빈 값·중복 제거, 길이·개수 제한, 가나다 정렬 */
function normalizeDeviceTags(v: unknown): string[] {
  if (v == null) return [];
  if (!Array.isArray(v)) {
    throw new HttpError(400, "태그는 문자열 배열이어야 합니다.");
  }
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim();
    if (!tag) continue;
    if (tag.length > 40) {
      throw new HttpError(400, "태그는 40자 이하여야 합니다.");
    }
    if (!out.includes(tag)) out.push(tag);
  }
  if (out.length > 10) {
    throw new HttpError(400, "태그는 디바이스당 최대 10개입니다.");
  }
  return out.sort((a, b) => a.localeCompare(b, "ko"));
}
