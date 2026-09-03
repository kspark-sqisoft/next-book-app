"use server";

import "server-only";

// 커뮤니티 댓글 서버 액션 — 조회·수는 공개, 작성·삭제는 로그인
import {
  assertPositiveIntId,
  rethrowActionError,
} from "@/actions/action-guards";
import { requireUser } from "@/server/auth/session";
import {
  assertCretaCommentTargetKind,
  type CretaCommentPublic,
  CretaCommentsService,
} from "@/server/services/creta-comments.service";

const TAG = "creta-comments-actions";

export async function listCretaCommentsAction(
  kind: string,
  targetId: number,
): Promise<CretaCommentPublic[]> {
  try {
    return await new CretaCommentsService().listByTarget(
      assertCretaCommentTargetKind(kind),
      assertPositiveIntId(targetId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function listCretaCommentCountsAction(
  kind: string,
  ids: number[],
): Promise<Record<number, number>> {
  try {
    const safe = (Array.isArray(ids) ? ids : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 500);
    return await new CretaCommentsService().countsFor(
      assertCretaCommentTargetKind(kind),
      safe,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaCommentAction(
  kind: string,
  targetId: number,
  body: { content: string; parentId?: number | null },
): Promise<CretaCommentPublic[]> {
  try {
    const user = await requireUser();
    return await new CretaCommentsService().create({
      kind: assertCretaCommentTargetKind(kind),
      targetId: assertPositiveIntId(targetId),
      actor: { id: user.sub, role: user.role },
      content: String(body?.content ?? ""),
      parentId:
        body?.parentId != null ? assertPositiveIntId(body.parentId) : null,
    });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaCommentAction(
  commentId: number,
): Promise<{ kind: "book" | "playlist"; targetId: number }> {
  try {
    const user = await requireUser();
    return await new CretaCommentsService().remove(
      assertPositiveIntId(commentId),
      { id: user.sub, role: user.role },
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
