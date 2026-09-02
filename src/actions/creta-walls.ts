"use server";

// 비디오월 서버 액션 — 조회 공개, 변경 로그인(다른 크레타 도메인과 동일 정책)
import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import {
  type CretaVideoWallPublic,
  CretaWallsService,
} from "@/server/services/creta-walls.service";

const TAG = "creta-walls-actions";

export async function listCretaWallsAction(
  accessToken: string | null | undefined,
): Promise<CretaVideoWallPublic[]> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaWallsService().list();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaWallAction(
  accessToken: string | null | undefined,
  wallId: number,
): Promise<CretaVideoWallPublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaWallsService().get(assertPositiveIntId(wallId));
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaWallAction(
  accessToken: string | null | undefined,
  input: { name: string },
): Promise<CretaVideoWallPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaWallsService().create(
      { name: String(input?.name ?? "") },
      user.sub,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaWallAction(
  accessToken: string | null | undefined,
  wallId: number,
  input: {
    name?: string;
    mode?: string;
    rows?: number;
    cols?: number;
    bookId?: number | null;
    slideSec?: number;
  },
): Promise<CretaVideoWallPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaWallsService().update(
      assertPositiveIntId(wallId),
      input ?? {},
      { id: user.sub, role: user.role },
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 멤버 전체 교체 — 배열 순서 = 타일 위치 */
export async function setCretaWallMembersAction(
  accessToken: string | null | undefined,
  wallId: number,
  members: { deviceId: number; isMaster?: boolean; bookId?: number | null }[],
): Promise<CretaVideoWallPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaWallsService().setMembers(
      assertPositiveIntId(wallId),
      Array.isArray(members) ? members : [],
      { id: user.sub, role: user.role },
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaWallAction(
  accessToken: string | null | undefined,
  wallId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaWallsService().remove(assertPositiveIntId(wallId), {
      id: user.sub,
      role: user.role,
    });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
