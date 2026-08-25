// 긴급 알림 서비스: 대상 디바이스의 현재 재생을 덮어쓰는 공지.
// 한 번에 하나만 활성 — 새 알림을 발송하면 기존 활성 알림은 자동 종료된다.
import { desc, eq, inArray } from "drizzle-orm";

import type { AuthActor } from "@/server/auth/auth-policy";
import { getDb } from "@/server/db";
import {
  cretaAlert,
  cretaAlertDevice,
  cretaDevice,
  user as userTable,
} from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";

export const CRETA_ALERT_LEVELS = ["긴급", "주의", "안내"] as const;
export type CretaAlertLevel = (typeof CRETA_ALERT_LEVELS)[number];

const MESSAGE_MAX = 300;

export type CretaAlertPublic = {
  id: number;
  message: string;
  level: CretaAlertLevel;
  /** true면 모든 디바이스 대상(deviceIds 무시) */
  allDevices: boolean;
  /** allDevices=false일 때 대상 디바이스 id */
  deviceIds: number[];
  createdAt: Date;
  createdByName: string | null;
};

function normalizeLevel(v: unknown): CretaAlertLevel {
  return CRETA_ALERT_LEVELS.includes(v as CretaAlertLevel)
    ? (v as CretaAlertLevel)
    : "긴급";
}

export class CretaAlertsService {
  private db() {
    return getDb();
  }

  /** 현재 활성 알림(없으면 null) — 목록·상세 화면이 폴링으로 조회 */
  async getActive(): Promise<CretaAlertPublic | null> {
    const db = this.db();
    const row = await db.query.cretaAlert.findFirst({
      where: eq(cretaAlert.active, true),
      orderBy: [desc(cretaAlert.id)],
    });
    if (!row) return null;

    const [targets, creator] = await Promise.all([
      row.allDevices
        ? Promise.resolve([])
        : db
            .select({ deviceId: cretaAlertDevice.deviceId })
            .from(cretaAlertDevice)
            .where(eq(cretaAlertDevice.alertId, row.id)),
      row.createdBy != null
        ? db.query.user.findFirst({
            where: eq(userTable.id, row.createdBy),
            columns: { name: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      id: row.id,
      message: row.message,
      level: normalizeLevel(row.level),
      allDevices: row.allDevices,
      deviceIds: targets.map((t) => t.deviceId),
      createdAt: row.createdAt,
      createdByName: creator?.name ?? null,
    };
  }

  /**
   * 알림 발송 — 기존 활성 알림은 종료하고 새 알림을 만든다.
   * deviceIds가 비어 있거나 없으면 모든 디바이스 대상.
   */
  async activate(
    actor: AuthActor,
    input: { message: string; level?: string; deviceIds?: number[] | null },
  ): Promise<CretaAlertPublic> {
    const message = String(input.message ?? "").trim();
    if (!message) throw new HttpError(400, "알림 메시지를 입력하세요.");
    if (message.length > MESSAGE_MAX) {
      throw new HttpError(
        400,
        `알림 메시지는 ${MESSAGE_MAX}자 이하여야 합니다.`,
      );
    }
    const level = normalizeLevel(input.level);

    const rawIds = Array.isArray(input.deviceIds)
      ? [
          ...new Set(
            input.deviceIds.filter(
              (n) => typeof n === "number" && Number.isInteger(n) && n > 0,
            ),
          ),
        ]
      : [];
    const db = this.db();
    let deviceIds: number[] = [];
    if (rawIds.length > 0) {
      const rows = await db
        .select({ id: cretaDevice.id })
        .from(cretaDevice)
        .where(inArray(cretaDevice.id, rawIds));
      deviceIds = rows.map((r) => r.id);
      if (deviceIds.length === 0) {
        throw new HttpError(404, "대상 디바이스를 찾을 수 없습니다.");
      }
    }
    const allDevices = deviceIds.length === 0;

    await db.transaction(async (tx) => {
      await tx
        .update(cretaAlert)
        .set({ active: false, endedAt: new Date() })
        .where(eq(cretaAlert.active, true));
      const [row] = await tx
        .insert(cretaAlert)
        .values({ message, level, allDevices, createdBy: actor.id })
        .returning({ id: cretaAlert.id });
      if (!row) throw new HttpError(500, "알림 발송에 실패했습니다.");
      if (!allDevices) {
        await tx
          .insert(cretaAlertDevice)
          .values(deviceIds.map((deviceId) => ({ alertId: row.id, deviceId })));
      }
    });
    const created = await this.getActive();
    if (!created) throw new HttpError(500, "알림 발송에 실패했습니다.");
    return created;
  }

  /** 알림 해제 — 활성 알림을 종료(이력은 보존). 로그인 검증은 액션에서 수행 */
  async deactivate(): Promise<void> {
    await this.db()
      .update(cretaAlert)
      .set({ active: false, endedAt: new Date() })
      .where(eq(cretaAlert.active, true));
  }
}
