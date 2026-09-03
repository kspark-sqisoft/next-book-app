// 크레타 사이니지 클라이언트 API — 서버 액션 래퍼와 화면 공용 타입/라벨.
import {
  addCretaPlaylistItemAction,
  addCretaScheduleSlotAction,
  assignCretaSourceByTagAction,
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
  getPublicCretaPlaylistAction,
  listCretaDevicesAction,
  listCretaPlaylistsAction,
  listCretaSchedulesAction,
  listPublicCretaPlaylistsAction,
  moveCretaPlaylistItemAction,
  removeCretaPlaylistItemAction,
  removeCretaScheduleSlotAction,
  setCretaPlaylistShareAction,
  setCretaPlaylistShareAllAction,
  setCretaScheduleShareAction,
  setCretaScheduleShareAllAction,
  updateCretaDeviceControlsAction,
  updateCretaDeviceHealthAction,
  updateCretaDeviceOnlineAction,
  updateCretaDevicePowerAction,
  updateCretaDeviceSourceAction,
  updateCretaDeviceTagsAction,
  updateCretaScheduleAction,
  updateCretaScheduleSlotAction,
  upgradeCretaDevicePlayerAction,
} from "@/actions/creta";
import { humanizeServerActionError } from "@/lib/api";
// 서버 DTO를 단일 출처로 삼는다. 타입 전용 import 라 런타임에는 지워지므로
// server-only 모듈에서 가져와도 클라이언트 번들에 들어가지 않는다.
import type {
  CretaContentRefPublic,
  CretaDevicePublic,
  CretaMyOverviewPublic,
  CretaOverviewItemPublic,
  CretaOwnerPublic,
  CretaPlaylistDetailPublic,
  CretaPlaylistItemPublic,
  CretaPlaylistListItemPublic,
  CretaScheduleDetailPublic,
  CretaScheduleListItemPublic,
  CretaScheduleSlotPublic,
  CretaSharedUserPublic,
} from "@/server/services/creta.service";

// ── 타입(서버 Public DTO의 클라이언트 뷰) ─────────────────────────

export type CretaContentRef = CretaContentRefPublic;

/** 소유자(공개 정보). null = 공용 항목(소유자 도입 이전 데이터) */
export type CretaOwner = CretaOwnerPublic;

export type CretaSharedUser = CretaSharedUserPublic;

export type CretaPlaylistListItem = CretaPlaylistListItemPublic;

export type CretaPlaylistItem = CretaPlaylistItemPublic;

export type CretaPlaylistDetail = CretaPlaylistDetailPublic;

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

export type CretaScheduleSlot = CretaScheduleSlotPublic;

export type CretaScheduleListItem = CretaScheduleListItemPublic;

export type CretaScheduleDetail = CretaScheduleDetailPublic;

/** 크레타 > 계정: 항목 한 줄 */
export type CretaOverviewItem = CretaOverviewItemPublic;

export type CretaMyOverview = CretaMyOverviewPublic;

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

export type CretaDevice = CretaDevicePublic;

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
  "book" | "playlist" | "schedule" | "ad" | "none",
  string
> = {
  book: "북",
  playlist: "플레이리스트",
  schedule: "스케줄",
  ad: "광고",
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
    player: `Creta Player ${device.playerVersion}`,
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

// 플레이리스트
export async function fetchCretaPlaylists(): Promise<CretaPlaylistListItem[]> {
  return run(() => listCretaPlaylistsAction());
}

/** 커뮤니티 갤러리 — 비로그인도 볼 수 있는 전체 공개 플레이리스트만 */
export async function fetchPublicCretaPlaylists(): Promise<
  CretaPlaylistListItem[]
> {
  return run(() => listPublicCretaPlaylistsAction());
}

export async function fetchPublicCretaPlaylist(
  id: number,
): Promise<CretaPlaylistDetail> {
  return run(() => getPublicCretaPlaylistAction(id));
}

export async function fetchCretaPlaylist(
  id: number,
): Promise<CretaPlaylistDetail> {
  return run(() => getCretaPlaylistAction(id));
}

export async function createCretaPlaylist(input: {
  name: string;
  description?: string;
  loop?: boolean;
  visibility?: string;
}): Promise<CretaPlaylistDetail> {
  return run(() => createCretaPlaylistAction(input));
}

export async function deleteCretaPlaylist(id: number): Promise<void> {
  return run(() => deleteCretaPlaylistAction(id));
}

export async function addCretaPlaylistItem(
  playlistId: number,
  bookId: number,
): Promise<CretaPlaylistDetail> {
  return run(() => addCretaPlaylistItemAction(playlistId, bookId));
}

export async function removeCretaPlaylistItem(
  playlistId: number,
  itemId: number,
): Promise<CretaPlaylistDetail> {
  return run(() => removeCretaPlaylistItemAction(playlistId, itemId));
}

export async function moveCretaPlaylistItem(
  playlistId: number,
  itemId: number,
  direction: -1 | 1,
): Promise<CretaPlaylistDetail> {
  return run(() => moveCretaPlaylistItemAction(playlistId, itemId, direction));
}

// 스케줄
/** 크레타 > 계정 현황(로그인 필요) */
export async function fetchMyCretaOverview(): Promise<CretaMyOverview> {
  return run(() => getMyCretaOverviewAction());
}

/** 플레이리스트 공유 추가/해제 — 갱신된 상세 반환 */
export async function setCretaPlaylistShare(
  id: number,
  userId: number,
  shared: boolean,
): Promise<CretaPlaylistDetail> {
  return run(() => setCretaPlaylistShareAction(id, userId, shared));
}

/** 스케줄 공유 추가/해제 — 갱신된 상세 반환 */
export async function setCretaScheduleShare(
  id: number,
  userId: number,
  shared: boolean,
): Promise<CretaScheduleDetail> {
  return run(() => setCretaScheduleShareAction(id, userId, shared));
}

/** 플레이리스트 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
export async function setCretaPlaylistShareAll(
  id: number,
  shared: boolean,
): Promise<CretaPlaylistDetail> {
  return run(() => setCretaPlaylistShareAllAction(id, shared));
}

/** 스케줄 모든 사용자 공유 켜기/끄기 — 소유자·관리자만 */
export async function setCretaScheduleShareAll(
  id: number,
  shared: boolean,
): Promise<CretaScheduleDetail> {
  return run(() => setCretaScheduleShareAllAction(id, shared));
}

export async function fetchCretaSchedules(): Promise<CretaScheduleListItem[]> {
  return run(() => listCretaSchedulesAction());
}

export async function fetchCretaSchedule(
  id: number,
): Promise<CretaScheduleDetail> {
  return run(() => getCretaScheduleAction(id));
}

export async function createCretaSchedule(input: {
  name: string;
}): Promise<CretaScheduleDetail> {
  return run(() => createCretaScheduleAction(input));
}

export async function deleteCretaSchedule(id: number): Promise<void> {
  return run(() => deleteCretaScheduleAction(id));
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
  return run(() => updateCretaScheduleAction(id, patch));
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
  return run(() => addCretaScheduleSlotAction(scheduleId, body));
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
  return run(() => updateCretaScheduleSlotAction(scheduleId, slotId, body));
}

export async function removeCretaScheduleSlot(
  scheduleId: number,
  slotId: number,
): Promise<CretaScheduleDetail> {
  return run(() => removeCretaScheduleSlotAction(scheduleId, slotId));
}

// 디바이스
export async function fetchCretaDevices(): Promise<CretaDevice[]> {
  return run(() => listCretaDevicesAction());
}

export async function fetchCretaDevice(id: number): Promise<CretaDevice> {
  return run(() => getCretaDeviceAction(id));
}

export async function createCretaDevice(input: {
  name: string;
  location?: string;
  platform?: string;
  resolution?: string;
  orientation?: string;
}): Promise<CretaDevice> {
  return run(() => createCretaDeviceAction(input));
}

export async function deleteCretaDevice(id: number): Promise<void> {
  return run(() => deleteCretaDeviceAction(id));
}

export async function updateCretaDeviceOnline(
  id: number,
  online: boolean,
): Promise<CretaDevice> {
  return run(() => updateCretaDeviceOnlineAction(id, online));
}

export async function updateCretaDeviceHealth(
  id: number,
  health: "ok" | "error",
): Promise<CretaDevice> {
  return run(() => updateCretaDeviceHealthAction(id, health));
}

export async function updateCretaDevicePower(
  id: number,
  body: CretaDevicePowerInput,
): Promise<CretaDevice> {
  return run(() => updateCretaDevicePowerAction(id, body));
}

export async function updateCretaDeviceSource(
  id: number,
  body: {
    type: "none" | "book" | "playlist" | "schedule" | "ad";
    refId?: number;
  },
): Promise<CretaDevice> {
  return run(() => updateCretaDeviceSourceAction(id, body));
}

/** 플레이어 최신 버전(시뮬레이션) — 서버 상수와 동일하게 유지 */
export const CRETA_PLAYER_LATEST = "v1.2.0";

/** 원격 제어(시뮬레이션): 볼륨·밝기 저장 */
export async function updateCretaDeviceControls(
  id: number,
  body: { volume?: number; brightness?: number },
): Promise<CretaDevice> {
  return run(() => updateCretaDeviceControlsAction(id, body));
}

/** 원격 제어(시뮬레이션): 플레이어 최신 버전 업데이트 */
export async function upgradeCretaDevicePlayer(
  id: number,
): Promise<CretaDevice> {
  return run(() => upgradeCretaDevicePlayerAction(id));
}

/** 디바이스 태그 설정(전체 교체) — 각 1~40자, 최대 10개 */
export async function updateCretaDeviceTags(
  id: number,
  tags: string[],
): Promise<CretaDevice> {
  return run(() => updateCretaDeviceTagsAction(id, tags));
}

/** 태그 일괄 배포 — 태그가 붙은 모든 디바이스의 재생 소스를 한 번에 변경 */
export async function assignCretaSourceByTag(
  tag: string,
  body: { type: "book" | "playlist" | "schedule"; refId: number },
): Promise<{ count: number; devices: CretaDevice[] }> {
  return run(() => assignCretaSourceByTagAction(tag, body));
}
