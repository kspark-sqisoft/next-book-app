"use server";

// 크레타 사이니지(플레이리스트·스케줄·디바이스) 서버 액션.
// 조회는 공개, 변경은 로그인 필요(북 목록과 동일한 학습용 정책).
import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import {
  type CretaDevicePublic,
  type CretaPlaylistDetailPublic,
  type CretaPlaylistListItemPublic,
  type CretaScheduleDetailPublic,
  type CretaScheduleListItemPublic,
  CretaService,
  type CretaSlotRepeat,
} from "@/server/services/creta.service";

const TAG = "creta-actions";

// ── 플레이리스트 ──────────────────────────────────────────────────

export async function listCretaPlaylistsAction(): Promise<
  CretaPlaylistListItemPublic[]
> {
  try {
    return await new CretaService().listPlaylists();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaPlaylistAction(
  playlistId: number,
): Promise<CretaPlaylistDetailPublic> {
  try {
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
    await requireUserFromToken(accessToken);
    return await new CretaService().createPlaylist(body);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaPlaylistAction(
  accessToken: string | null | undefined,
  playlistId: number,
): Promise<void> {
  try {
    await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(playlistId);
    await new CretaService().deletePlaylist(id);
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
    await requireUserFromToken(accessToken);
    return await new CretaService().addPlaylistItem(
      assertPositiveIntId(playlistId),
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
    await requireUserFromToken(accessToken);
    return await new CretaService().removePlaylistItem(
      assertPositiveIntId(playlistId),
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
    await requireUserFromToken(accessToken);
    const dir = direction === -1 ? -1 : 1;
    return await new CretaService().movePlaylistItem(
      assertPositiveIntId(playlistId),
      assertPositiveIntId(itemId),
      dir,
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

// ── 스케줄 ────────────────────────────────────────────────────────

export async function listCretaSchedulesAction(): Promise<
  CretaScheduleListItemPublic[]
> {
  try {
    return await new CretaService().listSchedules();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaScheduleAction(
  scheduleId: number,
): Promise<CretaScheduleDetailPublic> {
  try {
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
    await requireUserFromToken(accessToken);
    return await new CretaService().createSchedule(body);
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deleteCretaScheduleAction(
  accessToken: string | null | undefined,
  scheduleId: number,
): Promise<void> {
  try {
    await requireUserFromToken(accessToken);
    await new CretaService().deleteSchedule(assertPositiveIntId(scheduleId));
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
    await requireUserFromToken(accessToken);
    return await new CretaService().updateSchedule(
      assertPositiveIntId(scheduleId),
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
    await requireUserFromToken(accessToken);
    return await new CretaService().addScheduleSlot(
      assertPositiveIntId(scheduleId),
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
    await requireUserFromToken(accessToken);
    return await new CretaService().updateScheduleSlot(
      assertPositiveIntId(scheduleId),
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
    await requireUserFromToken(accessToken);
    return await new CretaService().removeScheduleSlot(
      assertPositiveIntId(scheduleId),
      assertPositiveIntId(slotId),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

// ── 디바이스 ──────────────────────────────────────────────────────

export async function listCretaDevicesAction(): Promise<CretaDevicePublic[]> {
  try {
    return await new CretaService().listDevices();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaDeviceAction(
  deviceId: number,
): Promise<CretaDevicePublic> {
  try {
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
    await requireUserFromToken(accessToken);
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

export async function updateCretaDeviceSourceAction(
  accessToken: string | null | undefined,
  deviceId: number,
  body: { type: "none" | "book" | "playlist" | "schedule"; refId?: number },
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
