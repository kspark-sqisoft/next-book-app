// 재생 이력(Proof-of-Play) 서비스 — 실제 플레이어가 없어 재생을 시뮬레이션한다.
// 리포트 조회 시점에 "디바이스가 온라인 + 소스 지정" 상태였던 구간을 지연 적재(backfill)하고,
// 기간별 집계(콘텐츠별·디바이스별·최근 로그)를 돌려준다.
import { count, desc, eq, gte, inArray, lt, max, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  book as bookTable,
  bookPage,
  cretaDevice,
  cretaPlaylist,
  cretaPlaylistItem,
  cretaPlayLog,
  cretaSchedule,
} from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";

/** 리포트 기간(일) — 이 외 값은 400 */
export const PLAY_REPORT_RANGES = [1, 7, 30] as const;
export type PlayReportRange = (typeof PLAY_REPORT_RANGES)[number];

/** 페이지당 기본 재생 초(북 콘텐츠 길이 추정) */
const SEC_PER_PAGE = 8;
/** 광고 전용 루프의 집계 블록(초) — 소재 스팟이 이어지는 구간을 한 덩어리로 본다 */
const AD_LOOP_BLOCK_SEC = 300;
/** 백필 상한 — 마지막 로그가 오래됐어도 최근 48시간만 채운다 */
const BACKFILL_WINDOW_MS = 48 * 3600 * 1000;
/** 디바이스당 1회 백필 최대 행 수(무한 루프 방지) */
const BACKFILL_MAX_ROWS = 1200;
/** 이력 보존 기간(일) — 백필 때 함께 정리 */
const RETENTION_DAYS = 30;
/** 동시 백필 중복 방지용 advisory lock 키 */
const BACKFILL_LOCK_KEY = 731_209_431;

export type CretaPlayReportRow = {
  id: number;
  deviceId: number;
  deviceName: string;
  kind: string;
  title: string;
  startedAt: Date;
  durationSec: number;
};

export type CretaPlayReportPublic = {
  rangeDays: PlayReportRange;
  /** 집계 시각(서버 기준) */
  generatedAt: Date;
  totalPlays: number;
  totalDurationSec: number;
  /** 기간 내 재생이 있었던 디바이스 수 */
  deviceCount: number;
  /** 기간 내 재생된 콘텐츠 수 */
  contentCount: number;
  byContent: {
    kind: string;
    contentId: number | null;
    title: string;
    plays: number;
    durationSec: number;
    lastPlayedAt: Date;
  }[];
  byDevice: {
    deviceId: number;
    deviceName: string;
    plays: number;
    durationSec: number;
    lastPlayedAt: Date;
  }[];
  /** 최근 로그(최신순 50건) */
  recent: CretaPlayReportRow[];
};

/** 결정론적 의사 난수(mulberry32) — 재생 길이·간격에 자연스러운 편차를 준다 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SimContent = {
  kind: "book" | "playlist" | "schedule" | "ad";
  /** 광고 전용 루프는 참조 콘텐츠가 없어 null */
  contentId: number | null;
  title: string;
  /** 반복 1회 길이(초) */
  durationSec: number;
};

export class CretaPlayLogService {
  private db() {
    return getDb();
  }

  async getReport(rangeDays: number): Promise<CretaPlayReportPublic> {
    if (!PLAY_REPORT_RANGES.includes(rangeDays as PlayReportRange)) {
      throw new HttpError(400, "리포트 기간은 1·7·30일만 지원합니다.");
    }
    await this.simulateBackfill();

    const db = this.db();
    const now = new Date();
    const since = new Date(now.getTime() - rangeDays * 24 * 3600 * 1000);
    const durationSum = sql<number>`sum(${cretaPlayLog.durationSec})`.mapWith(
      Number,
    );

    const [byContent, byDevice, recent] = await Promise.all([
      db
        .select({
          kind: cretaPlayLog.contentKind,
          contentId: cretaPlayLog.contentId,
          title: cretaPlayLog.contentTitle,
          plays: count(),
          durationSec: durationSum,
          lastPlayedAt: max(cretaPlayLog.startedAt),
        })
        .from(cretaPlayLog)
        .where(gte(cretaPlayLog.startedAt, since))
        .groupBy(
          cretaPlayLog.contentKind,
          cretaPlayLog.contentId,
          cretaPlayLog.contentTitle,
        )
        .orderBy(desc(count())),
      db
        .select({
          deviceId: cretaPlayLog.deviceId,
          deviceName: cretaDevice.name,
          plays: count(),
          durationSec: durationSum,
          lastPlayedAt: max(cretaPlayLog.startedAt),
        })
        .from(cretaPlayLog)
        .innerJoin(cretaDevice, eq(cretaDevice.id, cretaPlayLog.deviceId))
        .where(gte(cretaPlayLog.startedAt, since))
        .groupBy(cretaPlayLog.deviceId, cretaDevice.name)
        .orderBy(desc(count())),
      db
        .select({
          id: cretaPlayLog.id,
          deviceId: cretaPlayLog.deviceId,
          deviceName: cretaDevice.name,
          kind: cretaPlayLog.contentKind,
          title: cretaPlayLog.contentTitle,
          startedAt: cretaPlayLog.startedAt,
          durationSec: cretaPlayLog.durationSec,
        })
        .from(cretaPlayLog)
        .innerJoin(cretaDevice, eq(cretaDevice.id, cretaPlayLog.deviceId))
        .where(gte(cretaPlayLog.startedAt, since))
        .orderBy(desc(cretaPlayLog.startedAt))
        .limit(50),
    ]);

    const totalPlays = byDevice.reduce((s, d) => s + d.plays, 0);
    const totalDurationSec = byDevice.reduce(
      (s, d) => s + (d.durationSec ?? 0),
      0,
    );
    return {
      rangeDays: rangeDays as PlayReportRange,
      generatedAt: now,
      totalPlays,
      totalDurationSec,
      deviceCount: byDevice.length,
      contentCount: byContent.length,
      byContent: byContent.map((r) => ({
        kind: r.kind,
        contentId: r.contentId,
        title: r.title,
        plays: r.plays,
        durationSec: r.durationSec ?? 0,
        lastPlayedAt: r.lastPlayedAt ?? since,
      })),
      byDevice: byDevice.map((r) => ({
        deviceId: r.deviceId,
        deviceName: r.deviceName,
        plays: r.plays,
        durationSec: r.durationSec ?? 0,
        lastPlayedAt: r.lastPlayedAt ?? since,
      })),
      recent,
    };
  }

  /** 디바이스 소스 → 시뮬레이션 콘텐츠(제목·반복 길이) */
  private async resolveContents(
    devices: (typeof cretaDevice.$inferSelect)[],
  ): Promise<Map<number, SimContent>> {
    const db = this.db();
    const bookIds = devices
      .filter((d) => d.sourceType === "book" && d.sourceBookId)
      .map((d) => d.sourceBookId!) as number[];
    const playlistIds = devices
      .filter((d) => d.sourceType === "playlist" && d.sourcePlaylistId)
      .map((d) => d.sourcePlaylistId!) as number[];
    const scheduleIds = devices
      .filter((d) => d.sourceType === "schedule" && d.sourceScheduleId)
      .map((d) => d.sourceScheduleId!) as number[];

    const [books, bookPageCounts, playlists, playlistPages, schedules] =
      await Promise.all([
        bookIds.length
          ? db
              .select({ id: bookTable.id, title: bookTable.title })
              .from(bookTable)
              .where(inArray(bookTable.id, bookIds))
          : Promise.resolve([]),
        bookIds.length
          ? db
              .select({ bookId: bookPage.bookId, n: count() })
              .from(bookPage)
              .where(inArray(bookPage.bookId, bookIds))
              .groupBy(bookPage.bookId)
          : Promise.resolve([]),
        playlistIds.length
          ? db
              .select({ id: cretaPlaylist.id, name: cretaPlaylist.name })
              .from(cretaPlaylist)
              .where(inArray(cretaPlaylist.id, playlistIds))
          : Promise.resolve([]),
        playlistIds.length
          ? db
              .select({
                playlistId: cretaPlaylistItem.playlistId,
                n: count(),
              })
              .from(cretaPlaylistItem)
              .innerJoin(
                bookPage,
                eq(bookPage.bookId, cretaPlaylistItem.bookId),
              )
              .where(inArray(cretaPlaylistItem.playlistId, playlistIds))
              .groupBy(cretaPlaylistItem.playlistId)
          : Promise.resolve([]),
        scheduleIds.length
          ? db
              .select({ id: cretaSchedule.id, name: cretaSchedule.name })
              .from(cretaSchedule)
              .where(inArray(cretaSchedule.id, scheduleIds))
          : Promise.resolve([]),
      ]);

    const bookTitle = new Map(books.map((b) => [b.id, b.title]));
    const bookPages = new Map(bookPageCounts.map((r) => [r.bookId, r.n]));
    const playlistName = new Map(playlists.map((p) => [p.id, p.name]));
    const playlistPageCount = new Map(
      playlistPages.map((r) => [r.playlistId, r.n]),
    );
    const scheduleName = new Map(schedules.map((s) => [s.id, s.name]));

    const map = new Map<number, SimContent>();
    for (const d of devices) {
      if (d.sourceType === "book" && d.sourceBookId != null) {
        const title = bookTitle.get(d.sourceBookId);
        if (title == null) continue;
        map.set(d.id, {
          kind: "book",
          contentId: d.sourceBookId,
          title,
          durationSec: Math.max(
            60,
            (bookPages.get(d.sourceBookId) ?? 1) * SEC_PER_PAGE,
          ),
        });
      } else if (d.sourceType === "playlist" && d.sourcePlaylistId != null) {
        const name = playlistName.get(d.sourcePlaylistId);
        if (name == null) continue;
        map.set(d.id, {
          kind: "playlist",
          contentId: d.sourcePlaylistId,
          title: name,
          durationSec: Math.max(
            120,
            (playlistPageCount.get(d.sourcePlaylistId) ?? 1) * SEC_PER_PAGE,
          ),
        });
      } else if (d.sourceType === "schedule" && d.sourceScheduleId != null) {
        const name = scheduleName.get(d.sourceScheduleId);
        if (name == null) continue;
        // 스케줄은 시간대별 콘텐츠 해석 대신 10분 블록으로 단순화
        map.set(d.id, {
          kind: "schedule",
          contentId: d.sourceScheduleId,
          title: name,
          durationSec: 600,
        });
      } else if (d.sourceType === "ad") {
        // 광고 전용 루프 — 참조 콘텐츠가 없다. 소재가 계속 도는 하나의 편성으로 집계한다.
        map.set(d.id, {
          kind: "ad",
          contentId: null,
          title: "광고 전용 루프",
          durationSec: AD_LOOP_BLOCK_SEC,
        });
      }
    }
    return map;
  }

  /**
   * 지연 적재 — 마지막 로그 끝 시각부터 지금까지 반복 재생을 기록한다.
   * advisory lock으로 동시 조회 시 중복 적재를 막고, 보존 기간이 지난 행은 함께 정리한다.
   */
  private async simulateBackfill(): Promise<void> {
    const db = this.db();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BACKFILL_LOCK_KEY})`);

      const devices = await tx.select().from(cretaDevice);
      const playing = devices.filter(
        (d) => d.online && d.sourceType !== "none",
      );
      if (playing.length > 0) {
        const contents = await this.resolveContents(playing);
        const now = Date.now();
        for (const device of playing) {
          const content = contents.get(device.id);
          if (!content) continue;
          const [last] = await tx
            .select({
              startedAt: cretaPlayLog.startedAt,
              durationSec: cretaPlayLog.durationSec,
            })
            .from(cretaPlayLog)
            .where(eq(cretaPlayLog.deviceId, device.id))
            .orderBy(desc(cretaPlayLog.startedAt))
            .limit(1);
          let cursor = last
            ? last.startedAt.getTime() + last.durationSec * 1000
            : now - 24 * 3600 * 1000;
          if (cursor < now - BACKFILL_WINDOW_MS) {
            cursor = now - BACKFILL_WINDOW_MS;
          }

          const rand = mulberry32(
            device.id * 7919 + Math.floor(cursor / 3600_000),
          );
          const rows: (typeof cretaPlayLog.$inferInsert)[] = [];
          while (rows.length < BACKFILL_MAX_ROWS) {
            // 반복 길이 ±15% + 전환 간격 0~20초 — 실제 로그처럼 보이게
            const durationSec = Math.max(
              30,
              Math.round(content.durationSec * (0.85 + rand() * 0.3)),
            );
            if (cursor + durationSec * 1000 > now) break;
            rows.push({
              deviceId: device.id,
              contentKind: content.kind,
              contentId: content.contentId,
              contentTitle: content.title,
              startedAt: new Date(cursor),
              durationSec,
            });
            cursor += durationSec * 1000 + Math.round(rand() * 20) * 1000;
          }
          if (rows.length > 0) {
            await tx.insert(cretaPlayLog).values(rows);
          }
        }
      }

      await tx
        .delete(cretaPlayLog)
        .where(
          lt(
            cretaPlayLog.startedAt,
            new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000),
          ),
        );
    });
  }
}
