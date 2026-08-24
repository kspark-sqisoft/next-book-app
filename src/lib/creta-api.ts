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
  getMyCretaOverviewAction,
  listCretaDevicesAction,
  listCretaPlaylistsAction,
  listCretaSchedulesAction,
  moveCretaPlaylistItemAction,
  removeCretaPlaylistItemAction,
  removeCretaScheduleSlotAction,
  setCretaPlaylistShareAction,
  setCretaPlaylistShareAllAction,
  setCretaScheduleShareAction,
  setCretaScheduleShareAllAction,
  updateCretaDeviceHealthAction,
  updateCretaDeviceOnlineAction,
  updateCretaDevicePowerAction,
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

/** 소유자(공개 정보). null = 공용 항목(소유자 도입 이전 데이터) */
export type CretaOwner = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type CretaSharedUser = { id: number; name: string };

export type CretaPlaylistListItem = {
  id: number;
  name: string;
  description: string;
  loop: boolean;
  visibility: string;
  itemCount: number;
  cover: BookListCoverPreview | null;
  updatedAt: string;
  owner: CretaOwner | null;
  sharedWith: CretaSharedUser[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
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
  owner: CretaOwner | null;
  sharedUserIds: number[];
  sharedWith: CretaSharedUser[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
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
  /** 지금 편성된 시간대의 콘텐츠(없으면 기본 재생) */
  currentContent: CretaContentRef | null;
  appliedDeviceNames: string[];
  owner: CretaOwner | null;
  sharedWith: CretaSharedUser[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
};

export type CretaScheduleDetail = {
  id: number;
  name: string;
  autoApply: boolean;
  defaultContent: CretaContentRef | null;
  slots: CretaScheduleSlot[];
  appliedDevices: { id: number; name: string }[];
  owner: CretaOwner | null;
  sharedUserIds: number[];
  sharedWith: CretaSharedUser[];
  /** true면 모든 로그인 사용자가 편집 가능 */
  sharedToAll: boolean;
};

/** 크레타 > 계정: 항목 한 줄 */
export type CretaOverviewItem = {
  id: number;
  title: string;
  updatedAt: string;
  ownerName: string | null;
  sharedWith: string[];
};

export type CretaMyOverview = {
  user: {
    id: number;
    name: string;
    email: string;
    role: "user" | "admin";
    imageUrl: string | null;
  };
  books: { owned: CretaOverviewItem[]; shared: CretaOverviewItem[] };
  playlists: { owned: CretaOverviewItem[]; shared: CretaOverviewItem[] };
  schedules: { owned: CretaOverviewItem[]; shared: CretaOverviewItem[] };
};

/** 공유 대상 요약: "A, B, C 외 2명" */
export function sharedWithSummary(
  users: readonly CretaSharedUser[],
  max = 3,
): string {
  const names = users.map((u) => u.name.trim() || "이름 없음");
  const head = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return rest > 0 ? `${head} 외 ${rest}명` : head;
}

export type CretaDevice = {
  id: number;
  name: string;
  location: string;
  platform: string;
  resolution: string;
  orientation: string;
  online: boolean;
  source: CretaContentRef | null;
  /** 전원 예약 "HH:MM"(매일). null = 예약 없음 */
  powerOnTime: string | null;
  powerOffTime: string | null;
  /** 전원 예약 제외 요일(0=일…6=토) */
  powerExcludeDays: number[];
  /** 전원 예약 제외 날짜(YYYY-MM-DD) */
  powerExcludeDates: string[];
  /** 단말 상태(시뮬레이션): ok | error */
  health: "ok" | "error";
  createdAt: string;
};

export type CretaDevicePowerInput = {
  powerOnTime: string | null;
  powerOffTime: string | null;
  powerExcludeDays: number[];
  powerExcludeDates: string[];
};

export const WEEKDAY_SHORT_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

export type CretaDeviceStatus = "online" | "offline" | "error";

/** 목록·상세 공통 상태: 오프라인이 최우선, 그다음 비정상, 나머지 온라인 */
export function cretaDeviceStatus(
  device: Pick<CretaDevice, "online" | "health">,
): CretaDeviceStatus {
  if (!device.online) return "offline";
  if (device.health === "error") return "error";
  return "online";
}

export const CRETA_DEVICE_STATUS_LABEL: Record<CretaDeviceStatus, string> = {
  online: "온라인",
  offline: "오프라인",
  error: "비정상",
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

/** 디바이스 시뮬레이션 파생값(IP·플레이어 버전·리소스 사용률 등) — DB에 없는 가짜 메타 */
export function deviceSimMeta(device: CretaDevice): {
  ip: string;
  player: string;
  uptime: string;
  lastSync: string;
  /** 0~100 (%) — 비정상 단말은 CPU·RAM이 높게 나오도록 */
  cpuPct: number;
  ramPct: number;
  ssdPct: number;
} {
  const id = device.id;
  const abnormal = device.health === "error";
  return {
    ip: `192.168.0.${(id % 230) + 20}`,
    player: "Creta Player v1.1.0",
    uptime: device.online ? `${(id % 14) + 1}일 ${id % 24}시간` : "—",
    lastSync: device.online ? "방금" : "연결 끊김",
    cpuPct: abnormal ? 91 + (id % 7) : 18 + ((id * 13) % 45),
    ramPct: abnormal ? 86 + (id % 9) : 35 + ((id * 17) % 40),
    ssdPct: 40 + ((id * 23) % 45),
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
/** 크레타 > 계정 현황(로그인 필요) */
export async function fetchMyCretaOverview(): Promise<CretaMyOverview> {
  return run(() =>
    getMyCretaOverviewAction(requireToken()),
  ) as unknown as CretaMyOverview;
}

/** 플레이리스트 공유 추가/해제 — 갱신된 상세 반환 */
export async function setCretaPlaylistShare(
  id: number,
  userId: number,
  shared: boolean,
): Promise<CretaPlaylistDetail> {
  return run(() =>
    setCretaPlaylistShareAction(requireToken(), id, userId, shared),
  ) as unknown as CretaPlaylistDetail;
}

/** 스케줄 공유 추가/해제 — 갱신된 상세 반환 */
export async function setCretaScheduleShare(
  id: number,
  userId: number,
  shared: boolean,
): Promise<CretaScheduleDetail> {
  return run(() =>
    setCretaScheduleShareAction(requireToken(), id, userId, shared),
  ) as unknown as CretaScheduleDetail;
}

/** 플레이리스트 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
export async function setCretaPlaylistShareAll(
  id: number,
  shared: boolean,
): Promise<CretaPlaylistDetail> {
  return run(() =>
    setCretaPlaylistShareAllAction(requireToken(), id, shared),
  ) as unknown as CretaPlaylistDetail;
}

/** 스케줄 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
export async function setCretaScheduleShareAll(
  id: number,
  shared: boolean,
): Promise<CretaScheduleDetail> {
  return run(() =>
    setCretaScheduleShareAllAction(requireToken(), id, shared),
  ) as unknown as CretaScheduleDetail;
}

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

export async function updateCretaDeviceHealth(
  id: number,
  health: "ok" | "error",
): Promise<CretaDevice> {
  return run(() =>
    updateCretaDeviceHealthAction(requireToken(), id, health),
  ) as unknown as CretaDevice;
}

export async function updateCretaDevicePower(
  id: number,
  body: CretaDevicePowerInput,
): Promise<CretaDevice> {
  return run(() =>
    updateCretaDevicePowerAction(requireToken(), id, body),
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
