import "server-only";

// 북 감사 로그 서비스 — 생성·저장·공유·상태 변경·삭제 이력을 기록하고 조회한다.
// 기록 실패가 본 작업을 막지 않도록 log()는 오류를 삼킨다.
import { desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db";
import { bookAuditLog, user as userTable } from "@/server/db/schema";

export type BookAuditAction =
  | "create"
  | "update"
  | "delete"
  | "share"
  | "status";

export const BOOK_AUDIT_ACTION_LABEL: Record<BookAuditAction, string> = {
  create: "생성",
  update: "저장",
  delete: "삭제",
  share: "공유",
  status: "상태",
};

export type BookAuditLogPublic = {
  id: number;
  bookId: number;
  bookTitle: string;
  action: BookAuditAction;
  detail: string;
  actorId: number | null;
  actorName: string;
  createdAt: Date;
};

function normalizeAction(v: string): BookAuditAction {
  return v === "create" ||
    v === "update" ||
    v === "delete" ||
    v === "share" ||
    v === "status"
    ? v
    : "update";
}

export class BookAuditService {
  private db() {
    return getDb();
  }

  /** 이력 기록 — actorName이 없으면 actorId로 조회. 실패해도 본 작업은 계속 */
  async log(entry: {
    bookId: number;
    bookTitle: string;
    action: BookAuditAction;
    detail: string;
    actorId: number | null;
    actorName?: string;
  }): Promise<void> {
    try {
      const db = this.db();
      let actorName = entry.actorName?.trim() ?? "";
      if (!actorName && entry.actorId != null) {
        const u = await db.query.user.findFirst({
          where: eq(userTable.id, entry.actorId),
          columns: { name: true },
        });
        actorName = u?.name ?? "";
      }
      await db.insert(bookAuditLog).values({
        bookId: entry.bookId,
        bookTitle: entry.bookTitle.slice(0, 200),
        action: entry.action,
        detail: entry.detail.slice(0, 300),
        actorId: entry.actorId,
        actorName: (actorName || "알 수 없음").slice(0, 80),
      });
    } catch {
      /* 감사 로그 실패는 본 작업을 막지 않는다 */
    }
  }

  /** 한 북의 이력(최신순) */
  async listForBook(bookId: number, limit = 50): Promise<BookAuditLogPublic[]> {
    const rows = await this.db()
      .select()
      .from(bookAuditLog)
      .where(eq(bookAuditLog.bookId, bookId))
      .orderBy(desc(bookAuditLog.id))
      .limit(Math.min(200, Math.max(1, limit)));
    return rows.map((r) => ({ ...r, action: normalizeAction(r.action) }));
  }

  /** 전체 최근 활동(대시보드용, 최신순) */
  async listRecent(limit = 20): Promise<BookAuditLogPublic[]> {
    const rows = await this.db()
      .select()
      .from(bookAuditLog)
      .orderBy(desc(bookAuditLog.id))
      .limit(Math.min(100, Math.max(1, limit)));
    return rows.map((r) => ({ ...r, action: normalizeAction(r.action) }));
  }

  /** 여러 북 삭제 시 남은 이력 정리는 하지 않는다(이력 보존) — 존재 확인용 헬퍼만 */
  async hasAny(bookIds: number[]): Promise<boolean> {
    if (bookIds.length === 0) return false;
    const [row] = await this.db()
      .select({ id: bookAuditLog.id })
      .from(bookAuditLog)
      .where(inArray(bookAuditLog.bookId, bookIds))
      .limit(1);
    return Boolean(row);
  }
}
