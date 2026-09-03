// 비디오월 클라이언트 API(서버 액션 브리지) + 화면 공용 라벨
import {
  createCretaWallAction,
  deleteCretaWallAction,
  getCretaWallAction,
  listCretaWallsAction,
  setCretaWallMembersAction,
  updateCretaWallAction,
} from "@/actions/creta-walls";
import { humanizeServerActionError } from "@/lib/api";
// 서버 DTO를 단일 출처로 삼는다(타입 전용 import 라 런타임에는 지워진다)
import type {
  CretaVideoWallPublic,
  CretaWallMemberPublic,
} from "@/server/services/creta-walls.service";

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

export type CretaWallMember = CretaWallMemberPublic;

export type CretaVideoWall = CretaVideoWallPublic;

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
}

export async function fetchCretaWalls(): Promise<CretaVideoWall[]> {
  return run(() => listCretaWallsAction());
}

export async function fetchCretaWall(id: number): Promise<CretaVideoWall> {
  return run(() => getCretaWallAction(id));
}

export async function createCretaWall(input: {
  name: string;
}): Promise<CretaVideoWall> {
  return run(() => createCretaWallAction(input));
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
  return run(() => updateCretaWallAction(id, input));
}

/** 멤버 전체 교체 — 배열 순서 = 타일 위치(행 우선) */
export async function setCretaWallMembers(
  id: number,
  members: { deviceId: number; isMaster?: boolean; bookId?: number | null }[],
): Promise<CretaVideoWall> {
  return run(() => setCretaWallMembersAction(id, members));
}

export async function deleteCretaWall(id: number): Promise<void> {
  await run(() => deleteCretaWallAction(id));
}
