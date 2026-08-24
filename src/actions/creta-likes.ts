"use server";

// 커뮤니티 좋아요 서버 액션 — 개수 조회는 공개(토큰 있으면 내가 눌렀는지 포함), 토글은 로그인
import {
  assertPositiveIntId,
  getUserFromTokenOptional,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import { assertCretaCommentTargetKind } from "@/server/services/creta-comments.service";
import {
  CretaLikesService,
  type CretaLikeStatePublic,
} from "@/server/services/creta-likes.service";

const TAG = "creta-likes-actions";

export async function listCretaLikesAction(
  accessToken: string | null | undefined,
  kind: string,
  ids: number[],
): Promise<Record<number, CretaLikeStatePublic>> {
  try {
    const viewer = await getUserFromTokenOptional(accessToken);
    const safe = (Array.isArray(ids) ? ids : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 500);
    return await new CretaLikesService().statesFor(
      assertCretaCommentTargetKind(kind),
      safe,
      viewer?.sub ?? null,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function toggleCretaLikeAction(
  accessToken: string | null | undefined,
  kind: string,
  targetId: number,
): Promise<CretaLikeStatePublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaLikesService().toggle(
      kind,
      assertPositiveIntId(targetId),
      user.sub,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
