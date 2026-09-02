// 커뮤니티 좋아요: 북·플레이리스트 대상 토글, 대상별 개수 + 내가 눌렀는지
import { and, count, eq, inArray } from "drizzle-orm";

import { type DbOrTx, getDb } from "@/server/db";
import { cretaLike } from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";
import {
  assertCretaCommentTargetKind,
  type CretaCommentTargetKind,
} from "@/server/services/creta-comments.service";

export type CretaLikeStatePublic = { count: number; likedByMe: boolean };

export class CretaLikesService {
  private db() {
    return getDb();
  }

  /** 대상별 좋아요 수 + viewer가 눌렀는지 */
  async statesFor(
    kind: CretaCommentTargetKind,
    ids: number[],
    viewerId: number | null,
  ): Promise<Record<number, CretaLikeStatePublic>> {
    const out: Record<number, CretaLikeStatePublic> = {};
    const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (uniq.length === 0) return out;
    const db = this.db();
    const counts = await db
      .select({ targetId: cretaLike.targetId, n: count() })
      .from(cretaLike)
      .where(
        and(eq(cretaLike.targetKind, kind), inArray(cretaLike.targetId, uniq)),
      )
      .groupBy(cretaLike.targetId);
    for (const id of uniq) out[id] = { count: 0, likedByMe: false };
    for (const c of counts)
      out[c.targetId] = { count: Number(c.n), likedByMe: false };
    if (viewerId != null) {
      const mine = await db
        .select({ targetId: cretaLike.targetId })
        .from(cretaLike)
        .where(
          and(
            eq(cretaLike.targetKind, kind),
            inArray(cretaLike.targetId, uniq),
            eq(cretaLike.userId, viewerId),
          ),
        );
      for (const m of mine) {
        const s = out[m.targetId];
        if (s) s.likedByMe = true;
      }
    }
    return out;
  }

  /** 누르면 추가, 이미 눌렀으면 해제 */
  async toggle(
    kindRaw: unknown,
    targetId: number,
    userId: number,
  ): Promise<CretaLikeStatePublic> {
    const kind = assertCretaCommentTargetKind(kindRaw);
    if (!Number.isInteger(targetId) || targetId <= 0)
      throw new HttpError(400, "대상 id가 올바르지 않습니다.");
    const db = this.db();
    const deleted = await db
      .delete(cretaLike)
      .where(
        and(
          eq(cretaLike.targetKind, kind),
          eq(cretaLike.targetId, targetId),
          eq(cretaLike.userId, userId),
        ),
      )
      .returning({ id: cretaLike.id });
    if (deleted.length === 0) {
      await db
        .insert(cretaLike)
        .values({ targetKind: kind, targetId, userId })
        .onConflictDoNothing();
    }
    const state = await this.statesFor(kind, [targetId], userId);
    return state[targetId] ?? { count: 0, likedByMe: false };
  }

  /** 대상 삭제 시 일괄 정리. `tx`를 주면 호출자의 트랜잭션에 합류한다(원자성). */
  async removeAllForTarget(
    kind: CretaCommentTargetKind,
    targetId: number,
    tx?: DbOrTx,
  ): Promise<void> {
    await (tx ?? this.db())
      .delete(cretaLike)
      .where(
        and(eq(cretaLike.targetKind, kind), eq(cretaLike.targetId, targetId)),
      );
  }
}
