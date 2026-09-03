import "server-only";

// 디바이스 가동률·장애율 리포트 — 실제 헬스 수집기가 없어 시간당 상태 스냅샷을
// 조회 시점에 지연 적재(시뮬레이션)하고, 일자별·디바이스별로 집계해 돌려준다.
// (재생 리포트 `CretaPlayLogService`와 같은 backfill 패턴)
import { desc, eq, gte, lt, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { cretaDevice, cretaDeviceStatusLog } from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";

/** 리포트 기간(일) — 이 외 값은 400 */
export const DEVICE_UPTIME_RANGES = [7, 30] as const;
export type DeviceUptimeRange = (typeof DEVICE_UPTIME_RANGES)[number];

/** 스냅샷 간격(시간당 1회) */
const SNAPSHOT_MS = 3600 * 1000;
/** 첫 적재 시 과거로 채우는 기간 — 그래프가 비어 보이지 않게 30일 확보 */
const INITIAL_BACKFILL_DAYS = 30;
/** 이력 보존 기간(일) */
const RETENTION_DAYS = 60;
/** 동시 백필 중복 방지용 advisory lock 키(재생 로그와 다른 값) */
const BACKFILL_LOCK_KEY = 731_209_432;

export type CretaDeviceUptimePublic = {
  rangeDays: DeviceUptimeRange;
  generatedAt: Date;
  /** 기간 전체 가동률(%) — online 스냅샷 비율 */
  overallUptimePct: number;
  /** 기간 전체 장애율(%) — error 스냅샷 비율 */
  overallErrorPct: number;
  byDay: {
    /** YYYY-MM-DD(서버 로컬) */
    date: string;
    online: number;
    error: number;
    offline: number;
  }[];
  byDevice: {
    deviceId: number;
    deviceName: string;
    location: string;
    uptimePct: number;
    errorPct: number;
    offlinePct: number;
    samples: number;
  }[];
};

/** 결정론적 의사 난수(mulberry32) — 같은 시각·디바이스면 항상 같은 상태가 나온다 */
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

/** 현재 상태를 기준으로 그 시각의 시뮬레이션 상태를 뽑는다(현재 상태에 수렴하는 편향) */
function sampleStatus(
  device: typeof cretaDevice.$inferSelect,
  hourIndex: number,
): "online" | "error" | "offline" {
  const rand = mulberry32(device.id * 104729 + hourIndex);
  const r = rand();
  if (!device.online) {
    // 현재 오프라인 — 과거에도 자주 꺼져 있던 단말로 본다
    if (r < 0.55) return "offline";
    if (r < 0.62) return "error";
    return "online";
  }
  if (device.health === "error") {
    // 현재 비정상 — 간헐 장애가 잦은 단말
    if (r < 0.72) return "online";
    if (r < 0.94) return "error";
    return "offline";
  }
  // 정상 단말 — 드문 순단·재부팅만
  if (r < 0.965) return "online";
  if (r < 0.985) return "error";
  return "offline";
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export class CretaDeviceUptimeService {
  private db() {
    return getDb();
  }

  async getReport(rangeDays: number): Promise<CretaDeviceUptimePublic> {
    if (!DEVICE_UPTIME_RANGES.includes(rangeDays as DeviceUptimeRange)) {
      throw new HttpError(400, "가동률 리포트 기간은 7·30일만 지원합니다.");
    }
    await this.simulateBackfill();

    const db = this.db();
    const now = new Date();
    const since = new Date(now.getTime() - rangeDays * 24 * 3600 * 1000);

    const [rows, devices] = await Promise.all([
      db
        .select({
          deviceId: cretaDeviceStatusLog.deviceId,
          status: cretaDeviceStatusLog.status,
          checkedAt: cretaDeviceStatusLog.checkedAt,
        })
        .from(cretaDeviceStatusLog)
        .where(gte(cretaDeviceStatusLog.checkedAt, since)),
      db
        .select({
          id: cretaDevice.id,
          name: cretaDevice.name,
          location: cretaDevice.location,
        })
        .from(cretaDevice),
    ]);

    // 일자별 집계 — 기간 내 모든 날짜를 0으로 깔아 빈 날도 그래프에 나온다
    const byDayMap = new Map<
      string,
      { online: number; error: number; offline: number }
    >();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      byDayMap.set(localDateKey(d), { online: 0, error: 0, offline: 0 });
    }
    const byDeviceMap = new Map<
      number,
      { online: number; error: number; offline: number }
    >();
    let onlineTotal = 0;
    let errorTotal = 0;
    for (const r of rows) {
      const day = byDayMap.get(localDateKey(r.checkedAt));
      const dev = byDeviceMap.get(r.deviceId) ?? {
        online: 0,
        error: 0,
        offline: 0,
      };
      const key =
        r.status === "online" || r.status === "error" ? r.status : "offline";
      if (day) day[key] += 1;
      dev[key] += 1;
      byDeviceMap.set(r.deviceId, dev);
      if (key === "online") onlineTotal += 1;
      if (key === "error") errorTotal += 1;
    }

    const total = rows.length;
    const pct = (n: number, d: number) =>
      d > 0 ? Math.round((1000 * n) / d) / 10 : 0;

    const byDevice = devices
      .map((d) => {
        const c = byDeviceMap.get(d.id) ?? { online: 0, error: 0, offline: 0 };
        const samples = c.online + c.error + c.offline;
        return {
          deviceId: d.id,
          deviceName: d.name,
          location: d.location,
          uptimePct: pct(c.online, samples),
          errorPct: pct(c.error, samples),
          offlinePct: pct(c.offline, samples),
          samples,
        };
      })
      // 가동률 낮은(문제 많은) 단말부터 — 운영자가 먼저 봐야 할 순서
      .sort((a, b) => a.uptimePct - b.uptimePct);

    return {
      rangeDays: rangeDays as DeviceUptimeRange,
      generatedAt: now,
      overallUptimePct: pct(onlineTotal, total),
      overallErrorPct: pct(errorTotal, total),
      byDay: [...byDayMap.entries()].map(([date, c]) => ({ date, ...c })),
      byDevice,
    };
  }

  /**
   * 지연 적재 — 디바이스별 마지막 스냅샷 다음 시각부터 지금까지 시간당 1행.
   * 첫 적재는 과거 30일을 채우고, 보존 기간이 지난 행은 함께 정리한다.
   */
  private async simulateBackfill(): Promise<void> {
    const db = this.db();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BACKFILL_LOCK_KEY})`);

      const devices = await tx.select().from(cretaDevice);
      const now = Date.now();
      for (const device of devices) {
        const [last] = await tx
          .select({ checkedAt: cretaDeviceStatusLog.checkedAt })
          .from(cretaDeviceStatusLog)
          .where(eq(cretaDeviceStatusLog.deviceId, device.id))
          .orderBy(desc(cretaDeviceStatusLog.checkedAt))
          .limit(1);
        let cursor = last?.checkedAt
          ? last.checkedAt.getTime() + SNAPSHOT_MS
          : now - INITIAL_BACKFILL_DAYS * 24 * 3600 * 1000;
        // 시간 격자에 정렬 — 디바이스 간 같은 시각 스냅샷으로 일자 집계가 맞는다
        cursor = Math.ceil(cursor / SNAPSHOT_MS) * SNAPSHOT_MS;

        const rows: (typeof cretaDeviceStatusLog.$inferInsert)[] = [];
        while (cursor <= now) {
          const hourIndex = Math.floor(cursor / SNAPSHOT_MS);
          rows.push({
            deviceId: device.id,
            status: sampleStatus(device, hourIndex),
            checkedAt: new Date(cursor),
          });
          cursor += SNAPSHOT_MS;
        }
        if (rows.length > 0) {
          await tx.insert(cretaDeviceStatusLog).values(rows);
        }
      }

      await tx
        .delete(cretaDeviceStatusLog)
        .where(
          lt(
            cretaDeviceStatusLog.checkedAt,
            new Date(now - RETENTION_DAYS * 24 * 3600 * 1000),
          ),
        );
    });
  }
}
