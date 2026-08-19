// 크레타 사이니지 클라이언트 API — 서버 액션 래퍼와 화면 공용 타입/라벨.
import {
  addCretaPlaylistItemAction,
  addCretaScheduleSlotAction,
  createCretaDeviceAction,
  createCretaPlaylistAction,
  createCretaScheduleAction,
  deleteCretaDeviceAction,
  deleteCretaPlaylistAction,
  deleteCretaScheduleAction,
  getCretaDeviceAction,
  getCretaPlaylistAction,
  getCretaScheduleAction,
  listCretaDevicesAction,
  listCretaPlaylistsAction,
  listCretaSchedulesAction,
  moveCretaPlaylistItemAction,
  removeCretaPlaylistItemAction,
  removeCretaScheduleSlotAction,
  updateCretaDeviceOnlineAction,
  updateCretaDeviceSourceAction,
  updateCretaScheduleAction,
  updateCretaScheduleSlotAction,
} from "@/actions/creta";
import {
  type BookListCoverPreview,
  getAccessToken,
  humanizeServerActionError,
} from "@/lib/api";

// ── 타입(서버 Public DTO의 클라이언트 뷰) ─────────────────────────

export type CretaContentRef = {
  kind: "book" | "playlist" | "schedule";
  id: number;
  title: string;
  cover: BookListCoverPreview | null;
};

export type CretaPlaylistListItem = {
  id: number;
  name: string;
  description: string;
  loop: boolean;
  visibility: string;
  itemCount: number;
  cover: BookListCoverPreview | null;
  updatedAt: string;
};

export type CretaPlaylistItem = {
  itemId: number;
  bookId: number;
  title: string;
  pageCount: number;
  cover: BookListCoverPreview | null;
};

export type CretaPlaylistDetail = {
  id: number;
  name: string;
  description: string;
  loop: boolean;
  visibility: string;
  items: CretaPlaylistItem[];
};

export type CretaSlotRepeat =
  | "once"
  | "daily"
  | "weekday"
  | "weekend"
  | "range";

export const SLOT_REPEAT_LABEL: Record<CretaSlotRepeat, string> = {
  once: "이 날짜만",
  daily: "매일 (연중)",
  weekday: "평일",
  weekend: "주말",
  range: "기간 지정",
};

export type CretaScheduleSlot = {
  id: number;
  startMin: number;
  endMin: number;
  repeat: CretaSlotRepeat;
  repeatStart: string | null;
  repeatEnd: string | null;
  content: CretaContentRef | null;
};

export type CretaScheduleListItem = {
  id: number;
  name: string;
  slotCount: number;
  autoApply: boolean;
  defaultContent: CretaContentRef | null;
  appliedDeviceNames: string[];
};

export type CretaScheduleDetail = {
  id: number;
  name: string;
  autoApply: boolean;
  defaultContent: CretaContentRef | null;
  slots: CretaScheduleSlot[];
  appliedDevices: { id: number; name: string }[];
};

export type CretaDevice = {
  id: number;
  name: string;
  location: string;
  platform: string;
  resolution: string;
  orientation: string;
  online: boolean;
  source: CretaContentRef | null;
  createdAt: string;
};

export const PLAY_SOURCE_LABEL: Record<
  "book" | "playlist" | "schedule" | "none",
  string
> = {
  book: "북",
  playlist: "플레이리스트",
  schedule: "스케줄",
  none: "없음",
};

/** "HH:MM" → 0시 기준 경과 분 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 분 → "HH:MM" */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 디바이스 시뮬레이션 파생값(IP·플레이어 버전 등) — DB에 없는 가짜 메타 */
export function deviceSimMeta(device: CretaDevice): {
  ip: string;
  player: string;
  uptime: string;
  lastSync: string;
} {
  return {
    ip: `192.168.0.${(device.id % 230) + 20}`,
    player: "Creta Player v1.1.0",
    uptime: device.online
      ? `${(device.id % 14) + 1}일 ${device.id % 24}시간`
      : "—",
    lastSync: device.online ? "방금" : "연결 끊김",
  };
}

// ── 액션 래퍼 ─────────────────────────────────────────────────────

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

// 플레이리스트
export async function fetchCretaPlaylists(): Promise<CretaPlaylistListItem[]> {
  return run(() =>
    listCretaPlaylistsAction(),
  ) as unknown as CretaPlaylistListItem[];
}

export async function fetchCretaPlaylist(
  id: number,
): Promise<CretaPlaylistDetail> {
  return run(() =>
    getCretaPlaylistAction(id),
  ) as unknown as CretaPlaylistDetail;
}

export async function createCretaPlaylist(input: {
  name: string;
  description?: string;
  loop?: boolean;
  visibility?: string;
}): Promise<CretaPlaylistDetail> {
  return run(() =>
    createCretaPlaylistAction(requireToken(), input),
  ) as unknown as CretaPlaylistDetail;
}

export async function deleteCretaPlaylist(id: number): Promise<void> {
  return run(() => deleteCretaPlaylistAction(requireToken(), id));
}

export async function addCretaPlaylistItem(
  playlistId: number,
  bookId: number,
): Promise<CretaPlaylistDetail> {
  return run(() =>
    addCretaPlaylistItemAction(requireToken(), playlistId, bookId),
  ) as unknown as CretaPlaylistDetail;
}

export async function removeCretaPlaylistItem(
  playlistId: number,
  itemId: number,
): Promise<CretaPlaylistDetail> {
  return run(() =>
    removeCretaPlaylistItemAction(requireToken(), playlistId, itemId),
  ) as unknown as CretaPlaylistDetail;
}

export async function moveCretaPlaylistItem(
  playlistId: number,
  itemId: number,
  direction: -1 | 1,
): Promise<CretaPlaylistDetail> {
  return run(() =>
    moveCretaPlaylistItemAction(requireToken(), playlistId, itemId, direction),
  ) as unknown as CretaPlaylistDetail;
}

// 스케줄
export async function fetchCretaSchedules(): Promise<CretaScheduleListItem[]> {
  return run(() =>
    listCretaSchedulesAction(),
  ) as unknown as CretaScheduleListItem[];
}

export async function fetchCretaSchedule(
  id: number,
): Promise<CretaScheduleDetail> {
  return run(() =>
    getCretaScheduleAction(id),
  ) as unknown as CretaScheduleDetail;
}

export async function createCretaSchedule(input: {
  name: string;
}): Promise<CretaScheduleDetail> {
  return run(() =>
    createCretaScheduleAction(requireToken(), input),
  ) as unknown as CretaScheduleDetail;
}

export async function deleteCretaSchedule(id: number): Promise<void> {
  return run(() => deleteCretaScheduleAction(requireToken(), id));
}

export async function updateCretaSchedule(
  id: number,
  patch: {
    autoApply?: boolean;
    defaultSourceType?: "none" | "book" | "playlist";
    defaultBookId?: number | null;
    defaultPlaylistId?: number | null;
  },
): Promise<CretaScheduleDetail> {
  return run(() =>
    updateCretaScheduleAction(requireToken(), id, patch),
  ) as unknown as CretaScheduleDetail;
}

export async function addCretaScheduleSlot(
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
): Promise<CretaScheduleDetail> {
  return run(() =>
    addCretaScheduleSlotAction(requireToken(), scheduleId, body),
  ) as unknown as CretaScheduleDetail;
}

export async function updateCretaScheduleSlot(
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
): Promise<CretaScheduleDetail> {
  return run(() =>
    updateCretaScheduleSlotAction(requireToken(), scheduleId, slotId, body),
  ) as unknown as CretaScheduleDetail;
}

export async function removeCretaScheduleSlot(
  scheduleId: number,
  slotId: number,
): Promise<CretaScheduleDetail> {
  return run(() =>
    removeCretaScheduleSlotAction(requireToken(), scheduleId, slotId),
  ) as unknown as CretaScheduleDetail;
}

// 디바이스
export async function fetchCretaDevices(): Promise<CretaDevice[]> {
  return run(() => listCretaDevicesAction()) as unknown as CretaDevice[];
}

export async function fetchCretaDevice(id: number): Promise<CretaDevice> {
  return run(() => getCretaDeviceAction(id)) as unknown as CretaDevice;
}

export async function createCretaDevice(input: {
  name: string;
  location?: string;
  platform?: string;
  resolution?: string;
  orientation?: string;
}): Promise<CretaDevice> {
  return run(() =>
    createCretaDeviceAction(requireToken(), input),
  ) as unknown as CretaDevice;
}

export async function deleteCretaDevice(id: number): Promise<void> {
  return run(() => deleteCretaDeviceAction(requireToken(), id));
}

export async function updateCretaDeviceOnline(
  id: number,
  online: boolean,
): Promise<CretaDevice> {
  return run(() =>
    updateCretaDeviceOnlineAction(requireToken(), id, online),
  ) as unknown as CretaDevice;
}

export async function updateCretaDeviceSource(
  id: number,
  body: { type: "none" | "book" | "playlist" | "schedule"; refId?: number },
): Promise<CretaDevice> {
  return run(() =>
    updateCretaDeviceSourceAction(requireToken(), id, body),
  ) as unknown as CretaDevice;
}
