// 커뮤니티 댓글 클라이언트 API(서버 액션 브리지)
import {
  createCretaCommentAction,
  deleteCretaCommentAction,
  listCretaCommentCountsAction,
  listCretaCommentsAction,
} from "@/actions/creta-comments";
import { getAccessToken, humanizeServerActionError } from "@/lib/api";

export type CretaCommentTargetKind = "book" | "playlist";

export type CretaComment = {
  id: number;
  content: string;
  createdAt: string;
  author: { id: number; name: string; imageUrl: string | null };
  replies: CretaComment[];
};

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

function requireToken(): string {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return token;
}

export async function fetchCretaComments(
  kind: CretaCommentTargetKind,
  targetId: number,
): Promise<CretaComment[]> {
  return run(() =>
    listCretaCommentsAction(kind, targetId),
  ) as unknown as CretaComment[];
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
  return run(() =>
    createCretaCommentAction(requireToken(), kind, targetId, body),
  ) as unknown as CretaComment[];
}

export async function deleteCretaComment(
  commentId: number,
): Promise<{ kind: CretaCommentTargetKind; targetId: number }> {
  return run(() => deleteCretaCommentAction(requireToken(), commentId));
}

/** 전체 댓글 수(답글 포함) */
export function countCretaComments(tree: readonly CretaComment[]): number {
  return tree.reduce((n, c) => n + 1 + c.replies.length, 0);
}
