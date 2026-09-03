// 커뮤니티 좋아요 클라이언트 API(서버 액션 브리지)
import {
  listCretaLikesAction,
  toggleCretaLikeAction,
} from "@/actions/creta-likes";
import { getAccessToken, humanizeServerActionError } from "@/lib/api";
import type { CretaCommentTargetKind } from "@/lib/creta-comments-api";

export type CretaLikeState = { count: number; likedByMe: boolean };

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

/** 대상별 좋아요 상태 — 로그인 토큰이 있으면 likedByMe 포함 */
export async function fetchCretaLikes(
  kind: CretaCommentTargetKind,
  ids: number[],
): Promise<Record<number, CretaLikeState>> {
  if (ids.length === 0) return {};
  return run(() => listCretaLikesAction(kind, ids));
}

export async function toggleCretaLike(
  kind: CretaCommentTargetKind,
  targetId: number,
): Promise<CretaLikeState> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return run(() => toggleCretaLikeAction(kind, targetId));
}
