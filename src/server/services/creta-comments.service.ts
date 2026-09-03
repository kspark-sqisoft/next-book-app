import "server-only";

// 커뮤니티 댓글: 북·플레이리스트에 대한 2단 댓글(루트 + 답글). 작성은 로그인, 삭제는 작성자·관리자.
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import {
  type AuthActor,
  canMutateOwnedResource,
} from "@/server/auth/auth-policy";
import { type DbOrTx, getDb } from "@/server/db";
import {
  book as bookTable,
  cretaComment,
  cretaPlaylist,
  user as userTable,
} from "@/server/db/schema";
import { AVATARS_SUBDIR } from "@/server/env";
import { HttpError } from "@/server/http/http-error";

export type CretaCommentTargetKind = "book" | "playlist";

export type CretaCommentAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type CretaCommentPublic = {
  id: number;
  content: string;
  createdAt: Date;
  author: CretaCommentAuthorPublic;
  /** 루트 댓글에만 채움(2단) */
  replies: CretaCommentPublic[];
};

const CONTENT_MAX = 2000;

export function assertCretaCommentTargetKind(
  raw: unknown,
): CretaCommentTargetKind {
  if (raw === "book" || raw === "playlist") return raw;
  throw new HttpError(400, "댓글 대상 종류가 올바르지 않습니다.");
}

export class CretaCommentsService {
  private db() {
    return getDb();
  }

  private avatarUrl(filename: string | null): string | null {
    return filename ? `/uploads/${AVATARS_SUBDIR}/${filename}` : null;
  }

  /** 대상(북/플레이리스트) 존재 확인 */
  private async assertTarget(kind: CretaCommentTargetKind, targetId: number) {
    const db = this.db();
    const row =
      kind === "book"
        ? await db.query.book.findFirst({
            where: eq(bookTable.id, targetId),
            columns: { id: true },
          })
        : await db.query.cretaPlaylist.findFirst({
            where: eq(cretaPlaylist.id, targetId),
            columns: { id: true },
          });
    if (!row)
      throw new HttpError(
        404,
        kind === "book"
          ? "북을 찾을 수 없습니다."
          : "플레이리스트를 찾을 수 없습니다.",
      );
  }

  /** 루트(오래된 순) + 각 루트의 답글(오래된 순) */
  async listByTarget(
    kind: CretaCommentTargetKind,
    targetId: number,
  ): Promise<CretaCommentPublic[]> {
    const db = this.db();
    const rows = await db
      .select({
        id: cretaComment.id,
        parentId: cretaComment.parentId,
        content: cretaComment.content,
        createdAt: cretaComment.createdAt,
        userId: userTable.id,
        userName: userTable.name,
        userImage: userTable.profileImageFilename,
      })
      .from(cretaComment)
      .innerJoin(userTable, eq(userTable.id, cretaComment.userId))
      .where(
        and(
          eq(cretaComment.targetKind, kind),
          eq(cretaComment.targetId, targetId),
        ),
      )
      .orderBy(asc(cretaComment.createdAt), asc(cretaComment.id));

    const toPublic = (r: (typeof rows)[number]): CretaCommentPublic => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      author: {
        id: r.userId,
        name: r.userName,
        imageUrl: this.avatarUrl(r.userImage),
      },
      replies: [],
    });

    const roots = new Map<number, CretaCommentPublic>();
    for (const r of rows) {
      if (r.parentId == null) roots.set(r.id, toPublic(r));
    }
    for (const r of rows) {
      if (r.parentId == null) continue;
      const parent = roots.get(r.parentId);
      if (parent) parent.replies.push(toPublic(r));
    }
    return [...roots.values()];
  }

  /** 대상별 댓글 수(답글 포함) */
  async countsFor(
    kind: CretaCommentTargetKind,
    ids: number[],
  ): Promise<Record<number, number>> {
    const out: Record<number, number> = {};
    const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (uniq.length === 0) return out;
    const rows = await this.db()
      .select({ targetId: cretaComment.targetId, n: count() })
      .from(cretaComment)
      .where(
        and(
          eq(cretaComment.targetKind, kind),
          inArray(cretaComment.targetId, uniq),
        ),
      )
      .groupBy(cretaComment.targetId);
    for (const r of rows) out[r.targetId] = Number(r.n);
    return out;
  }

  async create(input: {
    kind: CretaCommentTargetKind;
    targetId: number;
    actor: AuthActor;
    content: string;
    parentId?: number | null;
  }): Promise<CretaCommentPublic[]> {
    const content = String(input.content ?? "").trim();
    if (!content) throw new HttpError(400, "댓글 내용을 입력해 주세요.");
    if (content.length > CONTENT_MAX)
      throw new HttpError(400, `댓글은 ${CONTENT_MAX}자 이하여야 합니다.`);
    await this.assertTarget(input.kind, input.targetId);
    const db = this.db();
    let parentId: number | null = null;
    if (input.parentId != null) {
      const parent = await db.query.cretaComment.findFirst({
        where: eq(cretaComment.id, input.parentId),
        columns: { id: true, parentId: true, targetKind: true, targetId: true },
      });
      if (
        !parent ||
        parent.targetKind !== input.kind ||
        parent.targetId !== input.targetId
      )
        throw new HttpError(404, "답글을 달 댓글을 찾을 수 없습니다.");
      // 2단 고정: 답글의 답글은 같은 루트에 붙인다
      parentId = parent.parentId ?? parent.id;
    }
    await db.insert(cretaComment).values({
      targetKind: input.kind,
      targetId: input.targetId,
      parentId,
      userId: input.actor.id,
      content,
    });
    return this.listByTarget(input.kind, input.targetId);
  }

  async remove(
    commentId: number,
    actor: AuthActor,
  ): Promise<{ kind: CretaCommentTargetKind; targetId: number }> {
    const db = this.db();
    const row = await db.query.cretaComment.findFirst({
      where: eq(cretaComment.id, commentId),
      columns: { id: true, userId: true, targetKind: true, targetId: true },
    });
    if (!row) throw new HttpError(404, "댓글을 찾을 수 없습니다.");
    if (!canMutateOwnedResource(actor, row.userId))
      throw new HttpError(403, "댓글 삭제 권한이 없습니다.");
    await db.delete(cretaComment).where(eq(cretaComment.id, commentId));
    return {
      kind: assertCretaCommentTargetKind(row.targetKind),
      targetId: row.targetId,
    };
  }

  /** 대상이 삭제될 때 호출 — 고아 댓글 정리(루트만 지우면 답글은 cascade) */
  /** 대상 삭제 시 일괄 정리. `tx`를 주면 호출자의 트랜잭션에 합류한다(원자성). */
  async removeAllForTarget(
    kind: CretaCommentTargetKind,
    targetId: number,
    tx?: DbOrTx,
  ): Promise<void> {
    await (tx ?? this.db())
      .delete(cretaComment)
      .where(
        and(
          eq(cretaComment.targetKind, kind),
          eq(cretaComment.targetId, targetId),
          isNull(cretaComment.parentId),
        ),
      );
  }
}
