// 비디오월 클라이언트 API(서버 액션 브리지) + 화면 공용 라벨
import {
  createCretaWallAction,
  deleteCretaWallAction,
  getCretaWallAction,
  listCretaWallsAction,
  setCretaWallMembersAction,
  updateCretaWallAction,
} from "@/actions/creta-walls";
import { getAccessToken, humanizeServerActionError } from "@/lib/api";

export const CRETA_WALL_MODES = ["tile", "mirror", "multi"] as const;
export type CretaWallMode = (typeof CRETA_WALL_MODES)[number];

export const CRETA_WALL_MODE_LABEL: Record<CretaWallMode, string> = {
  tile: "타일 분할",
  mirror: "동시 재생",
  multi: "콘텐츠별",
};

export const CRETA_WALL_MODE_DESC: Record<CretaWallMode, string> = {
  tile: "같은 북 화면을 행×열로 나눠 각 디바이스가 자기 조각을 표시합니다.",
  mirror: "모든 디바이스가 같은 북을 같은 시점에 재생합니다.",
  multi: "디바이스마다 다른 북을 재생하되, 페이지 전환 타이밍을 함께 맞춥니다.",
};

export type CretaWallMember = {
  deviceId: number;
  deviceName: string;
  online: boolean;
  position: number;
  isMaster: boolean;
  bookId: number | null;
  bookTitle: string | null;
};

export type CretaVideoWall = {
  id: number;
  name: string;
  mode: CretaWallMode;
  rows: number;
  cols: number;
  bookId: number | null;
  bookTitle: string | null;
  slideSec: number;
  /** 소유자 판별용 — canManageOwned로 편집·삭제 노출을 정한다 */
  ownerId: number | null;
  /** 만든 사람 이름(작성자 표시) */
  ownerName: string | null;
  members: CretaWallMember[];
  updatedAt: string;
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

export async function fetchCretaWalls(): Promise<CretaVideoWall[]> {
  return run(() => listCretaWallsAction(requireToken())) as unknown as Promise<
    CretaVideoWall[]
  >;
}

export async function fetchCretaWall(id: number): Promise<CretaVideoWall> {
  return run(() =>
    getCretaWallAction(requireToken(), id),
  ) as unknown as Promise<CretaVideoWall>;
}

export async function createCretaWall(input: {
  name: string;
}): Promise<CretaVideoWall> {
  return run(() =>
    createCretaWallAction(requireToken(), input),
  ) as unknown as Promise<CretaVideoWall>;
}

export async function updateCretaWall(
  id: number,
  input: {
    name?: string;
    mode?: CretaWallMode;
    rows?: number;
    cols?: number;
    bookId?: number | null;
    slideSec?: number;
  },
): Promise<CretaVideoWall> {
  return run(() =>
    updateCretaWallAction(requireToken(), id, input),
  ) as unknown as Promise<CretaVideoWall>;
}

/** 멤버 전체 교체 — 배열 순서 = 타일 위치(행 우선) */
export async function setCretaWallMembers(
  id: number,
  members: { deviceId: number; isMaster?: boolean; bookId?: number | null }[],
): Promise<CretaVideoWall> {
  return run(() =>
    setCretaWallMembersAction(requireToken(), id, members),
  ) as unknown as Promise<CretaVideoWall>;
}

export async function deleteCretaWall(id: number): Promise<void> {
  await run(() => deleteCretaWallAction(requireToken(), id));
}
