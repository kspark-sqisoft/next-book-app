// 커뮤니티 댓글 클라이언트 API(서버 액션 브리지)
import {
  createCretaCommentAction,
  deleteCretaCommentAction,
  listCretaCommentCountsAction,
  listCretaCommentsAction,
} from "@/actions/creta-comments";
import { humanizeServerActionError } from "@/lib/api";
// 서버 DTO를 단일 출처로 삼는다(타입 전용 import 라 런타임에는 지워진다)
import type { CretaCommentPublic } from "@/server/services/creta-comments.service";

export type CretaCommentTargetKind = "book" | "playlist";

export type CretaComment = CretaCommentPublic;

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

export async function fetchCretaComments(
  kind: CretaCommentTargetKind,
  targetId: number,
): Promise<CretaComment[]> {
  return run(() => listCretaCommentsAction(kind, targetId));
}

export async function fetchCretaCommentCounts(
  kind: CretaCommentTargetKind,
  ids: number[],
): Promise<Record<number, number>> {
  if (ids.length === 0) return {};
  return run(() => listCretaCommentCountsAction(kind, ids));
}

export async function createCretaComment(
  kind: CretaCommentTargetKind,
  targetId: number,
  body: { content: string; parentId?: number | null },
): Promise<CretaComment[]> {
  return run(() => createCretaCommentAction(kind, targetId, body));
}

export async function deleteCretaComment(
  commentId: number,
): Promise<{ kind: CretaCommentTargetKind; targetId: number }> {
  return run(() => deleteCretaCommentAction(commentId));
}

/** 전체 댓글 수(답글 포함) */
export function countCretaComments(tree: readonly CretaComment[]): number {
  return tree.reduce((n, c) => n + 1 + c.replies.length, 0);
}
