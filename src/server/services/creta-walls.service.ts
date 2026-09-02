// 비디오월(시뮬레이션) 서비스 — 디바이스 묶음·모드(tile/mirror/multi)·마스터 관리.
// 실제 플레이어가 없어 재생 동기는 월 상세 미리보기가 공통 클록으로 시뮬레이션한다.
import { asc, eq, inArray } from "drizzle-orm";

import {
  type AuthActor,
  canMutateOwnedResource,
} from "@/server/auth/auth-policy";
import { getDb } from "@/server/db";
import {
  book as bookTable,
  cretaDevice,
  cretaVideoWall,
  cretaVideoWallMember,
  user as userTable,
} from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";

export const CRETA_WALL_MODES = ["tile", "mirror", "multi"] as const;
export type CretaWallMode = (typeof CRETA_WALL_MODES)[number];

const NAME_MAX = 120;
const GRID_MAX = 4;
const SLIDE_SEC_MIN = 3;
const SLIDE_SEC_MAX = 120;
const MEMBERS_MAX = 16;

export type CretaWallMemberPublic = {
  deviceId: number;
  deviceName: string;
  online: boolean;
  position: number;
  isMaster: boolean;
  /** multi 모드에서 이 디바이스가 재생할 북 */
  bookId: number | null;
  bookTitle: string | null;
};

export type CretaVideoWallPublic = {
  id: number;
  name: string;
  mode: CretaWallMode;
  rows: number;
  cols: number;
  /** tile·mirror 모드 공통 북 */
  bookId: number | null;
  bookTitle: string | null;
  slideSec: number;
  /** 만든 사람 이름(작성자 표시용) */
  ownerName: string | null;
  members: CretaWallMemberPublic[];
  updatedAt: Date;
};

function normalizeMode(v: unknown): CretaWallMode {
  return CRETA_WALL_MODES.includes(v as CretaWallMode)
    ? (v as CretaWallMode)
    : "tile";
}

function assertGrid(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > GRID_MAX) {
    throw new HttpError(400, `${label}은 1~${GRID_MAX} 사이 정수여야 합니다.`);
  }
  return n;
}

export class CretaWallsService {
  private db() {
    return getDb();
  }

  private async mapWalls(
    rows: (typeof cretaVideoWall.$inferSelect)[],
  ): Promise<CretaVideoWallPublic[]> {
    const db = this.db();
    const wallIds = rows.map((r) => r.id);
    const members = wallIds.length
      ? await db
          .select({
            wallId: cretaVideoWallMember.wallId,
            deviceId: cretaVideoWallMember.deviceId,
            position: cretaVideoWallMember.position,
            isMaster: cretaVideoWallMember.isMaster,
            bookId: cretaVideoWallMember.bookId,
            deviceName: cretaDevice.name,
            online: cretaDevice.online,
          })
          .from(cretaVideoWallMember)
          .innerJoin(
            cretaDevice,
            eq(cretaDevice.id, cretaVideoWallMember.deviceId),
          )
          .where(inArray(cretaVideoWallMember.wallId, wallIds))
          .orderBy(asc(cretaVideoWallMember.position))
      : [];

    const bookIds = [
      ...new Set(
        [...rows.map((r) => r.bookId), ...members.map((m) => m.bookId)].filter(
          (n): n is number => n != null,
        ),
      ),
    ];
    const books = bookIds.length
      ? await db
          .select({ id: bookTable.id, title: bookTable.title })
          .from(bookTable)
          .where(inArray(bookTable.id, bookIds))
      : [];
    const bookTitle = new Map(books.map((b) => [b.id, b.title]));
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

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      mode: normalizeMode(r.mode),
      rows: r.rows,
      cols: r.cols,
      bookId: r.bookId ?? null,
      bookTitle: r.bookId != null ? (bookTitle.get(r.bookId) ?? null) : null,
      slideSec: r.slideSec,
      ownerName: r.ownerId != null ? (ownerName.get(r.ownerId) ?? null) : null,
      updatedAt: r.updatedAt,
      members: members
        .filter((m) => m.wallId === r.id)
        .map((m) => ({
          deviceId: m.deviceId,
          deviceName: m.deviceName,
          online: m.online,
          position: m.position,
          isMaster: m.isMaster,
          bookId: m.bookId ?? null,
          bookTitle:
            m.bookId != null ? (bookTitle.get(m.bookId) ?? null) : null,
        })),
    }));
  }

  async list(): Promise<CretaVideoWallPublic[]> {
    const rows = await this.db()
      .select()
      .from(cretaVideoWall)
      .orderBy(asc(cretaVideoWall.id));
    return this.mapWalls(rows);
  }

  async get(id: number): Promise<CretaVideoWallPublic> {
    const row = await this.db().query.cretaVideoWall.findFirst({
      where: eq(cretaVideoWall.id, id),
    });
    if (!row) throw new HttpError(404, "비디오월을 찾을 수 없습니다.");
    const [wall] = await this.mapWalls([row]);
    return wall!;
  }

  async create(
    input: { name: string },
    ownerId: number,
  ): Promise<CretaVideoWallPublic> {
    const name = String(input.name ?? "").trim();
    if (!name) throw new HttpError(400, "비디오월 이름을 입력하세요.");
    if (name.length > NAME_MAX) {
      throw new HttpError(400, `이름은 ${NAME_MAX}자 이하여야 합니다.`);
    }
    const [row] = await this.db()
      .insert(cretaVideoWall)
      .values({ name, ownerId })
      .returning({ id: cretaVideoWall.id });
    if (!row) throw new HttpError(500, "비디오월 생성에 실패했습니다.");
    return this.get(row.id);
  }

  /**
   * 비디오월 소유권 — `create`가 `ownerId`를 저장해 두는데도 어떤 변경 경로에서도
   * 읽지 않아, 로그인한 아무나 남의 월을 수정·삭제할 수 있었다.
   * 소유자가 없는 레거시 행은 관리자만.
   */
  private async assertWallOwner(id: number, actor: AuthActor): Promise<void> {
    const row = await this.db().query.cretaVideoWall.findFirst({
      where: eq(cretaVideoWall.id, id),
      columns: { ownerId: true },
    });
    if (!row) throw new HttpError(404, "비디오월을 찾을 수 없습니다.");
    if (row.ownerId == null) {
      if (actor.role !== "admin") {
        throw new HttpError(
          403,
          "공용 비디오월은 관리자만 관리할 수 있습니다.",
        );
      }
      return;
    }
    if (!canMutateOwnedResource(actor, row.ownerId)) {
      throw new HttpError(403, "비디오월 소유자·관리자만 할 수 있습니다.");
    }
  }

  async update(
    id: number,
    input: {
      name?: string;
      mode?: string;
      rows?: number;
      cols?: number;
      bookId?: number | null;
      slideSec?: number;
    },
    actor: AuthActor,
  ): Promise<CretaVideoWallPublic> {
    await this.assertWallOwner(id, actor);
    const db = this.db();
    const set: Partial<typeof cretaVideoWall.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name != null) {
      const name = String(input.name).trim();
      if (!name || name.length > NAME_MAX) {
        throw new HttpError(400, "이름이 올바르지 않습니다.");
      }
      set.name = name;
    }
    if (input.mode != null) set.mode = normalizeMode(input.mode);
    if (input.rows != null) set.rows = assertGrid(input.rows, "행");
    if (input.cols != null) set.cols = assertGrid(input.cols, "열");
    if (input.slideSec != null) {
      const n = Number(input.slideSec);
      if (!Number.isInteger(n) || n < SLIDE_SEC_MIN || n > SLIDE_SEC_MAX) {
        throw new HttpError(
          400,
          `슬라이드 시간은 ${SLIDE_SEC_MIN}~${SLIDE_SEC_MAX}초여야 합니다.`,
        );
      }
      set.slideSec = n;
    }
    if (input.bookId !== undefined) {
      if (input.bookId === null) {
        set.bookId = null;
      } else {
        const bid = Number(input.bookId);
        const found = Number.isFinite(bid)
          ? await db.query.book.findFirst({
              where: eq(bookTable.id, bid),
              columns: { id: true },
            })
          : null;
        if (!found) throw new HttpError(404, "북을 찾을 수 없습니다.");
        set.bookId = bid;
      }
    }
    const updated = await db
      .update(cretaVideoWall)
      .set(set)
      .where(eq(cretaVideoWall.id, id))
      .returning({ id: cretaVideoWall.id });
    if (updated.length === 0) {
      throw new HttpError(404, "비디오월을 찾을 수 없습니다.");
    }
    return this.get(id);
  }

  /**
   * 멤버 전체 교체 — 배열 순서가 타일 위치(행 우선). isMaster는 1대만,
   * 지정이 없으면 첫 멤버가 마스터가 된다. multi 모드용 bookId는 멤버별 선택.
   */
  async setMembers(
    id: number,
    members: { deviceId: number; isMaster?: boolean; bookId?: number | null }[],
    actor: AuthActor,
  ): Promise<CretaVideoWallPublic> {
    await this.assertWallOwner(id, actor);
    const db = this.db();
    const wall = await db.query.cretaVideoWall.findFirst({
      where: eq(cretaVideoWall.id, id),
      columns: { id: true },
    });
    if (!wall) throw new HttpError(404, "비디오월을 찾을 수 없습니다.");
    if (!Array.isArray(members) || members.length > MEMBERS_MAX) {
      throw new HttpError(
        400,
        `멤버는 최대 ${MEMBERS_MAX}대까지 지정할 수 있습니다.`,
      );
    }

    const deviceIds = [
      ...new Set(
        members
          .map((m) => Number(m.deviceId))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ];
    const found = deviceIds.length
      ? await db
          .select({ id: cretaDevice.id })
          .from(cretaDevice)
          .where(inArray(cretaDevice.id, deviceIds))
      : [];
    const validIds = new Set(found.map((d) => d.id));
    const bookIds = [
      ...new Set(
        members
          .map((m) => m.bookId)
          .filter((n): n is number => n != null && Number.isInteger(n)),
      ),
    ];
    const foundBooks = bookIds.length
      ? await db
          .select({ id: bookTable.id })
          .from(bookTable)
          .where(inArray(bookTable.id, bookIds))
      : [];
    const validBookIds = new Set(foundBooks.map((b) => b.id));

    // 순서 유지·중복 제거 + 마스터 1대 보장
    const cleaned: {
      deviceId: number;
      isMaster: boolean;
      bookId: number | null;
    }[] = [];
    for (const m of members) {
      const deviceId = Number(m.deviceId);
      if (!validIds.has(deviceId)) continue;
      if (cleaned.some((c) => c.deviceId === deviceId)) continue;
      cleaned.push({
        deviceId,
        isMaster: m.isMaster === true,
        bookId:
          m.bookId != null && validBookIds.has(Number(m.bookId))
            ? Number(m.bookId)
            : null,
      });
    }
    const masterCount = cleaned.filter((c) => c.isMaster).length;
    if (masterCount > 1) {
      let seen = false;
      for (const c of cleaned) {
        if (c.isMaster) {
          if (seen) c.isMaster = false;
          seen = true;
        }
      }
    } else if (masterCount === 0 && cleaned.length > 0) {
      cleaned[0].isMaster = true;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(cretaVideoWallMember)
        .where(eq(cretaVideoWallMember.wallId, id));
      if (cleaned.length > 0) {
        await tx.insert(cretaVideoWallMember).values(
          cleaned.map((c, i) => ({
            wallId: id,
            deviceId: c.deviceId,
            position: i,
            isMaster: c.isMaster,
            bookId: c.bookId,
          })),
        );
      }
      await tx
        .update(cretaVideoWall)
        .set({ updatedAt: new Date() })
        .where(eq(cretaVideoWall.id, id));
    });
    return this.get(id);
  }

  async remove(id: number, actor: AuthActor): Promise<void> {
    await this.assertWallOwner(id, actor);
    const deleted = await this.db()
      .delete(cretaVideoWall)
      .where(eq(cretaVideoWall.id, id))
      .returning({ id: cretaVideoWall.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "비디오월을 찾을 수 없습니다.");
    }
  }
}
