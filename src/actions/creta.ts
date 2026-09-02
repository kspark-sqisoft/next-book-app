"use server";

// 크레타 사이니지(플레이리스트·스케줄·디바이스) 서버 액션.
// 조회는 공개, 변경은 로그인 필요(북 목록과 동일한 학습용 정책).
import {
  assertPositiveIntId,
  requireAdminFromToken,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import type { AuthActor } from "@/server/auth/auth-policy";
import {
  type CretaDevicePublic,
  type CretaMyOverviewPublic,
  type CretaPlaylistDetailPublic,
  type CretaPlaylistListItemPublic,
  type CretaScheduleDetailPublic,
  type CretaScheduleListItemPublic,
  CretaService,
  type CretaSlotRepeat,
} from "@/server/services/creta.service";

const TAG = "creta-actions";

/** JWT payload → 서비스 권한 판정용 actor */
function actorOf(user: { sub: number; role: AuthActor["role"] }): AuthActor {
  return { id: user.sub, role: user.role };
}

// ── 공유 ─────────────────────────────────────────────────────────

/** 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
export async function setCretaPlaylistShareAllAction(
  accessToken: string | null | undefined,
  playlistId: number,
  shared: boolean,
): Promise<CretaPlaylistDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().setPlaylistShareAll(
      assertPositiveIntId(playlistId),
      actorOf(user),
      Boolean(shared),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
export async function setCretaScheduleShareAllAction(
  accessToken: string | null | undefined,
  scheduleId: number,
  shared: boolean,
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().setScheduleShareAll(
      assertPositiveIntId(scheduleId),
      actorOf(user),
      Boolean(shared),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function setCretaPlaylistShareAction(
  accessToken: string | null | undefined,
  playlistId: number,
  userId: number,
  shared: boolean,
): Promise<CretaPlaylistDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().setPlaylistShare(
      assertPositiveIntId(playlistId),
      actorOf(user),
      assertPositiveIntId(userId),
      Boolean(shared),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function setCretaScheduleShareAction(
  accessToken: string | null | undefined,
  scheduleId: number,
  userId: number,
  shared: boolean,
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().setScheduleShare(
      assertPositiveIntId(scheduleId),
      actorOf(user),
      assertPositiveIntId(userId),
      Boolean(shared),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

// ── 계정 현황 ─────────────────────────────────────────────────────

export async function getMyCretaOverviewAction(
  accessToken: string | null | undefined,
): Promise<CretaMyOverviewPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().myOverview(user.sub);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

// ── 플레이리스트 ──────────────────────────────────────────────────

export async function listCretaPlaylistsAction(
  accessToken: string | null | undefined,
): Promise<CretaPlaylistListItemPublic[]> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().listPlaylists();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 커뮤니티 갤러리(비로그인) 전용 — 전체 공개 플레이리스트만 */
export async function listPublicCretaPlaylistsAction(): Promise<
  CretaPlaylistListItemPublic[]
> {
  try {
    return await new CretaService().listPlaylists({ publicOnly: true });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 커뮤니티 상세(비로그인) 전용 — 전체 공개가 아니면 404 */
export async function getPublicCretaPlaylistAction(
  playlistId: number,
): Promise<CretaPlaylistDetailPublic> {
  try {
    return await new CretaService().getPlaylist(
      assertPositiveIntId(playlistId),
      { publicOnly: true },
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaPlaylistAction(
  accessToken: string | null | undefined,
  playlistId: number,
): Promise<CretaPlaylistDetailPublic> {
  try {
    await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(playlistId);
    return await new CretaService().getPlaylist(id);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaPlaylistAction(
  accessToken: string | null | undefined,
  body: {
    name: string;
    description?: string;
    loop?: boolean;
    visibility?: string;
  },
): Promise<CretaPlaylistDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().createPlaylist(body, user.sub);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaPlaylistAction(
  accessToken: string | null | undefined,
  playlistId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(playlistId);
    await new CretaService().deletePlaylist(id, actorOf(user));
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function addCretaPlaylistItemAction(
  accessToken: string | null | undefined,
  playlistId: number,
  bookId: number,
): Promise<CretaPlaylistDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().addPlaylistItem(
      assertPositiveIntId(playlistId),
      actorOf(user),
      assertPositiveIntId(bookId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function removeCretaPlaylistItemAction(
  accessToken: string | null | undefined,
  playlistId: number,
  itemId: number,
): Promise<CretaPlaylistDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().removePlaylistItem(
      assertPositiveIntId(playlistId),
      actorOf(user),
      assertPositiveIntId(itemId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function moveCretaPlaylistItemAction(
  accessToken: string | null | undefined,
  playlistId: number,
  itemId: number,
  direction: -1 | 1,
): Promise<CretaPlaylistDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    const dir = direction === -1 ? -1 : 1;
    return await new CretaService().movePlaylistItem(
      assertPositiveIntId(playlistId),
      actorOf(user),
      assertPositiveIntId(itemId),
      dir,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

// ── 스케줄 ────────────────────────────────────────────────────────

export async function listCretaSchedulesAction(
  accessToken: string | null | undefined,
): Promise<CretaScheduleListItemPublic[]> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().listSchedules();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaScheduleAction(
  accessToken: string | null | undefined,
  scheduleId: number,
): Promise<CretaScheduleDetailPublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().getSchedule(
      assertPositiveIntId(scheduleId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaScheduleAction(
  accessToken: string | null | undefined,
  body: { name: string },
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().createSchedule(body, user.sub);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaScheduleAction(
  accessToken: string | null | undefined,
  scheduleId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    await new CretaService().deleteSchedule(
      assertPositiveIntId(scheduleId),
      actorOf(user),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaScheduleAction(
  accessToken: string | null | undefined,
  scheduleId: number,
  patch: {
    autoApply?: boolean;
    defaultSourceType?: "none" | "book" | "playlist";
    defaultBookId?: number | null;
    defaultPlaylistId?: number | null;
  },
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().updateSchedule(
      assertPositiveIntId(scheduleId),
      actorOf(user),
      patch,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function addCretaScheduleSlotAction(
  accessToken: string | null | undefined,
  scheduleId: number,
  body: {
    startMin: number;
    endMin: number;
    sourceType: "book" | "playlist";
    bookId?: number;
    playlistId?: number;
    repeat?: CretaSlotRepeat;
    repeatStart?: string | null;
    repeatEnd?: string | null;
  },
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().addScheduleSlot(
      assertPositiveIntId(scheduleId),
      actorOf(user),
      body,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaScheduleSlotAction(
  accessToken: string | null | undefined,
  scheduleId: number,
  slotId: number,
  body: {
    startMin: number;
    endMin: number;
    sourceType: "book" | "playlist";
    bookId?: number;
    playlistId?: number;
    repeat?: CretaSlotRepeat;
    repeatStart?: string | null;
    repeatEnd?: string | null;
  },
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().updateScheduleSlot(
      assertPositiveIntId(scheduleId),
      actorOf(user),
      assertPositiveIntId(slotId),
      body,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function removeCretaScheduleSlotAction(
  accessToken: string | null | undefined,
  scheduleId: number,
  slotId: number,
): Promise<CretaScheduleDetailPublic> {
  try {
    const user = await requireUserFromToken(accessToken);
    return await new CretaService().removeScheduleSlot(
      assertPositiveIntId(scheduleId),
      actorOf(user),
      assertPositiveIntId(slotId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

// ── 디바이스 ──────────────────────────────────────────────────────

export async function listCretaDevicesAction(
  accessToken: string | null | undefined,
): Promise<CretaDevicePublic[]> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().listDevices();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaDeviceAction(
  accessToken: string | null | undefined,
  deviceId: number,
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().getDevice(assertPositiveIntId(deviceId));
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function createCretaDeviceAction(
  accessToken: string | null | undefined,
  body: {
    name: string;
    location?: string;
    platform?: string;
    resolution?: string;
    orientation?: string;
  },
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().createDevice(body);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaDeviceAction(
  accessToken: string | null | undefined,
  deviceId: number,
): Promise<void> {
  try {
    // 화면은 소유자 컬럼이 없는 전역 자원 — 삭제는 관리자만
    await requireAdminFromToken(accessToken);
    await new CretaService().deleteDevice(assertPositiveIntId(deviceId));
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaDeviceOnlineAction(
  accessToken: string | null | undefined,
  deviceId: number,
  online: boolean,
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().updateDeviceOnline(
      assertPositiveIntId(deviceId),
      Boolean(online),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaDeviceHealthAction(
  accessToken: string | null | undefined,
  deviceId: number,
  health: "ok" | "error",
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().updateDeviceHealth(
      assertPositiveIntId(deviceId),
      health === "error" ? "error" : "ok",
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaDevicePowerAction(
  accessToken: string | null | undefined,
  deviceId: number,
  body: {
    powerOnTime?: string | null;
    powerOffTime?: string | null;
    powerExcludeDays?: number[] | null;
    powerExcludeDates?: string[] | null;
  },
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().updateDevicePower(
      assertPositiveIntId(deviceId),
      body,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function updateCretaDeviceSourceAction(
  accessToken: string | null | undefined,
  deviceId: number,
  body: {
    type: "none" | "book" | "playlist" | "schedule" | "ad";
    refId?: number;
  },
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().updateDeviceSource(
      assertPositiveIntId(deviceId),
      body,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 원격 제어(시뮬레이션): 볼륨·밝기 */
export async function updateCretaDeviceControlsAction(
  accessToken: string | null | undefined,
  deviceId: number,
  body: { volume?: number; brightness?: number },
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().updateDeviceControls(
      assertPositiveIntId(deviceId),
      body,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 원격 제어(시뮬레이션): 플레이어 최신 버전 업데이트 */
export async function upgradeCretaDevicePlayerAction(
  accessToken: string | null | undefined,
  deviceId: number,
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().upgradeDevicePlayer(
      assertPositiveIntId(deviceId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 디바이스 태그 설정(전체 교체) */
export async function updateCretaDeviceTagsAction(
  accessToken: string | null | undefined,
  deviceId: number,
  tags: string[],
): Promise<CretaDevicePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaService().updateDeviceTags(
      assertPositiveIntId(deviceId),
      tags,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 태그 일괄 배포 — 태그가 붙은 모든 디바이스의 재생 소스 변경 */
export async function assignCretaSourceByTagAction(
  accessToken: string | null | undefined,
  tag: string,
  body: { type: "book" | "playlist" | "schedule"; refId: number },
): Promise<{ count: number; devices: CretaDevicePublic[] }> {
  try {
    // 태그가 붙은 **모든** 화면의 송출을 한 번에 바꾼다 — 관리자만
    await requireAdminFromToken(accessToken);
    return await new CretaService().assignSourceByTag(String(tag ?? ""), {
      type: body.type,
      refId: assertPositiveIntId(body.refId),
    });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
